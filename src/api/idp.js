export async function runIdpExtraction({ count = 3, signal } = {}) {
  const res = await fetch('/api/idp/extract', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ count }),
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
    throw new Error(data.error || `IDP error ${res.status}`);
  }
  return data;
}
