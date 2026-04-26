// Live in-browser IDP demo — pulls random facilities from clean_facilities,
// asks Llama 3.3 70B to extract structured signals matching the Virtue
// Foundation pydantic schema (mirrored as JS validation here), and returns
// the parsed + validated result with timing and token usage.
//
// Deliberately self-contained: no Python notebook required, no server-side
// pydantic. Runs on every chat request the user triggers from the UI.

import { chatCompletion } from './llm.js';

const EVIDENCE_LEVELS = new Set(['strong', 'medium', 'weak', 'none']);
const CAPABILITY_KEYS = [
  'emergency',
  'surgery',
  'critical_care',
  'diagnostic',
  'maternal_neonatal',
  'specialty',
];

const SCHEMA_DESCRIPTION = `{
  "capabilities": {
    "emergency":         { "level": "strong"|"medium"|"weak"|"none", "quote": "<verbatim substring or empty>", "confidence": 0.0..1.0 },
    "surgery":           { ...same shape... },
    "critical_care":     { ...same shape... },
    "diagnostic":        { ...same shape... },
    "maternal_neonatal": { ...same shape... },
    "specialty":         { ...same shape... }
  },
  "infrastructure": {
    "has_power_backup": true|false|null,
    "has_water_supply": true|false|null,
    "has_ambulance":    true|false|null,
    "bed_count":              integer|null,
    "icu_bed_count":          integer|null,
    "operating_theatre_count":integer|null
  },
  "staffing": {
    "doctor_count":     integer|null,
    "nurse_count":      integer|null,
    "has_specialists":  true|false|null,
    "specialist_types": ["string", ...]
  },
  "risk_flags": ["short_tag", ...],
  "overall_evidence_strength": "strong"|"medium"|"weak"|"none",
  "notes": "string"
}`;

const EXTRACTION_SYSTEM = `You are a medical facility data extractor for an NGO planning system.

You receive the unstructured profile text for ONE Indian healthcare facility. Extract structured signals as RAW JSON matching the schema. RULES:

1. Every EvidenceField MUST include a verbatim quote substring of the source text. If level="none", quote="".
2. NEVER fabricate. If the source does not support a fact, mark level="none" or set the field to null.
3. Numeric fields (bed_count, doctor_count, etc.): only fill in if a specific number appears in the source. Otherwise null.
4. risk_flags: short tags like "no_power_backup", "license_expired", "equipment_broken", "staff_shortage". Only include if explicitly stated.
5. capabilities[*].level rubric:
   - "strong": explicitly mentioned AND specific
   - "medium": mentioned but vague
   - "weak": inferred from related context
   - "none": no mention
6. Return RAW JSON only. No markdown, no commentary.`;

function cleanJson(raw) {
  const s = String(raw).trim().replace(/```json/gi, '').replace(/```/g, '').trim();
  const m = s.match(/\{[\s\S]*\}/);
  return m ? m[0] : s;
}

function validateExtraction(obj) {
  const errors = [];
  if (!obj || typeof obj !== 'object') {
    errors.push('not an object');
    return errors;
  }
  if (!obj.capabilities || typeof obj.capabilities !== 'object') {
    errors.push('missing capabilities');
  } else {
    for (const k of CAPABILITY_KEYS) {
      const f = obj.capabilities[k];
      if (!f || typeof f !== 'object') {
        errors.push(`missing capabilities.${k}`);
        continue;
      }
      if (!EVIDENCE_LEVELS.has(f.level)) errors.push(`bad capabilities.${k}.level`);
      if (typeof f.quote !== 'string') errors.push(`bad capabilities.${k}.quote`);
      if (typeof f.confidence !== 'number') {
        // Coerce missing confidence to 0 rather than failing
        f.confidence = 0;
      }
    }
  }
  if (!obj.infrastructure || typeof obj.infrastructure !== 'object') {
    errors.push('missing infrastructure');
  }
  if (!obj.staffing || typeof obj.staffing !== 'object') {
    errors.push('missing staffing');
  }
  if (!Array.isArray(obj.risk_flags)) errors.push('risk_flags must be array');
  if (!EVIDENCE_LEVELS.has(obj.overall_evidence_strength)) {
    errors.push('bad overall_evidence_strength');
  }
  return errors;
}

const callLlama = (messages, signal) =>
  chatCompletion({ messages, temperature: 0, maxTokens: 1400, signal });

/**
 * Extract structured signals from one facility's profile text.
 * Returns:
 *   {
 *     extraction:           the parsed JSON (or null on failure),
 *     validation_errors:    [],
 *     latency_ms,
 *     prompt_tokens,
 *     completion_tokens,
 *     parse_error?:         message if JSON parse failed,
 *   }
 */
export async function extractOne({ facility_id, source_text }, { signal } = {}) {
  const started = Date.now();
  const userMsg = `facility_id: ${facility_id}

source text:
"""
${(source_text ?? '').slice(0, 5000)}
"""

Return JSON matching this schema:
${SCHEMA_DESCRIPTION}`;

  let llm;
  try {
    llm = await callLlama(
      [
        { role: 'system', content: EXTRACTION_SYSTEM },
        { role: 'user', content: userMsg },
      ],
      signal
    );
  } catch (err) {
    return {
      extraction: null,
      validation_errors: [],
      parse_error: err.message,
      latency_ms: Date.now() - started,
      prompt_tokens: 0,
      completion_tokens: 0,
    };
  }

  let extraction = null;
  let parse_error = null;
  try {
    extraction = JSON.parse(cleanJson(llm.content));
  } catch (e) {
    parse_error = e.message;
  }

  const validation_errors = extraction ? validateExtraction(extraction) : [];

  return {
    extraction,
    validation_errors,
    parse_error,
    latency_ms: Date.now() - started,
    prompt_tokens: llm.promptTokens,
    completion_tokens: llm.completionTokens,
  };
}

export const IDP_SCHEMA_DESCRIPTION = SCHEMA_DESCRIPTION;
