const { DATABRICKS_HOST, DATABRICKS_TOKEN, DATABRICKS_VS_INDEX } = process.env;

const VS_ENABLED = Boolean(DATABRICKS_HOST && DATABRICKS_TOKEN && DATABRICKS_VS_INDEX);

const DEFAULT_COLUMNS = [
  'facility_id',
  'name',
  'address_city',
  'address_stateOrRegion',
  'latitude',
  'longitude',
  'embed_text',
];

const host = (DATABRICKS_HOST || '').replace(/^https?:\/\//, '').replace(/\/.*$/, '');

export function isVectorSearchEnabled() {
  return VS_ENABLED;
}

/**
 * Run a similarity search against the Mosaic AI Vector Search index.
 * Returns rows like { facility_id, name, address_city, address_stateOrRegion, latitude, longitude, embed_text, score }.
 */
export async function vectorSearch(queryText, { numResults = 50, columns = DEFAULT_COLUMNS, signal } = {}) {
  if (!VS_ENABLED) return { items: [], skipped: 'not_configured' };
  if (!queryText || typeof queryText !== 'string') return { items: [], skipped: 'empty_query' };

  const url = `https://${host}/api/2.0/vector-search/indexes/${encodeURIComponent(DATABRICKS_VS_INDEX)}/query`;

  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${DATABRICKS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query_text: queryText,
        columns,
        num_results: Math.max(1, Math.min(200, Number(numResults) || 50)),
      }),
      signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    console.warn('[vectorSearch] fetch failed:', err.message);
    return { items: [], skipped: 'fetch_error', error: err.message };
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const detail = text.slice(0, 240);
    console.warn('[vectorSearch] non-OK', res.status, detail);
    if (res.status === 400 || res.status === 404 || res.status === 409 || res.status === 503) {
      return { items: [], skipped: `http_${res.status}`, error: detail };
    }
    return { items: [], skipped: 'http_error', error: detail };
  }

  const data = await res.json();
  const cols = data?.manifest?.columns?.map((c) => c.name) ?? [];
  const rows = data?.result?.data_array ?? [];

  const items = rows.map((row) => {
    const obj = {};
    cols.forEach((name, i) => {
      obj[name] = row[i];
    });
    // Databricks typically returns the score as the last column under '__db_score' or 'score'
    if (obj.score == null && obj.__db_score != null) obj.score = obj.__db_score;
    if (obj.score == null && row.length > cols.length) obj.score = row[row.length - 1];
    return obj;
  });

  return { items, skipped: null };
}
