# MediMap — Deploy guide

End-to-end deploy on Databricks: Vector Search → DLT → Agent Bricks → Lakehouse App, with MLflow tracing + Genie analytics + an offline eval harness.

## Rubric mapping

| Criterion | Weight | What addresses it |
| --- | ---: | --- |
| **Discovery & Verification** — agents that double-check their own work | 35% | [verifier.js](backend/src/services/verifier.js) runs a second-pass LLM judge over the top-N ranked results, comparing claimed capabilities against `evidence_snippet`. Output: `{verified, confidence, supporting_quote, concerns, verdict}` per facility, surfaced as the green/orange "Self-verified" badge under each card. `verification_rate` is logged to MLflow on every chat. The IDP notebook ([medimap_idp_extraction.py](notebooks/medimap_idp_extraction.py)) adds a second-pass *consistency check* on every extraction. |
| **IDP Innovation** — synthesizing messy free-form Indian notes | 30% | [medimap_idp_extraction.py](notebooks/medimap_idp_extraction.py) defines a strict **Virtue Foundation pydantic schema** (`FacilityExtraction` with `CapabilitySignals`, `Infrastructure`, `Staffing`), runs Llama 3.3 70B with a strict source-grounded prompt, validates with pydantic, and writes `facility_extracted_signals` Delta with **per-field verbatim quotes** as provenance. MLflow logs `extraction_rate` + `consistency_rate`. |
| **Social Impact & Utility** — medical deserts, NGO planners | 25% | [/insights page](src/pages/InsightsPage.jsx) — a dedicated NGO planner dashboard with four Genie-powered panels: states with fewest hospitals, lowest trust scores, ICU concentration, weakest maternal coverage. Every panel exposes the underlying SQL for auditability. Crisis protocol + medical-desert rule are wired into the chat router. |
| **UX & Transparency** — chain of thought | 10% | [ChainOfThought.jsx](src/components/ChainOfThought.jsx) — every assistant message has a "Show chain of thought" expander showing the four reasoning steps (parse → semantic retrieval → SQL ranking → self-verification) with concrete numbers. Every chat reply also links to its **MLflow trace**. |


## Architecture at a glance

```
┌────────────────────┐      ┌──────────────────┐      ┌─────────────────────┐
│  Lakehouse App     │ ───▶ │  Backend (Node)  │ ───▶ │  Foundation model   │
│  (React + Express) │      │   chat router    │      │  Llama 3.3 70B      │
└────────────────────┘      └──────────────────┘      └─────────────────────┘
                                    │
        ┌───────────────────────────┼───────────────────────────────┐
        ▼                           ▼                               ▼
┌────────────────┐         ┌────────────────┐              ┌────────────────┐
│ Mosaic Vector  │         │ Genie space    │              │ MLflow exp.    │
│ Search index   │         │ (text-to-SQL)  │              │ (runs + cost)  │
└────────────────┘         └────────────────┘              └────────────────┘
        ▲                                                          ▲
        │                                                          │
┌──────────────────────────────────────┐                            │
│ DLT pipeline (bronze → silver →      │     ┌─────────────────────┴────┐
│ clean_facilities → facilities_for_   │     │ Agent Bricks notebook    │
│ search)                              │     │ (registers + deploys)    │
└──────────────────────────────────────┘     └──────────────────────────┘
```

## One-time setup

### 1. Unity Catalog tables
The backend reads `workspace.default.facility_signals` (scored, joined) and `workspace.default.clean_facilities`. Make sure your token user has SELECT on both.

### 2. DLT pipeline (refresh story)
- Open [notebooks/medimap_dlt_pipeline.py](notebooks/medimap_dlt_pipeline.py) in your workspace.
- Workflows → Delta Live Tables → Create pipeline → point at this notebook → catalog `workspace`, schema `default` → run once.
- Drop new facility records into `/Volumes/workspace/default/medimap/raw/` and the pipeline auto-loads them into bronze → silver → `clean_facilities` → `facilities_for_search`.

### 3. Mosaic AI Vector Search index
- Endpoint: `medimap_vs`
- Index: `workspace.default.clean_facilities_vs_index`
- Source: `workspace.default.facilities_for_search` (created by the DLT pipeline above)
- Embedding column: `embed_text`
- Embedding model: `databricks-gte-large-en`
- Wait for status `ONLINE` (10–20 min for first sync).

### 4. Genie space
- Already created at `01f140d6f5be18759b1461d0872c5779`.
- Make sure `clean_facilities` is attached and the space is **published**.

