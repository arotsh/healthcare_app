const BASE = '/api/hospitals';

async function jsonFetch(url, opts = {}) {
  const res = await fetch(url, opts);
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`API ${res.status}: ${body || res.statusText}`);
  }
  return res.json();
}

export function listHospitals({ q = '', limit = 100, offset = 0, signal } = {}) {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  params.set('limit', String(limit));
  params.set('offset', String(offset));
  return jsonFetch(`${BASE}?${params.toString()}`, { signal });
}

export function getHospital(id, { signal } = {}) {
  return jsonFetch(`${BASE}/${encodeURIComponent(id)}`, { signal });
}
