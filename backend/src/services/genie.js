// Databricks Genie integration — for analytical / aggregate questions
// like "how many hospitals in Karnataka?" or "states with most ICU beds".
// Genie generates SQL against the configured space and returns results.

const { DATABRICKS_HOST, DATABRICKS_TOKEN, DATABRICKS_GENIE_SPACE_ID } = process.env;

const GENIE_ENABLED = Boolean(DATABRICKS_HOST && DATABRICKS_TOKEN && DATABRICKS_GENIE_SPACE_ID);

const host = (DATABRICKS_HOST || '').replace(/^https?:\/\//, '').replace(/\/.*$/, '');
const baseUrl = host ? `https://${host}` : '';

const POLL_INTERVAL_MS = 1500;
const POLL_TIMEOUT_MS = 90_000;

export function isGenieEnabled() {
  return GENIE_ENABLED;
}

async function genieFetch(path, { method = 'GET', body, signal } = {}) {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${DATABRICKS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
    signal,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Genie ${path} ${res.status}: ${text.slice(0, 240)}`);
  }
  return res.json();
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const TERMINAL_STATUSES = new Set(['COMPLETED', 'FAILED', 'CANCELLED', 'QUERY_RESULT_EXPIRED']);

async function pollMessage({ spaceId, conversationId, messageId, signal }) {
  const start = Date.now();
  while (Date.now() - start < POLL_TIMEOUT_MS) {
    if (signal?.aborted) throw new Error('aborted');
    const message = await genieFetch(
      `/api/2.0/genie/spaces/${encodeURIComponent(spaceId)}/conversations/${encodeURIComponent(
        conversationId
      )}/messages/${encodeURIComponent(messageId)}`,
      { signal }
    );
    if (TERMINAL_STATUSES.has(message?.status)) return message;
    await sleep(POLL_INTERVAL_MS);
  }
  throw new Error('Genie poll timed out');
}

async function fetchQueryResult({ spaceId, conversationId, messageId, attachmentId, signal }) {
  try {
    return await genieFetch(
      `/api/2.0/genie/spaces/${encodeURIComponent(spaceId)}/conversations/${encodeURIComponent(
        conversationId
      )}/messages/${encodeURIComponent(messageId)}/query-result/${encodeURIComponent(attachmentId)}`,
      { signal }
    );
  } catch (err) {
    console.warn('[genie] query-result fetch failed:', err.message);
    return null;
  }
}

function parseStatementResult(qr) {
  const sr = qr?.statement_response;
  if (!sr) return { columns: [], rows: [] };
  const columns = sr?.manifest?.schema?.columns?.map((c) => ({ name: c.name, type: c.type_text })) ?? [];
  const rows = sr?.result?.data_array ?? [];
  return { columns, rows };
}

/**
 * Ask Genie an analytical question. Returns:
 *   { answer, sql, description, table: { columns, rows }, conversation_id, message_id }
 *
 * Pass `conversationId` to continue an existing thread (Genie carries
 * context across turns, so follow-ups like "now break that down by city"
 * will reuse the prior SQL). When omitted, a new conversation is started.
 *
 * Throws if Genie is not configured / fails.
 */
export async function askGenie(question, { signal, conversationId } = {}) {
  if (!GENIE_ENABLED) {
    throw new Error('Genie not configured (DATABRICKS_GENIE_SPACE_ID missing)');
  }
  if (!question || typeof question !== 'string') {
    throw new Error('question is required');
  }

  const spaceId = DATABRICKS_GENIE_SPACE_ID;

  let convId = conversationId ?? null;
  let messageId = null;

  if (convId) {
    const followup = await genieFetch(
      `/api/2.0/genie/spaces/${encodeURIComponent(spaceId)}/conversations/${encodeURIComponent(
        convId
      )}/messages`,
      { method: 'POST', body: { content: question }, signal }
    );
    messageId = followup?.message_id ?? followup?.message?.id;
  } else {
    const started = await genieFetch(
      `/api/2.0/genie/spaces/${encodeURIComponent(spaceId)}/start-conversation`,
      { method: 'POST', body: { content: question }, signal }
    );
    convId = started?.conversation_id ?? started?.conversation?.id;
    messageId = started?.message_id ?? started?.message?.id;
  }

  if (!convId || !messageId) {
    throw new Error('Genie did not return conversation/message id');
  }

  const message = await pollMessage({ spaceId, conversationId: convId, messageId, signal });
  if (message?.status !== 'COMPLETED') {
    const err = message?.error?.error || message?.status || 'unknown';
    throw new Error(`Genie failed: ${err}`);
  }

  const attachments = message?.attachments ?? [];
  const textAttachment = attachments.find((a) => a.text);
  const queryAttachment = attachments.find((a) => a.query);

  const answer = textAttachment?.text?.content ?? null;
  const sql = queryAttachment?.query?.query ?? null;
  const description = queryAttachment?.query?.description ?? null;

  let table = { columns: [], rows: [] };
  if (queryAttachment?.attachment_id) {
    const qr = await fetchQueryResult({
      spaceId,
      conversationId: convId,
      messageId,
      attachmentId: queryAttachment.attachment_id,
      signal,
    });
    if (qr) table = parseStatementResult(qr);
  }

  return {
    answer,
    sql,
    description,
    table,
    conversation_id: convId,
    message_id: messageId,
  };
}
