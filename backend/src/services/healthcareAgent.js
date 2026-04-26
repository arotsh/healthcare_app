import { runQuery } from '../db.js';
import { vectorSearch, isVectorSearchEnabled } from './vectorSearch.js';
import { verifyResults } from './verifier.js';
import { LOCAL_MODE, localVectorSearch, localRank } from './localStore.js';

const TABLE = process.env.DATABRICKS_AGENT_TABLE || 'workspace.default.facility_signals';
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const VS_CANDIDATE_POOL = 50;
const MAX_RESULTS = 3;
const VERIFY_TOP_N = Number(process.env.VERIFY_TOP_N ?? MAX_RESULTS);

const KNOWN_LOCATIONS = [
  'delhi', 'bihar', 'mumbai', 'maharashtra', 'uttar pradesh',
  'karnataka', 'tamil nadu', 'kerala', 'gujarat', 'rajasthan',
  'west bengal', 'kolkata', 'chennai', 'bangalore', 'bengaluru',
  'hyderabad', 'pune', 'patna',
];

const PARSE_PROMPT = (q) => `Return raw JSON only. No markdown. No explanation.

Parse this healthcare facility search query. The query may be in English, Hindi, Hinglish,
Bengali, Tamil, Telugu, Marathi, Gujarati, Kannada, Malayalam, Punjabi, or Urdu — handle them all.

Schema:
{
  "location_text": null,
  "needs_emergency": true/false,
  "needs_surgery": true/false,
  "needs_diagnostics": true/false,
  "needs_critical_care": true/false,
  "needs_maternal": true/false,
  "needs_specialty": true/false,
  "top_k": null,
  "priority": []
}

Rules:
- ICU, ventilator, oxygen, critical care, आईसीयू, गहन देखभाल, ভেন্টিলেটর, தீவிர சிகிச்சை => needs_critical_care
- surgery, operation, appendectomy, surgeon, सर्जरी, ऑपरेशन, অস্ত্রোপচার, శస్త్రచికిత్స => needs_surgery
- MRI, CT, scan, X-ray, diagnostic, एक्स-रे, सीटी स्कैन, এক্স-রে, સ્કેન => needs_diagnostics
- maternity, delivery, neonatal, NICU, प्रसव, मातृत्व, প্রসব, பிரசவம் => needs_maternal
- oncology, cardiology, neurology, dialysis, specialist, हृदय रोग, कैंसर, ক্যান্সার, இதய => needs_specialty
- emergency, trauma, urgent, casualty, इमरजेंसी, आपातकाल, জরুরি, அவசர => needs_emergency

Location:
- Extract Indian state/city. ALWAYS write location_text in lowercase English Latin script
  so it matches the database. Translate non-Latin script to English.
- Examples: मुंबई → "mumbai"; दिल्ली → "delhi"; बैंगलोर/বেঙ্গালুরু → "bangalore";
  चेन्नई/சென்னை → "chennai"; कोलकाता/কলকাতা → "kolkata"; पटना/পাটনা → "patna";
  हैदराबाद/హైదరాబాద్ → "hyderabad"; पुणे → "pune"; अहमदाबाद → "ahmedabad";
  बिहार/বিহার → "bihar"; महाराष्ट्र → "maharashtra"; तमिलनाडु → "tamil nadu";
  उत्तर प्रदेश → "uttar pradesh"; कर्नाटक/ಕರ್ನಾಟಕ → "karnataka"
- "priority" should list the most important needs in order (use the keys above)

How many results (top_k):
- Extract the number the user explicitly asked for: "show me 2 hospitals" → 2,
  "top 3 facilities" → 3, "find 1 best" → 1.
- Hindi/Hinglish/etc.: "मुझे 2 अस्पताल चाहिए" → 2, "3 hospitals dikhao" → 3.
- If no number is asked, set top_k to null.
- Allowed range: 1 to 3. Anything bigger → 3; anything smaller → 1.

Query:
${q}`;

const cleanJson = (raw) => {
  const stripped = String(raw).trim().replace(/```json/g, '').replace(/```/g, '').trim();
  const match = stripped.match(/\{[\s\S]*\}/);
  return match ? match[0] : stripped;
};

