import { Router } from 'express';
import { runHealthcareAgent } from '../services/healthcareAgent.js';
import { startChatRun, isMlflowEnabled } from '../services/mlflow.js';
import { askGenie, isGenieEnabled } from '../services/genie.js';
import { askGenieLocal, isLocalMode } from '../services/genieLocal.js';
import { chatCompletion } from '../services/llm.js';

const router = Router();

const {
  DATABRICKS_TOKEN,
  DATABRICKS_HOST,
  DATABRICKS_BRICKS_AGENT_ENDPOINT,
} = process.env;

const BRICKS_HOST = (DATABRICKS_HOST || '').replace(/^https?:\/\//, '').replace(/\/.*$/, '');
const BRICKS_AGENT_URL = DATABRICKS_BRICKS_AGENT_ENDPOINT && BRICKS_HOST
  ? `https://${BRICKS_HOST}/serving-endpoints/${encodeURIComponent(DATABRICKS_BRICKS_AGENT_ENDPOINT)}/invocations`
  : null;

async function callBricksAgent({ messages, signal }) {
  const res = await fetch(BRICKS_AGENT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${DATABRICKS_TOKEN}`,
    },
    body: JSON.stringify({ messages: messages.map(({ role, content }) => ({ role, content })) }),
    signal,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Bricks agent ${res.status}: ${text.slice(0, 200)}`);
  }
  const data = await res.json();
  // ChatAgent responses come back with messages[] + custom_outputs.
  const lastMsg = data?.messages?.[data.messages.length - 1] ?? data?.choices?.[0]?.message;
  return {
    reply: lastMsg?.content ?? '(no reply)',
    agentResponse: data?.custom_outputs ?? null,
    raw: data,
  };
}

const MAX_CLARIFICATIONS = 3;

const SUMMARY_SYSTEM = `You are MediBot, a healthcare facility finder for India.
You're given the JSON output of a structured healthcare agent that already searched a Databricks-hosted facility directory.

Output a markdown reply with:
1. A one-sentence intro describing what was found.
2. A bulleted list of facilities. For each:
   - **Bold facility name** (markdown bold)
   - City, State · Score X.XX · Status
   - Status = "Verified" if final_score ≥ 0.5 AND no risk_flags; "⚠ Caution" if final_score < 0.5 OR risk_flags has any entry; "Data Incomplete" if key fields are missing.
3. After the top result, add a short "Trust Note" line citing one short quote from evidence_snippet (under 20 words).

Sorting:
- "Best/top/highest/most" → DESCENDING by final_score (highest first)
- "Worst/lowest" → ASCENDING by final_score (lowest first)
- Default → DESCENDING

Risk flags / verification:
- If a result has risk_flags, mention the FIRST flag inline (e.g. "⚠ no power backup evidence")
- For surgery/ICU claims with capability_score < 0.4 → label "Data Incomplete: Capability cannot be verified"
- Never invent equipment, staff, ratings, or capabilities not in the JSON

Emergency reminder:
- If parsed_query.needs_emergency = true OR query mentions trauma/urgent: open with "🚑 Call 102 (ambulance) or 108 (emergency) immediately."

Empty results:
- If result_count = 0: ask user to broaden (different city or specialty). Do not invent results.

Length:
- Max 3 bullet points (the agent caps results at 3). Max 150 words total.
- No headings, no extra commentary.

Multilingual:
- Detect the user's language and write the reply in it.
- Hospital names, score numbers, and phone numbers stay as-is in English/digits.
- Markdown formatting (** bold, - bullets) is universal.`;

const CRISIS_BLOCK = `📞 **KIRAN Mental Health Helpline**: [1800-599-0019](tel:18005990019) — 24×7, free
📞 **Vandrevala Foundation**: [+91 9999 666 555](tel:+919999666555)
📞 **AASRA**: [+91 9820466726](tel:+919820466726)`;

