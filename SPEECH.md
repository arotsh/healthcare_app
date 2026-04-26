# MediMap — Demo Speech

**Total: ~265 words · ~2:30 spoken**
Stage directions in [brackets] are actions you take, not lines you say.

---

### [0:00 — Hook · 25s]

India has 10,000 medical facilities. Their data is messy, inconsistent, often unverifiable. For NGO planners deciding where to invest — and for patients in emergencies — that gap costs lives.

**MediMap** turns this dataset into trusted, actionable answers for both audiences.

### [0:25 — Demo 1: Chat + Self-Verification · 75s]

Let me show you. [**Type:** *"I need an ICU hospital in Bihar."*]

Behind this single query, four steps run. I'll click **"Show chain of thought."** [click]

First, Llama parses intent and location. Second, **Mosaic AI Vector Search** retrieves fifty semantic candidates from ten thousand facility profiles. Third, a weighted SQL query ranks them. Fourth — and this is the key — the agent **re-checks its own answer.**

Each top result gets a self-verification badge: *"verified, 92% confidence,"* with the supporting quote lifted from the source text. Every claim is traceable to evidence.

### [1:40 — Demo 2: Genie · 30s]

Now something different. [**Type:** *"How many hospitals in each state, fewest first?"*]

This routes automatically to **Databricks Genie**, which writes its own SQL, runs it, and returns the answer with the query exposed for audit. [click "View generated SQL"]

### [2:10 — Demo 3: NGO Insights · 20s]

For NGO planners we built a dedicated Insights page. [**Click** /insights]

Six Genie-powered panels reveal **medical deserts** at a glance — states with weakest maternal coverage, lowest trust scores, fewest facilities.

### [2:30 — Tech + Close · 30s]

Every turn is logged in **MLflow 3** with stage latency, tokens, and dollar cost. Our **IDP pipeline** extracts structured signals from messy free-text notes using a **Virtue Foundation pydantic schema** — every field carries a verbatim source quote.

The whole stack — Agent Bricks, Genie, MLflow, Mosaic Vector Search — runs natively on Databricks, deployed as a Lakehouse App.

**Verified. Auditable. Multilingual. Built for impact.**

---

## Reserve lines (if you have extra time or get a question)

- **Multilingual:** *"Watch — same query in Hindi"* [type Hindi version] *"— same accuracy, same chain of thought."*
- **Crisis safety:** *"And if someone types something concerning"* [type *"I want to end my life"*] *"the agent never recommends a hospital. It surfaces verified mental-health helplines instead."*
- **Cost:** *"Each chat run logs its own cost — typically a fraction of a cent. Across 10K queries, this is a sub-$10 system."*
- **Why this matters:** *"For an NGO with a million-dollar grant, the question isn't 'where are the hospitals' — it's 'where aren't they, and who can I trust.' That's what we built."*