async function parseQueryLLM(userQuery) {
  if (!GROQ_API_KEY) throw new Error('GROQ_API_KEY not set');

  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 15_000);

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: PARSE_PROMPT(userQuery) }],
        temperature: 0,
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Groq ${res.status}: ${text.slice(0, 200)}`);
    }
    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content ?? '{}';
    const parsed = JSON.parse(cleanJson(raw));
    parsed.raw_query = userQuery;
    return parsed;
  } finally {
    clearTimeout(timeout);
  }
}

function parseQuerySimple(userQuery) {
  const q = userQuery.toLowerCase();
  const has = (kws) => kws.some((k) => q.includes(k));
  const parsed = {
    raw_query: userQuery,
    needs_emergency: has(['emergency', 'urgent', 'trauma', 'casualty']),
    needs_surgery: has(['surgery', 'operation', 'appendectomy', 'surgeon']),
    needs_diagnostics: has(['mri', 'ct', 'scan', 'xray', 'x-ray', 'diagnostic']),
    needs_critical_care: has(['icu', 'ventilator', 'critical care', 'oxygen']),
    needs_maternal: has(['maternity', 'neonatal', 'nicu', 'delivery', 'childbirth']),
    needs_specialty: has(['oncology', 'cardiology', 'neurology', 'dialysis', 'specialist']),
    location_text: null,
    top_k: null,
    priority: [],
  };
  const action = q.match(/\b(?:show|give|list|top|first|find|get|need|want)\s+(?:me\s+)?(\d+)\b/);
  const noun = q.match(/\b(\d+)\s+(?:hospital|hospitals|clinic|clinics|facility|facilities|results?|options?)/);
  const found = action?.[1] ?? noun?.[1] ?? null;
  if (found) parsed.top_k = Math.max(1, Math.min(MAX_RESULTS, Number(found)));
  for (const loc of KNOWN_LOCATIONS) {
    if (q.includes(loc)) {
      parsed.location_text = loc;
      break;
    }
  }
  return parsed;
}

async function parseQuery(userQuery) {
  try {
    return await parseQueryLLM(userQuery);
  } catch (err) {
    console.warn('[parseQuery] LLM failed, using simple parser:', err.message);
    return parseQuerySimple(userQuery);
  }
}

const safeRound = (v, digits = 3) => {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? Number(n.toFixed(digits)) : null;
};

const cleanString = (v) => {
  if (v == null) return null;
  const s = String(v).trim();
  return s === '' || s.toLowerCase() === 'null' ? null : s;
};

function buildExplanation(row) {
  const reasons = [];
  if (row.emergency_score > 0) reasons.push(`Emergency signal: ${row.emergency_signal}`);
  if (row.surgery_score > 0) reasons.push(`Surgery signal: ${row.surgery_signal}`);
  if (row.critical_care_score > 0) reasons.push(`Critical care signal: ${row.critical_care_signal}`);
  if (row.diagnostic_score > 0) reasons.push(`Diagnostic signal: ${row.diagnostic_signal}`);
  if (row.maternal_neonatal_score > 0)
    reasons.push(`Maternal/neonatal signal: ${row.maternal_neonatal_signal}`);
  if (row.specialty_score > 0) reasons.push(`Specialty signal: ${row.specialty_signal}`);
  reasons.push(`Trust score: ${safeRound(row.trust_score)}`);
  reasons.push(`Capability score: ${safeRound(row.capability_score)}`);
  return reasons;
}

function formatResult(row, semanticInfo) {
  const profile = cleanEmbedText(row.facility_profile_text ?? '');
  const snippet = profile.length > 600 ? profile.slice(0, 600) + '…' : profile;
  return {
    facility_id: row.facility_id,
    name: cleanString(row.name),
    location: {
      city: cleanString(row.address_city),
      state: cleanString(row.address_stateOrRegion),
      pin_code: cleanString(row.address_zipOrPostcode),
      latitude: row.latitude == null ? null : Number(row.latitude),
      longitude: row.longitude == null ? null : Number(row.longitude),
    },
    facility_type: cleanString(row.facility_type),
    scores: {
      final_score: safeRound(row.final_score),
      trust_score: safeRound(row.trust_score),
      capability_score: safeRound(row.capability_score),
      query_match_score: safeRound(row.query_match_score),
      distance_km: safeRound(row.distance_km),
      semantic_score: safeRound(semanticInfo?.score),
    },
    signals: {
      emergency: cleanString(row.emergency_signal),
      surgery: cleanString(row.surgery_signal),
      critical_care: cleanString(row.critical_care_signal),
      diagnostic: cleanString(row.diagnostic_signal),
      maternal_neonatal: cleanString(row.maternal_neonatal_signal),
      specialty: cleanString(row.specialty_signal),
    },
    risk_flags: row.risk_flags ?? [],
    explanation: buildExplanation(row),
    evidence_snippet: snippet,
    semantic: semanticInfo
      ? {
          matched: true,
          score: safeRound(semanticInfo.score),
          excerpt: semanticInfo.excerpt ?? null,
        }
      : null,
  };
}

// The embed_text column is a concatenation of structured fields with `|`
// separators and JSON-array literals (e.g. `["internalMedicine"] | [] | ...`).
// Strip the syntax noise before excerpting so the user sees readable prose.
function cleanEmbedText(raw) {
  if (raw == null) return '';
  let s = String(raw);
  s = s.replace(/\[\s*\]/g, '');
  s = s.replace(/\[((?:\s*"[^"]*"\s*,?\s*)+)\]/g, (_, inner) => {
    const parts = [...inner.matchAll(/"([^"]*)"/g)].map((m) => m[1]).filter(Boolean);
    return parts.join(', ');
  });
  s = s.replace(/\s*\|\s*/g, ' · ');
  s = s.replace(/\s+/g, ' ').trim();
  // Collapse runs of separator/comma/whitespace caused by emptied JSON arrays
  s = s.replace(/(?:\s*[·,]\s*){2,}/g, ' · ');
  s = s.replace(/^[·,\s]+/, '').replace(/[·,\s]+$/, '');
  return s;
}

function bestExcerpt(rawText, queryWords, maxLen = 220) {
  const text = cleanEmbedText(rawText);
  if (!text) return null;
  const lower = text.toLowerCase();
  let bestIdx = -1;
  let bestWord = '';
  for (const w of queryWords) {
    if (w.length < 3) continue;
    const idx = lower.indexOf(w);
    if (idx !== -1 && (bestIdx === -1 || idx < bestIdx)) {
      bestIdx = idx;
      bestWord = w;
    }
  }
  if (bestIdx === -1) return text.slice(0, maxLen) + (text.length > maxLen ? '…' : '');
  const start = Math.max(0, bestIdx - 60);
  const end = Math.min(text.length, bestIdx + bestWord.length + 160);
  return (start > 0 ? '…' : '') + text.slice(start, end) + (end < text.length ? '…' : '');
}

export async function runHealthcareAgent({ query, userLat, userLon, topK = MAX_RESULTS, tracker, signal } = {}) {
  if (!query || typeof query !== 'string') throw new Error('query is required');

  const trace = tracker ?? { stageStart() {}, stageEnd() {}, addTokens() {} };

  trace.stageStart('parse');
  const parsed = await parseQuery(query);
  trace.stageEnd('parse');

  // ── Semantic candidate retrieval (Mosaic AI Vector Search) ──────────────
  // Run vector search in parallel with parsing-derived SQL filters to get
  // candidate facility_ids whose unstructured profile text matches the query.
  let semanticCandidates = [];
  let semanticById = new Map();
  const queryWords = query.toLowerCase().split(/\W+/).filter(Boolean);

  trace.stageStart('vector_search');
  try {
    if (LOCAL_MODE) {
      const vs = localVectorSearch(query, { numResults: VS_CANDIDATE_POOL });
      semanticCandidates = vs.items ?? [];
    } else if (isVectorSearchEnabled()) {
      const vs = await vectorSearch(query, { numResults: VS_CANDIDATE_POOL });
      semanticCandidates = vs.items ?? [];
    }
    for (const item of semanticCandidates) {
      if (item.facility_id == null) continue;
      semanticById.set(Number(item.facility_id), {
        score: item.score ?? null,
        excerpt: bestExcerpt(item.embed_text, queryWords),
      });
    }
  } catch (err) {
    if (err.name !== 'AbortError') {
      console.warn('[runHealthcareAgent] vector search skipped:', err.message);
    }
  } finally {
    trace.stageEnd('vector_search');
  }
  const semanticIds = [...semanticById.keys()];

  const intentTerms = [];
  if (parsed.needs_emergency) intentTerms.push('(COALESCE(emergency_score, 0) / 3.0) * 0.20');
  if (parsed.needs_surgery) intentTerms.push('(COALESCE(surgery_score, 0) / 3.0) * 0.22');
  if (parsed.needs_diagnostics) intentTerms.push('(COALESCE(diagnostic_score, 0) / 3.0) * 0.18');
  if (parsed.needs_critical_care) intentTerms.push('(COALESCE(critical_care_score, 0) / 3.0) * 0.25');
  if (parsed.needs_maternal) intentTerms.push('(COALESCE(maternal_neonatal_score, 0) / 3.0) * 0.15');
  if (parsed.needs_specialty) intentTerms.push('(COALESCE(specialty_score, 0) / 3.0) * 0.15');

  const queryMatchExpr =
    intentTerms.length > 0 ? `(${intentTerms.join(' + ')})` : 'COALESCE(overall_facility_score, 0)';

  const hasUserLoc = userLat != null && userLon != null;
  const distanceExpr = hasUserLoc
    ? `6371.0 * 2.0 * ASIN(SQRT(
        POWER(SIN((RADIANS(CAST(latitude AS DOUBLE)) - RADIANS(:userLat)) / 2), 2) +
        COS(RADIANS(:userLat)) * COS(RADIANS(CAST(latitude AS DOUBLE))) *
        POWER(SIN((RADIANS(CAST(longitude AS DOUBLE)) - RADIANS(:userLon)) / 2), 2)
      ))`
    : 'NULL';

  const distanceScoreExpr = hasUserLoc
    ? `CASE
        WHEN distance_km IS NULL THEN 0.3
        WHEN distance_km <= 10 THEN 1.0
        WHEN distance_km <= 25 THEN 0.8
        WHEN distance_km <= 50 THEN 0.6
        WHEN distance_km <= 100 THEN 0.4
        ELSE 0.2
      END`
    : '0.5';

  const whereClauses = [];
  const namedParameters = {};

  if (parsed.location_text) {
    whereClauses.push(
      '(lower(address_city) LIKE :loc OR lower(address_stateOrRegion) LIKE :loc OR lower(CAST(address_zipOrPostcode AS STRING)) LIKE :loc)'
    );
    namedParameters.loc = `%${String(parsed.location_text).toLowerCase()}%`;
  }
  if (hasUserLoc) {
    namedParameters.userLat = Number(userLat);
    namedParameters.userLon = Number(userLon);
  }

  // If semantic search returned candidates, restrict the SQL to those facility_ids
  // (hybrid retrieval: semantic recall, structured ranking).
  if (semanticIds.length > 0) {
    const idList = semanticIds.map((id) => Number(id)).filter(Number.isFinite).join(', ');
    whereClauses.push(`facility_id IN (${idList})`);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
  // Hard cap at MAX_RESULTS regardless of what the parser pulled out — keeps
  // the chat focused, lets the verifier audit every result, keeps cost low.
  const requested = Number(parsed?.top_k);
  const effectiveTopK = Number.isFinite(requested) && requested > 0
    ? Math.max(1, Math.min(MAX_RESULTS, Math.round(requested)))
    : Math.max(1, Math.min(MAX_RESULTS, Number(topK) || MAX_RESULTS));
  const cap = effectiveTopK;

  const sql = `
    WITH base AS (
      SELECT *, ${distanceExpr} AS distance_km
      FROM ${TABLE}
      ${whereSql}
    ),
    scored AS (
      SELECT *,
        ${queryMatchExpr} AS query_match_score,
        ${distanceScoreExpr} AS distance_score
      FROM base
    )
    SELECT *,
      (query_match_score * 0.45 +
       COALESCE(trust_score, 0) * 0.25 +
       COALESCE(capability_score, 0) * 0.20 +
       distance_score * 0.10) AS final_score
    FROM scored
    ORDER BY final_score DESC
    LIMIT ${cap}
  `;

  trace.stageStart('sql_rank');
  const rows = LOCAL_MODE
    ? localRank({ parsed, semanticIds, userLat, userLon, topK: cap })
    : await runQuery(sql, { namedParameters });
  trace.stageEnd('sql_rank');

  const results = rows.map((row) => formatResult(row, semanticById.get(Number(row.facility_id))));

  // ── Self-verification pass (claim ↔ evidence consistency check) ─────────
  trace.stageStart('verify');
  const verifySummary = await verifyResults(results, { topN: VERIFY_TOP_N, signal });
  trace.stageEnd('verify');
  if (verifySummary.promptTokens || verifySummary.completionTokens) {
    trace.addTokens('verify', verifySummary.promptTokens, verifySummary.completionTokens);
  }

  return {
    query,
    parsed_query: parsed,
    result_count: rows.length,
    semantic_used: semanticIds.length > 0,
    semantic_pool: semanticIds.length,
    verified_count: verifySummary.verifiedCount,
    verified_total: verifySummary.totalChecked,
    chain_of_thought: {
      step_1_parse: {
        intents: Object.keys(parsed)
          .filter((k) => k.startsWith('needs_') && parsed[k])
          .map((k) => k.replace('needs_', '')),
        location: parsed.location_text ?? null,
        top_k: parsed.top_k ?? null,
      },
      step_2_semantic: {
        used: semanticIds.length > 0,
        candidates: semanticIds.length,
        pool_size: VS_CANDIDATE_POOL,
      },
      step_3_sql_rank: {
        where_clauses: whereClauses.length,
        location_filtered: Boolean(parsed.location_text),
        scored_signals: intentTerms.length,
        result_count: rows.length,
        cap: effectiveTopK,
      },
      step_4_verify: {
        checked: verifySummary.totalChecked,
        verified: verifySummary.verifiedCount,
        rate: verifySummary.totalChecked
          ? Number((verifySummary.verifiedCount / verifySummary.totalChecked).toFixed(2))
          : null,
      },
    },
    results,
  };
}
