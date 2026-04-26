# MediMap India

> **Verified, auditable, multilingual healthcare facility intelligence — for individuals seeking care and NGOs planning interventions across India.**

Built natively on Databricks: **Agent Bricks** for serving, **Genie** for autonomous SQL, **MLflow 3** for cost & observability, **Mosaic AI Vector Search** for semantic recall over 10,000 facility profiles. Deployed as a **Lakehouse App**.

---

## What's in the box

| Surface | What it does |
| --- | --- |
| **Landing page** (`/`) | Browse the 10K-facility directory, search, view on a custom map, drill into details. |
| **AI Assistant** (`/chat`) | Multilingual (12 Indian languages + English) facility recommender with self-verification, voice input/output, crisis protocol, and a fully visible chain of thought. |
| **NGO Insights** (`/insights`) | Medical-desert dashboard: state-by-state heatmap + 6 Genie-powered analytical panels with auditable SQL. |

## Architecture

```
   ┌────────── Lakehouse App ──────────┐
   │   React UI  ⇆  Express backend    │
   └─────┬──────────────────┬──────────┘
         │ /api/chat        │ /api/genie
         ▼                  ▼
   ┌───────────┐      ┌──────────┐
   │  agent    │      │  Genie   │
   │  router   │      │  space   │
   └─┬─┬─┬─┬─┬─┘      └────┬─────┘
     │ │ │ │ │              │
     │ │ │ │ └─► verifier (claim ↔ evidence)
     │ │ │ └───► Mosaic Vector Search (semantic top-50)
     │ │ └─────► weighted SQL ranking (Databricks SQL warehouse)
     │ └───────► Llama 3.3 70B summarizer
     └─────────► Llama 3.3 70B decision router
                          │
                          └─► every step traced in MLflow 3
                              (latency, tokens, cost, verification rate)
```

## Quick start

```bash
yarn install:all
cp backend/.env.example backend/.env  # fill in DATABRICKS_*, GROQ_API_KEY
yarn dev                              # frontend :5173, backend :3001
```

## Documentation

| File | Purpose |
| --- | --- |
| [DEPLOY.md](DEPLOY.md) | End-to-end Databricks deployment, rubric mapping, verification checklist |
| [SPEECH.md](SPEECH.md) | 2:30 demo speech with stage directions and reserve lines |
| [docs/genie_space_setup.md](docs/genie_space_setup.md) | Drop-in instructions to paste into your Genie space |
| [notebooks/medimap_idp_extraction.py](notebooks/medimap_idp_extraction.py) | IDP pipeline — pydantic-validated structured extraction with provenance |
| [notebooks/medimap_agent_bricks.py](notebooks/medimap_agent_bricks.py) | Mosaic Agent Framework wrapper + UC registration + Model Serving deploy |
| [notebooks/medimap_dlt_pipeline.py](notebooks/medimap_dlt_pipeline.py) | DLT bronze → silver → gold ingest pipeline |
| [backend/eval/](backend/eval/) | 30-case offline eval harness with MLflow run logging |

## Rubric coverage

| Criterion | Weight | Where it lives |
| --- | ---: | --- |
| Discovery & Verification | 35% | [`backend/src/services/verifier.js`](backend/src/services/verifier.js) — every SEARCH gets a second-pass LLM judge over top results, with verbatim source quotes. `verification_rate` logged to MLflow. |
| IDP Innovation | 30% | [`notebooks/medimap_idp_extraction.py`](notebooks/medimap_idp_extraction.py) — Virtue Foundation pydantic schema, source-grounded extraction, self-consistency check. |
| Social Impact | 25% | `/insights` page: live medical-desert heatmap + 6 Genie analytics panels for NGO planners. |
| UX & Transparency | 10% | [`src/components/ChainOfThought.jsx`](src/components/ChainOfThought.jsx) — every assistant message has a 4-step reasoning trace; every chat reply links to its MLflow run. |

## License

Hackathon project. Code unrestricted; underlying medical-facility dataset belongs to its respective owners.
