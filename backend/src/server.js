import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import hospitalsRouter from './routes/hospitals.js';
import chatRouter from './routes/chat.js';
import genieRouter from './routes/genie.js';
import idpRouter from './routes/idp.js';

const app = express();

// Vercel sets VERCEL=1, Databricks Apps sets DATABRICKS_APP_PORT,
// Render sets RENDER=true. Each platform's port convention:
//   - Render injects PORT
//   - Databricks Apps injects DATABRICKS_APP_PORT
//   - local dev defaults to 3001
const PORT = Number(process.env.DATABRICKS_APP_PORT ?? process.env.PORT ?? 3001);
const IS_VERCEL = process.env.VERCEL === '1';
const IS_RENDER = process.env.RENDER === 'true' || Boolean(process.env.RENDER_SERVICE_NAME);
const IS_PRODUCTION =
  process.env.NODE_ENV === 'production' ||
  Boolean(process.env.DATABRICKS_APP_PORT) ||
  IS_VERCEL ||
  IS_RENDER;

// CORS_ORIGIN can be a comma-separated list — useful when frontend is on
// Vercel (preview + production URLs) and backend is on Render.
const CORS_ORIGIN = (process.env.CORS_ORIGIN ?? 'http://localhost:5173')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

function corsOrigin(origin, callback) {
  // Same-origin / non-browser requests have no Origin header — allow them.
  if (!origin) return callback(null, true);
  // Wildcard match for the Vercel preview pattern (e.g. medimap-india-abc123-arayiks-projects.vercel.app)
  if (CORS_ORIGIN.some((allowed) => origin === allowed || origin.endsWith('.vercel.app'))) {
    return callback(null, true);
  }
  return callback(new Error(`CORS: ${origin} not allowed`));
}

app.use(cors({ origin: IS_PRODUCTION ? corsOrigin : CORS_ORIGIN[0] }));
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/hospitals', hospitalsRouter);
app.use('/api/chat', chatRouter);
app.use('/api/genie', genieRouter);
app.use('/api/idp', idpRouter);

// On Databricks Apps the same Node process serves /dist; on Vercel the
// platform serves /dist directly so we skip this block.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distPath = path.resolve(__dirname, '../../dist');
if (IS_PRODUCTION && !IS_VERCEL && existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(distPath, 'index.html'));
  });
  console.log(`[server] serving frontend from ${distPath}`);
}

// Translate Databricks free-tier exhaustion into a friendlier 503 so the UI
// can surface a clear "quota exhausted" message instead of a generic 500.
function isQuotaExhausted(err) {
  const msg = String(err?.message ?? err?.response?.statusText ?? '').toLowerCase();
  return (
    msg.includes('free daily limit') ||
    msg.includes('community_edition_credit_exhausted') ||
    msg.includes('deny_new_and_existing_resources') ||
    msg.includes('cannot run or query foundation model')
  );
}

app.use((err, _req, res, _next) => {
  console.error('[api error]', err);
  if (isQuotaExhausted(err)) {
    return res.status(503).json({
      error: 'databricks_quota_exhausted',
      message:
        "Databricks free-tier daily compute quota is exhausted. The SQL warehouse, Foundation Model API, and Vector Search are all paused until the quota refreshes (typically ~midnight UTC). Upgrade to Standard tier to unblock immediately.",
    });
  }
  res.status(500).json({ error: err.message ?? 'Internal Server Error' });
});

// Only bind a port when running as a long-lived Node process. On Vercel the
// app is wrapped by serverless-http in /api/[...path].js — no listener needed.
if (!IS_VERCEL) {
  app.listen(PORT, () => {
    console.log(`MediMap API listening on http://localhost:${PORT}`);
  });
}

export default app;
