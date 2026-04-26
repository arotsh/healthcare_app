// In-memory replacements for SQL warehouse + Vector Search + Genie when
// LOCAL_MODE=1. Backed by backend/data/facilities_demo.js. Used during demos
// when the Databricks free-tier quota is exhausted; same downstream contract
// as the real services so nothing else has to change.

import { FACILITIES } from '../../data/facilities_demo.js';

export const LOCAL_MODE = process.env.LOCAL_MODE === '1';

const tokenize = (s) =>
  String(s ?? '')
    .toLowerCase()
    .split(/\W+/)
    .filter((w) => w.length >= 3);

// ── 1. Vector-search-shaped recall (keyword overlap on profile text) ────
export function localVectorSearch(queryText, { numResults = 50 } = {}) {
  const qTokens = tokenize(queryText);
  if (qTokens.length === 0) {
    return { items: [], skipped: 'empty_query' };
  }

  const scored = FACILITIES.map((f) => {
    const haystack = `${f.name} ${f.address_city} ${f.address_stateOrRegion} ${f.facility_type} ${f.facility_profile_text}`.toLowerCase();
    let score = 0;
    for (const t of qTokens) {
      const re = new RegExp(`\\b${t}\\b`, 'gi');
      const matches = haystack.match(re);
      if (matches) score += matches.length;
    }
    return {
      facility_id: f.facility_id,
      name: f.name,
      address_city: f.address_city,
      address_stateOrRegion: f.address_stateOrRegion,
      latitude: f.latitude,
      longitude: f.longitude,
      embed_text: f.facility_profile_text,
      score: score / Math.max(qTokens.length, 1),
    };
  })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, numResults);

  return { items: scored, skipped: null };
}

// ── 2. Healthcare ranking (mirrors the SQL weighted scoring in JS) ──────
function haversineKm(lat1, lon1, lat2, lon2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

const distScore = (km) => {
  if (km == null) return 0.5;
  if (km <= 10) return 1.0;
  if (km <= 25) return 0.8;
  if (km <= 50) return 0.6;
  if (km <= 100) return 0.4;
  return 0.2;
};

export function localRank({ parsed, semanticIds = [], userLat, userLon, topK = 3 }) {
  const wantsLat = userLat != null && userLon != null;
  const semSet = new Set(semanticIds.map(Number));

  let rows = FACILITIES.slice();

  // location filter
  if (parsed?.location_text) {
    const loc = String(parsed.location_text).toLowerCase();
    rows = rows.filter(
      (f) =>
        f.address_city?.toLowerCase().includes(loc) ||
        f.address_stateOrRegion?.toLowerCase().includes(loc) ||
        String(f.address_zipOrPostcode ?? '').toLowerCase().includes(loc)
    );
  }

  // semantic candidate filter
  if (semSet.size > 0) {
    rows = rows.filter((f) => semSet.has(Number(f.facility_id)));
  }

  // weighted ranking — mirrors the SQL formula in healthcareAgent.js
  const intentTerms = [];
  const addIntent = (flag, scoreField, weight) => {
    if (parsed?.[flag]) intentTerms.push((f) => ((f[scoreField] ?? 0) / 3) * weight);
  };
  addIntent('needs_emergency', 'emergency_score', 0.20);
  addIntent('needs_surgery', 'surgery_score', 0.22);
  addIntent('needs_diagnostics', 'diagnostic_score', 0.18);
  addIntent('needs_critical_care', 'critical_care_score', 0.25);
  addIntent('needs_maternal', 'maternal_neonatal_score', 0.15);
  addIntent('needs_specialty', 'specialty_score', 0.15);

  const queryMatch = (f) => {
    if (intentTerms.length === 0) return f.overall_facility_score ?? 0;
    return intentTerms.reduce((sum, fn) => sum + fn(f), 0);
  };

  const scored = rows.map((f) => {
    const km = wantsLat ? haversineKm(userLat, userLon, f.latitude, f.longitude) : null;
    const qm = queryMatch(f);
    const ds = distScore(km);
    const final = qm * 0.45 + (f.trust_score ?? 0) * 0.25 + (f.capability_score ?? 0) * 0.20 + ds * 0.10;
    return {
      ...f,
      distance_km: km == null ? null : Number(km.toFixed(1)),
      query_match_score: Number(qm.toFixed(3)),
      final_score: Number(final.toFixed(3)),
    };
  });

  scored.sort((a, b) => b.final_score - a.final_score);

  // honor parsed top_k (capped at 3 by upstream)
  const cap = Math.max(1, Math.min(3, Number(parsed?.top_k) || topK));
  return scored.slice(0, cap);
}

// ── 3. IDP sampler ──────────────────────────────────────────────────────
export function sampleFacilitiesForIdp(count = 3) {
  const richEnough = FACILITIES.filter(
    (f) => f.facility_profile_text && f.facility_profile_text.length > 200
  );
  const shuffled = richEnough.slice().sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count).map((f) => ({
    facility_id: f.facility_id,
    name: f.name,
    address_city: f.address_city,
    address_stateOrRegion: f.address_stateOrRegion,
    facility_profile_text: f.facility_profile_text,
  }));
}

// ── 4. Hospitals listing ────────────────────────────────────────────────
export function localListHospitals({ q = '', limit = 100, offset = 0 } = {}) {
  const needle = String(q ?? '').toLowerCase().trim();
  let rows = FACILITIES;
  if (needle) {
    rows = rows.filter(
      (f) =>
        f.name?.toLowerCase().includes(needle) ||
        f.address_city?.toLowerCase().includes(needle) ||
        f.address_stateOrRegion?.toLowerCase().includes(needle)
    );
  }
  const total = rows.length;
  const items = rows.slice(offset, offset + limit).map((f) => ({
    id: f.facility_id,
    name: f.name,
    city: f.address_city,
    state: f.address_stateOrRegion,
    lat: f.latitude,
    lng: f.longitude,
    specialties: deriveSpecialties(f),
    phone: null,
    website: null,
    followers: null,
  }));
  return { items, total, limit, offset };
}

export function localGetHospital(id) {
  const f = FACILITIES.find((x) => Number(x.facility_id) === Number(id));
  if (!f) return null;
  return {
    id: f.facility_id,
    name: f.name,
    city: f.address_city,
    state: f.address_stateOrRegion,
    lat: f.latitude,
    lng: f.longitude,
    specialties: deriveSpecialties(f),
    phone: null,
    website: null,
    description: f.facility_profile_text,
    address: [f.address_city, f.address_stateOrRegion, f.address_zipOrPostcode].filter(Boolean).join(', '),
    social: { facebook: null, twitter: null, linkedin: null, instagram: null },
    procedures: [],
    equipment: [],
    capabilities: deriveSpecialties(f),
    numberDoctors: null,
    capacity: null,
    yearEstablished: null,
  };
}

function deriveSpecialties(f) {
  const out = [];
  if (f.emergency_score >= 2) out.push('Emergency');
  if (f.surgery_score >= 2) out.push('Surgery');
  if (f.critical_care_score >= 2) out.push('Critical Care');
  if (f.diagnostic_score >= 2) out.push('Diagnostics');
  if (f.maternal_neonatal_score >= 2) out.push('Maternity');
  if (f.specialty_score >= 2) out.push('Specialty');
  return out;
}
