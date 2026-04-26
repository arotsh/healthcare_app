// Genie-shaped local fallback. Inspects the question text, returns one of
// the canned aggregations over the bundled facilities. Output shape mirrors
// the real Genie response so the chat router and Insights panels don't care
// where it came from.

import { FACILITIES, STATE_COUNTS } from '../../data/facilities_demo.js';

export const isLocalMode = () => process.env.LOCAL_MODE === '1';

const round = (n) => Number(Number(n).toFixed(2));

function answerStateCount(direction = 'asc') {
  const rows = [...STATE_COUNTS.entries()]
    .map(([state, count]) => [state, count])
    .sort((a, b) => (direction === 'desc' ? b[1] - a[1] : a[1] - b[1]))
    .slice(0, 50);
  const dirWord = direction === 'desc' ? 'most' : 'fewest';
  return makeResult({
    answer: `${rows[0][0]} has the ${dirWord} hospitals in this dataset (${rows[0][1]}). Showing all ${rows.length} states ranked from ${dirWord} first.`,
    description: `Hospital count per Indian state, ${direction} order.`,
    columns: [
      { name: 'address_stateOrRegion', type: 'STRING' },
      { name: 'hospital_count', type: 'INT' },
    ],
    rows,
    sql: `SELECT address_stateOrRegion, COUNT(*) AS hospital_count\nFROM workspace.default.clean_facilities\nGROUP BY address_stateOrRegion\nORDER BY hospital_count ${direction.toUpperCase()}\nLIMIT 50`,
  });
}

