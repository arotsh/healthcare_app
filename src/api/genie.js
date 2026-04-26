export async function askGenie(question, { signal, conversationId } = {}) {
  const res = await fetch('/api/genie', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, conversationId: conversationId ?? null }),
    signal,
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { error: text };
  }
  if (!res.ok) {
    if (data?.error === 'databricks_quota_exhausted') {
      window.dispatchEvent(new CustomEvent('quota:exhausted', { detail: { message: data.message } }));
      throw new Error(data.message || 'Databricks quota exhausted');
    }
    throw new Error(data.error || `Genie error ${res.status}`);
  }
  return data;
}
