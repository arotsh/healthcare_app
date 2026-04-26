import { Router } from 'express';
import { runQuery } from '../db.js';
import { LOCAL_MODE, localListHospitals, localGetHospital } from '../services/localStore.js';

const router = Router();
const TABLE = process.env.DATABRICKS_TABLE;

if (!LOCAL_MODE && (!TABLE || !/^[\w]+\.[\w]+\.[\w]+$/.test(TABLE))) {
  throw new Error(
    `DATABRICKS_TABLE must be a fully qualified name like catalog.schema.table — got "${TABLE}"`
  );
}

const LIST_COLS = [
  'facility_id',
  'name',
  'address_city',
  'address_stateOrRegion',
  'latitude',
  'longitude',
  'specialties',
  'officialPhone',
  'officialWebsite',
  'engagement_metrics_n_followers',
];

const DETAIL_COLS = [
  ...LIST_COLS,
  'description',
  'address_line1',
  'address_line2',
  'address_line3',
  'address_zipOrPostcode',
  'address_country',
  'officialPhone',
  'officialWebsite',
  'phone_numbers',
  'websites',
  'email',
  'facebookLink',
  'twitterLink',
  'linkedinLink',
  'instagramLink',
  'procedure',
  'equipment',
  'capability',
  'numberDoctors',
  'capacity',
  'yearEstablished',
];

const cleanString = (v) => {
  if (v == null) return null;
  const s = String(v).trim();
  if (s === '' || s.toLowerCase() === 'null') return null;
  return s;
};

const toNumber = (v) => {
  const s = cleanString(v);
  if (s == null) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

const safeJsonArray = (v) => {
  const s = cleanString(v);
  if (s == null) return [];
  if (Array.isArray(v)) return v;
  try {
    const parsed = JSON.parse(s);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const mapListRow = (r) => ({
  id: r.facility_id,
  name: cleanString(r.name),
  city: cleanString(r.address_city),
  state: cleanString(r.address_stateOrRegion),
  lat: toNumber(r.latitude),
  lng: toNumber(r.longitude),
  specialties: safeJsonArray(r.specialties).slice(0, 5),
  phone: cleanString(r.officialPhone),
  website: cleanString(r.officialWebsite),
  followers: toNumber(r.engagement_metrics_n_followers),
});

const mapDetailRow = (r) => ({
  ...mapListRow(r),
  description: cleanString(r.description),
  address: [r.address_line1, r.address_line2, r.address_line3, r.address_zipOrPostcode, r.address_country]
    .map(cleanString)
    .filter(Boolean)
    .join(', '),
  phone: cleanString(r.officialPhone) ?? safeJsonArray(r.phone_numbers)[0] ?? null,
  website: cleanString(r.officialWebsite) ?? safeJsonArray(r.websites)[0] ?? null,
  email: cleanString(r.email),
  social: {
    facebook: cleanString(r.facebookLink),
    twitter: cleanString(r.twitterLink),
    linkedin: cleanString(r.linkedinLink),
    instagram: cleanString(r.instagramLink),
  },
  procedures: safeJsonArray(r.procedure),
  equipment: safeJsonArray(r.equipment),
  capabilities: safeJsonArray(r.capability),
  numberDoctors: cleanString(r.numberDoctors),
  capacity: cleanString(r.capacity),
  yearEstablished: cleanString(r.yearEstablished),
});

router.get('/', async (req, res, next) => {
  try {
    const limit = Math.max(1, Math.min(500, Number(req.query.limit) || 100));
    const offset = Math.max(0, Number(req.query.offset) || 0);
    const q = String(req.query.q ?? '').trim().slice(0, 100);

    if (LOCAL_MODE) {
      return res.json(localListHospitals({ q, limit, offset }));
    }

    const where = ['latitude IS NOT NULL', 'longitude IS NOT NULL'];
    const namedParameters = {};
    if (q) {
      where.push(`(
        lower(name) LIKE :q
        OR lower(address_city) LIKE :q
        OR lower(address_stateOrRegion) LIKE :q
      )`);
      namedParameters.q = `%${q.toLowerCase()}%`;
    }

    const whereSql = `WHERE ${where.join(' AND ')}`;
    const select = LIST_COLS.join(', ');

    const [items, totalRows] = await Promise.all([
      runQuery(
        `SELECT ${select} FROM ${TABLE} ${whereSql}
         ORDER BY name ASC
         LIMIT ${limit} OFFSET ${offset}`,
        { namedParameters }
      ),
      runQuery(`SELECT count(*) AS n FROM ${TABLE} ${whereSql}`, { namedParameters }),
    ]);

    res.json({
      items: items.map(mapListRow),
      total: Number(totalRows[0]?.n ?? 0),
      limit,
      offset,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });

    if (LOCAL_MODE) {
      const row = localGetHospital(id);
      if (!row) return res.status(404).json({ error: 'Not found' });
      return res.json(row);
    }

    const rows = await runQuery(
      `SELECT ${DETAIL_COLS.join(', ')} FROM ${TABLE} WHERE facility_id = :id LIMIT 1`,
      { namedParameters: { id } }
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(mapDetailRow(rows[0]));
  } catch (err) {
    next(err);
  }
});

export default router;