function answerCityCount() {
  const m = new Map();
  for (const f of FACILITIES) {
    m.set(f.address_city, (m.get(f.address_city) || 0) + 1);
  }
  const rows = [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  return makeResult({
    answer: `${rows[0][0]} has the most hospitals (${rows[0][1]}) in this dataset.`,
    description: 'Top cities by hospital count.',
    columns: [
      { name: 'address_city', type: 'STRING' },
      { name: 'hospital_count', type: 'INT' },
    ],
    rows,
    sql: `SELECT address_city, COUNT(*) AS hospital_count\nFROM workspace.default.clean_facilities\nGROUP BY address_city\nORDER BY hospital_count DESC\nLIMIT 10`,
  });
}

function answerFacilityTypes() {
  const m = new Map();
  for (const f of FACILITIES) {
    m.set(f.facility_type, (m.get(f.facility_type) || 0) + 1);
  }
  const rows = [...m.entries()].sort((a, b) => b[1] - a[1]);
  return makeResult({
    answer: `The dataset has ${rows.length} facility types. ${rows[0][0]} is the most common (${rows[0][1]}).`,
    description: 'Breakdown of facilities by type.',
    columns: [
      { name: 'facility_type', type: 'STRING' },
      { name: 'count', type: 'INT' },
    ],
    rows,
    sql: `SELECT facility_type, COUNT(*) AS count\nFROM workspace.default.clean_facilities\nGROUP BY facility_type\nORDER BY count DESC`,
  });
}

function aggregateByState(scoreField, direction = 'asc') {
  const buckets = new Map();
  for (const f of FACILITIES) {
    const arr = buckets.get(f.address_stateOrRegion) || [];
    arr.push(f[scoreField] ?? 0);
    buckets.set(f.address_stateOrRegion, arr);
  }
  const rows = [...buckets.entries()]
    .map(([state, vals]) => [
      state,
      round(vals.reduce((a, b) => a + b, 0) / vals.length),
      vals.length,
    ])
    .sort((a, b) => (direction === 'desc' ? b[1] - a[1] : a[1] - b[1]))
    .slice(0, 10);
  return rows;
}

function answerTrustByState() {
  const rows = aggregateByState('trust_score', 'asc');
  return makeResult({
    answer: `Lowest average trust scores are in ${rows[0][0]} (avg ${rows[0][1]}).`,
    description: 'States ranked by lowest average trust score.',
    columns: [
      { name: 'address_stateOrRegion', type: 'STRING' },
      { name: 'avg_trust', type: 'DOUBLE' },
      { name: 'facility_count', type: 'INT' },
    ],
    rows,
    sql: `SELECT cf.address_stateOrRegion, AVG(fs.trust_score) AS avg_trust, COUNT(*) AS facility_count\nFROM clean_facilities cf JOIN facility_signals fs USING (facility_id)\nGROUP BY cf.address_stateOrRegion\nORDER BY avg_trust ASC\nLIMIT 10`,
  });
}

function answerMaternalByState() {
  const buckets = new Map();
  for (const f of FACILITIES) {
    const arr = buckets.get(f.address_stateOrRegion) || [];
    arr.push(f.maternal_neonatal_score ?? 0);
    buckets.set(f.address_stateOrRegion, arr);
  }
  const rows = [...buckets.entries()]
    .map(([state, vals]) => {
      const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
      return [state, round(avg), vals.length];
    })
    .sort((a, b) => a[1] - b[1])
    .slice(0, 10);
  return makeResult({
    answer: `Weakest maternal & neonatal coverage: ${rows[0][0]} (avg score ${rows[0][1]}).`,
    description: 'States ranked by lowest average maternal & neonatal coverage.',
    columns: [
      { name: 'address_stateOrRegion', type: 'STRING' },
      { name: 'avg_maternal_score', type: 'DOUBLE' },
      { name: 'facility_count', type: 'INT' },
    ],
    rows,
    sql: `SELECT cf.address_stateOrRegion, AVG(fs.maternal_neonatal_score) AS avg_maternal_score, COUNT(*) AS facility_count\nFROM clean_facilities cf JOIN facility_signals fs USING (facility_id)\nGROUP BY cf.address_stateOrRegion\nORDER BY avg_maternal_score ASC\nLIMIT 10`,
  });
}

function answerIcuCities() {
  const m = new Map();
  for (const f of FACILITIES) {
    if ((f.critical_care_score ?? 0) > 0) {
      m.set(f.address_city, (m.get(f.address_city) || 0) + 1);
    }
  }
  const rows = [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  return makeResult({
    answer: `${rows[0]?.[0] ?? 'No city'} has the most ICU-capable facilities (${rows[0]?.[1] ?? 0}).`,
    description: 'Cities with the most ICU-capable hospitals.',
    columns: [
      { name: 'address_city', type: 'STRING' },
      { name: 'icu_facility_count', type: 'INT' },
    ],
    rows,
    sql: `SELECT cf.address_city, COUNT(*) AS icu_facility_count\nFROM clean_facilities cf JOIN facility_signals fs USING (facility_id)\nWHERE fs.critical_care_score > 0\nGROUP BY cf.address_city\nORDER BY icu_facility_count DESC\nLIMIT 10`,
  });
}

function makeResult({ answer, description, columns, rows, sql }) {
  return {
    answer,
    description,
    sql,
    table: { columns, rows },
    conversation_id: `local-${Date.now()}`,
    message_id: `local-msg-${Date.now()}`,
  };
}

// Cheap intent classifier — string match against the panel texts.
export async function askGenieLocal(question) {
  const q = String(question ?? '').toLowerCase();

  const wantsState = /\bstate(s)?\b|\bregion(s)?\b/.test(q);
  const wantsCity = /\bcit(y|ies)\b/.test(q);
  const wantsType = /facility type|type of (facility|hospital)|breakdown.*type/.test(q);
  const wantsTrust = /trust score|trustworthy|reliab/.test(q);
  const wantsMaternal = /maternal|neonatal|maternity/.test(q);
  const wantsIcu = /icu|critical care|intensive/.test(q);
  const wantsLeast = /\b(fewest|lowest|least|weakest|smallest|underserved|desert)\b/.test(q);
  const wantsMost = /\b(most|highest|top|best|largest)\b/.test(q);

  if (wantsType) return answerFacilityTypes();
  if (wantsTrust) return answerTrustByState();
  if (wantsMaternal) return answerMaternalByState();
  if (wantsIcu) return answerIcuCities();
  if (wantsState) return answerStateCount(wantsLeast || !wantsMost ? 'asc' : 'desc');
  if (wantsCity) return answerCityCount();

  // Default — overall hospital count by state, fewest first
  return answerStateCount('asc');
}