const DECISION_SYSTEM = `You are MediBot, a healthcare facility finder for India.

Output ONE of SIX things, in this priority order:
1. CRISIS: <message>  — user shows signs of self-harm, suicide, or severe psychological distress
2. ANALYTICS           — aggregate / statistical / "how many"-style question about the facility data
3. SEARCH              — recommend specific facilities for a person's medical need
4. REDIRECT: <message> — query is off-topic, harmful, or asks for direct medical advice
5. A short clarifying question (max 15 words) — on-topic but missing intent or location
6. (never output anything else)

═══ CRISIS DETECTION (HARD REDLINE — overrides everything else) ═══
Trigger if the user mentions ANY of these without a physical-injury context:
- Self-harm intent: "cutting myself", "I want to hurt myself", "kill myself", "end my life", "want to die", "suicide", "no reason to live", "ending it"
- Self-mutilation language: "cut off my arm/leg/limb" without an accident or surgical context
- Severe hopelessness: "no hope", "can't go on", "at the end of my rope" with emotional tone

When triggered, output exactly the template below, written in the SAME language the user just used (English stays English, Hindi stays Hindi, etc. — do NOT translate to Hindi if the user wrote in English):

CRISIS: I hear how much pain you are in, and I want to make sure you have the right support immediately.

${CRISIS_BLOCK}

You can also go to the nearest emergency room — would you like me to help find one near you?

The helpline phone numbers, the markdown formatting, and the "tel:" links MUST remain unchanged regardless of language.

═══ METAPHOR RULE ═══
Many emotional phrases are metaphors, NOT physical symptoms. Examples:
- "I can't breathe" alone → ambiguous → ask: "Are you having a physical breathing emergency, or feeling overwhelmed?"
- "I'm drowning", "I'm about to burst", "at the end of my rope", "drowning in pain" → emotional metaphor → CRISIS or clarify
- Treat as physical only if the user adds a body-part / injury / accident description ("I can't breathe, my chest was hit").

═══ ANALYTICS vs SEARCH ═══
ANALYTICS = aggregate questions over the WHOLE dataset, not a single-person recommendation.
- Use ANALYTICS for: "how many hospitals in Karnataka", "average bed count by state", "top 5 cities with most ICUs", "what percentage of facilities have power backup", "list states ranked by trust score", "which city has the highest hospital density"
- Use SEARCH for: "find me a hospital for cardiac surgery in Bangalore", "I need an ICU near me", "show 3 best maternity centers in Pune"
- If unclear → SEARCH (the safer default for a person seeking care)

═══ SCOPE / PILOT RULE (REDIRECT cases) ═══
You are STRICTLY a medical facility locator for India. Refuse politely for:
- Non-medical: jokes, math, weather, recipes, careers ("how to become a pilot"), coding help, opinions
- Direct medical advice ("what medicine should I take", "is this serious", "diagnose me")
- Harmful/illegal/dangerous content
- Personal info collection

REDIRECT message format (in user's language): "I apologize, but I am specialized only in helping you locate medical facilities across India. I cannot assist with [topic]. Is there a hospital or clinic I can help you find instead?"

Do not try to map non-medical topics to medical categories.

═══ SEARCH REQUIREMENTS ═══
Need BOTH:
- Medical need (emergency, surgery, ICU, diagnostics, maternity, specialty, condition, body part, procedure)
- Location: Indian city/state OR userLocation:true

═══ CLARIFY ═══
- Only if on-topic but missing intent or location
- Don't repeat questions already asked
- After 3 clarifications, output SEARCH
- Don't ask for location if userLocation:true

═══ OUTPUT RULES ═══
- ONLY one of: CRISIS: <msg> | ANALYTICS | SEARCH | REDIRECT: <msg> | a clarifying question
- NO quotes, NO preamble, NO commentary
- The control prefixes "CRISIS:", "ANALYTICS", "SEARCH", "REDIRECT:" stay in English
- Everything AFTER a colon (the message text) is in the user's language

═══ MULTILINGUAL ═══
Match the exact language of the user's most recent message — if they wrote in English, respond in English. If Hindi, respond in Hindi. Do not translate or switch languages.
Supported: Hindi, Hinglish, Bengali, Tamil, Telugu, Marathi, Gujarati, Kannada, Malayalam, Punjabi, Urdu, English.
Understand Indian cities in Latin or native script (मुंबई = Mumbai, কলকাতা = Kolkata).`;

function buildContextLine({ hasLocation, clarifyCount }) {
  return `Context:\n- userLocation: ${hasLocation ? 'true' : 'false'}\n- clarifications_so_far: ${clarifyCount} of ${MAX_CLARIFICATIONS}`;
}

// Thin wrapper retained for call-site compatibility — delegates to the shared
// llm.js so chat, verify, and IDP all speak the same provider abstraction.
const callLlama = chatCompletion;