### 5. MLflow experiment
Auto-created on first chat request at `/Users/arayikdev@gmail.com/medimap-traces`. No manual step.

### 6. Agent Bricks (optional but recommended)
- Open [notebooks/medimap_agent_bricks.py](notebooks/medimap_agent_bricks.py).
- Run cells 1–5 (install, define agent, sanity-test, log + register to UC).
- Cell 6 calls `databricks.agents.deploy(...)`. If your workspace allows it, you'll get a serving endpoint name.
- Set `DATABRICKS_BRICKS_AGENT_ENDPOINT=<endpoint name>` in the Lakehouse App env. The backend will route SEARCH traffic through it; falls back to local orchestration on error.

### 7. IDP extraction (Virtue Foundation schema)
- Open [notebooks/medimap_idp_extraction.py](notebooks/medimap_idp_extraction.py).
- Run cells 1–5 to extract structured signals from a 20-row sample with full pydantic validation + per-field provenance + a self-consistency LLM judge. MLflow logs `extraction_rate` and `consistency_rate`.
- Flip `RUN_FULL_EXTRACTION = True` in cell 6 to do the full 10K. Estimated cost: $5–15 in Llama tokens.
- Output: `workspace.default.facility_extracted_signals` with one column per signal + matching `_quote` column for the verbatim source citation.

## Running locally

```bash
# Once
yarn install:all

# Dev (frontend on :5173, backend on :3001, hot reload)
yarn dev
```

## Running the eval harness

```bash
# Backend must be running
yarn eval

# Subset / custom backend
EVAL_LIMIT=5 yarn eval
API_BASE=https://medimap-xyz.cloud.databricks.app yarn eval
```

Results are logged as a new MLflow run inside the same experiment. Tagged `kind=evaluation` so you can filter from chat traces.

## Deploying as a Lakehouse App

```bash
# 1. Build the frontend (committed to dist/ for deploy)
yarn build

# 2. Stage the project to your workspace
databricks workspace import-dir . /Workspace/Users/<you>/medimap

# 3. Create or update the app
databricks apps deploy medimap \
  --source-code-path /Workspace/Users/<you>/medimap

# 4. Configure secrets in the Apps UI:
#    - medimap-secrets/databricks_host
#    - medimap-secrets/databricks_token
#    - medimap-secrets/databricks_http_path
#    - medimap-secrets/groq_api_key
#    (referenced from app.yaml via valueFrom)
```

The app server reads `DATABRICKS_APP_PORT` automatically and serves both `/api/*` and the React bundle. After deploy, hit the app URL — same UI as local, but production-served.

## Verifying everything works

| Check                          | How                                                                 |
| ------------------------------ | ------------------------------------------------------------------- |
| Vector Search online           | "Find a MAKO robotic knee surgery hospital" → see Semantic match badge |
| MLflow tracing                 | Any chat → click "MLflow trace" link below the assistant message    |
| Self-verification              | Any SEARCH query → look for green "Self-verified · confidence X%" badge under each card |
| Chain of Thought               | Any SEARCH query → click "Show chain of thought" → see the 4-step reasoning trace |
| Genie analytics                | "How many hospitals are in each state?" → see Genie panel + SQL     |
| Multi-turn Genie               | After above, ask "now break that down by city" — same conversation  |
| NGO Insights page              | Visit `/insights` → 4 Genie-powered medical-desert panels load      |
| IDP pipeline                   | Run cells 1–5 of `medimap_idp_extraction.py` → MLflow shows `extraction_rate` and `consistency_rate` |
| Agent Bricks routing           | Set `DATABRICKS_BRICKS_AGENT_ENDPOINT`, look for `servedBy: "bricks"` in API response |
| Eval accuracy                  | `yarn eval` → action accuracy ≥ 90% on the 30-case set              |
| Crisis protocol                | "I want to end my life" → red bubble with helplines                 |
| Pilot rule                     | "Help me write Python" → polite refusal                             |

## Troubleshooting

- **"Endpoint creation with provisioned throughput is not supported"** — your tier rejects `agents.deploy`. Skip cell 6 of the Bricks notebook and keep using local orchestration; everything else still works.
- **Genie returns `FAILED`** — open the space, confirm `clean_facilities` is attached and the space is **published** (not draft).
- **Vector search returns empty** — index is still in `PROVISIONING_ENDPOINT` or `INDEXING`. Check `/api/2.0/vector-search/indexes/{name}` until `ready=true`.
- **App won't start on Databricks** — the start script runs `vite build` if `dist/` is missing. Pre-build locally and commit `dist/` if you want to skip the build at deploy time.
