# MediMap — Vercel Deployment

End-to-end deploy of MediMap to Vercel: static React app + one serverless Express function for `/api/*`.

> **Heads up — Databricks free-tier daily quota:** the SQL warehouse, Foundation Model API, and Mosaic AI Vector Search share a single daily compute quota on Community Edition. When it's exhausted you'll see *"Databricks free-tier daily quota exhausted"* in a banner across the app. Quota refreshes ~midnight UTC. Upgrade to Standard tier to remove the cap.

## Two run modes

| Mode | Env flags | Where data comes from | When to use |
| --- | --- | --- | --- |
| **Live mode** (default) | `LOCAL_MODE=0` | Databricks SQL warehouse + Mosaic AI Vector Search + FM API for Llama | Production / when quota is healthy |
| **Demo mode** | `LOCAL_MODE=1`, `USE_GROQ=1` (or `LLM_URL`+`LLM_API_KEY`) | Bundled `backend/data/facilities_demo.js` (50 facilities) + Groq/OpenAI for Llama | When Databricks quota is exhausted, OR for rapid local dev / demos |

Both modes share the same chat router, verifier, IDP route, and Genie integration. Demo mode swaps the data + LLM provider via env flags — no code changes.

### Switching between modes

In Vercel's environment variables UI:

```
# Live mode (Databricks)
LOCAL_MODE=0
USE_GROQ=0
DATABRICKS_HOST=...
DATABRICKS_TOKEN=...
[etc]

# Demo mode (offline)
LOCAL_MODE=1
USE_GROQ=1
GROQ_API_KEY=...
```

If Groq's daily quota is also exhausted, plug in any OpenAI-compatible provider:

```
LLM_URL=https://openrouter.ai/api/v1/chat/completions
LLM_API_KEY=sk-or-v1-...
LLM_MODEL=meta-llama/llama-3.3-70b-instruct
```

OpenRouter gives \$5 free on signup — covers thousands of demo runs.

---

## Architecture on Vercel

```
   ┌─────────────────────────────────┐
   │  vercel.app domain              │
   ├─────────────────────────────────┤
   │  /                  → /dist     │  ← Vite-built React, served as static
   │  /chat              → /dist     │
   │  /insights          → /dist     │
   ├─────────────────────────────────┤
   │  /api/chat          ┐           │
   │  /api/genie         │           │
   │  /api/idp/extract   ├─→ /api/[...path].js  (serverless function,
   │  /api/hospitals     │            wraps Express via serverless-http)
   │  /api/health        ┘           │
   └─────────────────────────────────┘
```

A single Vercel serverless function at [api/[...path].js](api/[...path].js) catches every `/api/*` request and routes it through the existing Express app exported from [backend/src/server.js](backend/src/server.js). One cold start, one warm function, all routes share state.

## Pre-flight checklist

- [ ] You have a Vercel account (free works, but Pro recommended — see "Function timeout" below)
- [ ] Vercel CLI installed: `npm i -g vercel` (or use the web dashboard)
- [ ] Frontend builds locally: `yarn build` produces `dist/`
- [ ] Backend boots locally: `yarn dev` works at <http://localhost:5173>

## Function timeout — important

The chat path runs decide → vector search → SQL ranking → verify (3× parallel) → summarize. Total: **10–20s on warm cache, 20–30s cold**. The Vercel free tier caps functions at **10s** — every chat will time out.

**Solutions:**
- **Vercel Pro** ($20/month): 60s timeout. Recommended for live demos.
- **Vercel Hobby** with simplified pipeline: skip the verifier (`VERIFY_TOP_N=0` env var), drop verification badges. Each chat runs in ~5–8s. Works on free tier.

Set `maxDuration` is already 60s in [vercel.json](vercel.json) — Vercel ignores it on Hobby tier.

## Step-by-step deploy

### 1. Verify build works

```bash
yarn install
yarn build
ls dist/index.html  # should exist
```

### 2. Set environment variables

In the Vercel dashboard → your project → Settings → Environment Variables, add:

