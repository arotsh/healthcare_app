// Single source of truth for LLM calls. Routes through Groq when USE_GROQ=1
// (or when the Databricks Foundation Model API is unavailable / quota-exhausted).
// Both providers speak OpenAI-compatible chat completions, so the interface
// is identical — only the endpoint, auth, and model name change.

const {
  USE_GROQ,
  DATABRICKS_AGENT_URL,
  DATABRICKS_AGENT_MODEL,
  DATABRICKS_TOKEN,
  GROQ_API_KEY,
  GROQ_MODEL,
  // Generic OpenAI-compatible escape hatch — works for OpenRouter,
  // Together, Anyscale, OpenAI itself, vLLM behind your own URL, etc.
  LLM_URL,
  LLM_API_KEY,
  LLM_MODEL,
} = process.env;

const FORCE_GROQ = USE_GROQ === '1';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL_NAME = GROQ_MODEL || 'llama-3.3-70b-versatile';

export function llmProvider() {
  // Highest priority: explicit generic LLM_URL — overrides everything.
  if (LLM_URL && LLM_API_KEY) {
    return {
      name: 'custom',
      url: LLM_URL,
      token: LLM_API_KEY,
      model: LLM_MODEL || 'gpt-4o-mini',
    };
  }
  if (FORCE_GROQ || !DATABRICKS_AGENT_URL || !DATABRICKS_TOKEN) {
    if (!GROQ_API_KEY) throw new Error('No LLM provider available — set GROQ_API_KEY, LLM_API_KEY, or DATABRICKS_TOKEN');
    return { name: 'groq', url: GROQ_URL, token: GROQ_API_KEY, model: GROQ_MODEL_NAME };
  }
  return {
    name: 'databricks',
    url: DATABRICKS_AGENT_URL,
    token: DATABRICKS_TOKEN,
    model: DATABRICKS_AGENT_MODEL,
  };
}

/**
 * OpenAI-compatible chat completion. Returns { content, promptTokens, completionTokens, raw, provider }.
 * Throws on any non-OK response.
 */
export async function chatCompletion({ messages, temperature = 0.2, maxTokens = 600, signal } = {}) {
  const p = llmProvider();
  const res = await fetch(p.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${p.token}`,
    },
    body: JSON.stringify({
      model: p.model,
      messages,
      temperature,
      max_tokens: maxTokens,
    }),
    signal,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${p.name} ${res.status}: ${text.slice(0, 240)}`);
  }
  const data = await res.json();
  return {
    content: data?.choices?.[0]?.message?.content ?? '',
    promptTokens: data?.usage?.prompt_tokens ?? 0,
    completionTokens: data?.usage?.completion_tokens ?? 0,
    raw: data,
    provider: p.name,
  };
}