async function decideAction({ messages, hasLocation, clarifyCount, signal, tracker }) {
  if (clarifyCount >= MAX_CLARIFICATIONS) {
    return { action: 'search', reason: 'max_reached' };
  }

  tracker.stageStart('decide');
  let llm;
  try {
    llm = await callLlama({
      messages: [
        { role: 'system', content: `${DECISION_SYSTEM}\n\n${buildContextLine({ hasLocation, clarifyCount })}` },
        ...messages,
      ],
      temperature: 0.2,
      maxTokens: 320,
      signal,
    });
  } catch (err) {
    tracker.stageEnd('decide');
    console.warn('[decideAction]', err.message);
    return { action: 'search', reason: 'decision_error' };
  }
  tracker.stageEnd('decide');
  tracker.addTokens('decide', llm.promptTokens, llm.completionTokens);

  const raw = (llm.content ?? '').trim();
  const text = raw.replace(/^["'`]+|["'`]+$/g, '').trim();
  if (!text) return { action: 'search', reason: 'empty_decision' };

  const crisisMatch = text.match(/^\s*CRISIS\s*[:\-]\s*([\s\S]+)$/i);
  if (crisisMatch) return { action: 'crisis', message: crisisMatch[1].trim() };

  const redirectMatch = text.match(/^\s*REDIRECT\s*[:\-]\s*([\s\S]+)$/i);
  if (redirectMatch) return { action: 'redirect', message: redirectMatch[1].trim() };

  if (/^analytics\b/i.test(text) || text.toUpperCase() === 'ANALYTICS') {
    return { action: 'analytics', reason: 'llm_decided' };
  }

  if (/^search\b/i.test(text) || text.toUpperCase() === 'SEARCH') {
    return { action: 'search', reason: 'llm_decided' };
  }

  return { action: 'clarify', question: text };
}

async function summarize({ query, agentResponse, signal, tracker }) {
  const prompt = `User query: "${query}"\n\nAgent output:\n${JSON.stringify(agentResponse, null, 2)}`;
  tracker.stageStart('summarize');
  try {
    const llm = await callLlama({
      messages: [
        { role: 'system', content: SUMMARY_SYSTEM },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      maxTokens: 600,
      signal,
    });
    tracker.addTokens('summarize', llm.promptTokens, llm.completionTokens);
    return llm.content || null;
  } catch (err) {
    console.warn('[summarize]', err.message);
    return null;
  } finally {
    tracker.stageEnd('summarize');
  }
}

const isValidUserMessage = (m) =>
  m && typeof m === 'object' && ['user', 'assistant'].includes(m.role) && typeof m.content === 'string';

router.post('/', async (req, res, next) => {
  let tracker = { enabled: false, stageStart() {}, stageEnd() {}, addTokens() {}, traceUrl() { return null; }, async finish() {} };

  try {
    const messages = Array.isArray(req.body?.messages) ? req.body.messages : null;
    if (!messages || messages.length === 0 || !messages.every(isValidUserMessage)) {
      return res.status(400).json({ error: 'Body must be { messages: [{role, content}] }' });
    }

    const userLat = req.body?.userLat ?? null;
    const userLon = req.body?.userLon ?? null;
    const hasLocation = userLat != null && userLon != null;
    const clarifyCount = Math.max(0, Math.min(MAX_CLARIFICATIONS, Number(req.body?.clarifyCount) || 0));
    const genieConversationId =
      typeof req.body?.genieConversationId === 'string' && req.body.genieConversationId.trim()
        ? req.body.genieConversationId.trim()
        : null;

    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    if (!lastUser?.content?.trim()) {
      return res.status(400).json({ error: 'No user message found' });
    }

    if (isMlflowEnabled()) {
      tracker = await startChatRun({
        runName: 'medimap-chat',
        query: lastUser.content,
        hasLocation,
        clarifyCount,
      });
    }

    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 120_000);

    try {
      const decision = await decideAction({
        messages,
        hasLocation,
        clarifyCount,
        signal: ctrl.signal,
        tracker,
      });

      if (decision.action === 'crisis') {
        await tracker.finish({ action: 'crisis' });
        return res.json({
          reply: decision.message,
          agent: null,
          isCrisis: true,
          isClarification: false,
          isRedirect: false,
          isAnalytics: false,
          clarifyCount: 0,
          trace_url: tracker.traceUrl(),
        });
      }

      if (decision.action === 'redirect') {
        await tracker.finish({ action: 'redirect' });
        return res.json({
          reply: decision.message,
          agent: null,
          isClarification: false,
          isRedirect: true,
          isCrisis: false,
          isAnalytics: false,
          clarifyCount: 0,
          trace_url: tracker.traceUrl(),
        });
      }

      if (decision.action === 'clarify') {
        await tracker.finish({ action: 'clarify' });
        return res.json({
          reply: decision.question,
          agent: null,
          isClarification: true,
          isRedirect: false,
          isCrisis: false,
          isAnalytics: false,
          clarifyCount: clarifyCount + 1,
          trace_url: tracker.traceUrl(),
        });
      }

      // ── ANALYTICS branch — Genie (Databricks) or local fallback ────────
      if (decision.action === 'analytics') {
        const useLocal = isLocalMode() || !isGenieEnabled();
        if (!useLocal || isLocalMode()) {
          tracker.stageStart('genie');
          try {
            const genie = useLocal
              ? await askGenieLocal(lastUser.content)
              : await askGenie(lastUser.content, {
                  signal: ctrl.signal,
                  conversationId: genieConversationId,
                });
            tracker.stageEnd('genie');
            await tracker.finish({
              action: 'analytics',
              resultCount: genie?.table?.rows?.length ?? 0,
            });
            return res.json({
              reply: genie.answer || genie.description || 'Genie returned a result.',
              agent: null,
              genie: {
                sql: genie.sql,
                description: genie.description,
                table: genie.table,
                conversation_id: genie.conversation_id,
                message_id: genie.message_id,
              },
              isClarification: false,
              isRedirect: false,
              isCrisis: false,
              isAnalytics: true,
              clarifyCount: 0,
              trace_url: tracker.traceUrl(),
            });
          } catch (err) {
            tracker.stageEnd('genie');
            console.warn('[chat] Genie failed, falling back to search:', err.message);
            // fall through to search
          }
        }
      }

      // ── SEARCH branch — Agent Bricks endpoint OR local orchestration ────
      const userContext = messages
        .filter((m) => m.role === 'user')
        .map((m) => m.content.trim())
        .filter(Boolean)
        .join('. ');

      let reply = null;
      let agentResponse = null;
      let usedBricks = false;

      if (BRICKS_AGENT_URL) {
        tracker.stageStart('bricks_agent');
        try {
          const out = await callBricksAgent({ messages, signal: ctrl.signal });
          tracker.stageEnd('bricks_agent');
          reply = out.reply;
          agentResponse = out.agentResponse;
          usedBricks = true;
        } catch (err) {
          tracker.stageEnd('bricks_agent');
          console.warn('[chat] Bricks endpoint failed, falling back to local orchestration:', err.message);
        }
      }

      if (!usedBricks) {
        tracker.stageStart('healthcare_agent');
        agentResponse = await runHealthcareAgent({
          query: userContext,
          userLat,
          userLon,
          topK: 3,
          tracker,
          signal: ctrl.signal,
        });
        tracker.stageEnd('healthcare_agent');

        reply = await summarize({
          query: userContext,
          agentResponse,
          signal: ctrl.signal,
          tracker,
        });
        if (!reply) {
          reply =
            agentResponse.result_count === 0
              ? "I couldn't find any matches. Try a different city, condition, or specialty."
              : `Found ${agentResponse.result_count} matches — top result: ${agentResponse.results[0]?.name ?? 'unnamed'}.`;
        }
      }

      await tracker.finish({
        action: usedBricks ? 'search_bricks' : 'search',
        parsedIntent: agentResponse?.parsed_query?.priority?.join(',') || 'general',
        topK: agentResponse?.parsed_query?.top_k ?? null,
        semanticUsed: Boolean(agentResponse?.semantic_used),
        semanticPool: agentResponse?.semantic_pool ?? 0,
        resultCount: agentResponse?.result_count ?? agentResponse?.results?.length ?? 0,
        verifiedCount: agentResponse?.verified_count ?? 0,
        verifiedTotal: agentResponse?.verified_total ?? 0,
      });

      res.json({
        reply,
        agent: agentResponse,
        servedBy: usedBricks ? 'bricks' : 'local',
        isClarification: false,
        isRedirect: false,
        isCrisis: false,
        isAnalytics: false,
        clarifyCount: 0,
        trace_url: tracker.traceUrl(),
      });
    } finally {
      clearTimeout(timeout);
    }
  } catch (err) {
    await tracker.finish({ action: 'error', errorMessage: err.message });
    if (err.name === 'AbortError') {
      return res.status(504).json({ error: 'Agent timed out' });
    }
    console.error('[chat error]', err);
    next(err);
  }
});

export default router;