| Variable | Value (yours) |
|---|---|
| `DATABRICKS_HOST` | `dbc-822c98e3-262c.cloud.databricks.com` |
| `DATABRICKS_TOKEN` | your PAT |
| `DATABRICKS_HTTP_PATH` | `/sql/1.0/warehouses/c97006fe61977e51` |
| `DATABRICKS_TABLE` | `workspace.default.clean_facilities` |
| `DATABRICKS_AGENT_URL` | `https://dbc-822c98e3-262c.cloud.databricks.com/serving-endpoints/databricks-meta-llama-3-3-70b-instruct/invocations` |
| `DATABRICKS_AGENT_MODEL` | `databricks-meta-llama-3-3-70b-instruct` |
| `DATABRICKS_AGENT_TABLE` | `workspace.default.facility_signals` |
| `GROQ_API_KEY` | `gsk_…` |
| `DATABRICKS_VS_ENDPOINT` | `medimap_vs` |
| `DATABRICKS_VS_INDEX` | `workspace.default.clean_facilities_vs_index` |
| `MLFLOW_EXPERIMENT_PATH` | `/Users/arayikdev@gmail.com/medimap-traces` |
| `DATABRICKS_GENIE_SPACE_ID` | `01f140d6f5be18759b1461d0872c5779` |

Set each for **Production**, **Preview**, and **Development** scopes.

### 3. Deploy

**Option A — CLI (recommended for first deploy):**

```bash
vercel
```

It'll ask:
- Link to existing project? → No, create new
- Project name? → `medimap` (or whatever)
- Override settings? → No (vercel.json is correct)

After ~2 minutes you'll get a preview URL like `medimap-abc123.vercel.app`. Visit it and confirm the UI loads.

**Option B — GitHub integration:**

```bash
git init
git add .
git commit -m "init"
gh repo create medimap --private --source=. --push
# Then in Vercel UI: Add New Project → Import from GitHub → select medimap → Deploy
```

### 4. Promote to production

```bash
vercel --prod
```

Or in the dashboard: Deployments tab → ⋯ on the preview build → Promote to Production.

### 5. Verify

After deploy, visit your production URL and run through the smoke test:

| Check | URL | Expected |
|---|---|---|
| Static frontend | `/` | Landing page loads |
| Chat (warm) | `/chat`, ask "Find an ICU in Bihar" | 3 results with verification badges, in <30s |
| Chat (Hindi) | `/chat`, ask "मुझे दिल्ली में आईसीयू वाला अस्पताल चाहिए" | Replies in Hindi |
| Genie | `/chat`, ask "How many hospitals per state?" | Genie panel with SQL + table |
| NGO Insights | `/insights` | Desert heatmap + IDP demo button + 6 panels |
| Live IDP | `/insights` → "Run extraction" | 3 cards with structured fields + quotes |
| Health | `/api/health` | `{"ok":true}` |

If any of these fail with a yellow banner *"Databricks free-tier daily quota exhausted"*, that's the daily quota issue — wait for refresh or upgrade tier.

## Local Vercel emulation

```bash
vercel dev
```

Runs the production build locally with the same serverless function shape. Useful for catching environment-specific bugs before deploying.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Yellow banner "free-tier daily quota exhausted" | Databricks Community Edition quota hit | Wait for ~midnight UTC refresh, or upgrade to Standard tier |
| Chat returns "504 Gateway Timeout" | Vercel free tier 10s function cap | Upgrade to Pro, OR set `VERIFY_TOP_N=0` to skip verification |
| `/api/*` returns 404 | `vercel.json` missing or `api/[...path].js` missing | Confirm both exist; redeploy |
| `serverless-http is not a function` | Dependency missing | `yarn install` then redeploy |
| MLflow trace links return 401 | Token doesn't have workspace access | Use a PAT generated by a workspace admin |
| Genie panels show "no column" errors | `facility_signals` not attached to space | See [docs/genie_space_setup.md](docs/genie_space_setup.md) |

## Demo mode (no Databricks)

If you need to demo while quota is exhausted:
1. **Pre-record** the demo when quota is fresh (best option for a live presentation).
2. **Screenshot fallback** for /insights and /chat — keep PDFs ready as backup.
3. **Record + replay**: Vercel deploys the UI either way, but warn the audience the live data is rate-limited.
