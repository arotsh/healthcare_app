# MediMap — Technical Talk Track

Three depths. Pick based on your time slot or the judge's question.

---

## Depth 1 — One-breath stack mention (15s)

Say this if you have ~15 seconds left in your demo.

> *"The whole stack is Databricks-native: **Mosaic AI Vector Search** for semantic retrieval over the 10,000 facility profiles, **Llama 3.3 70B** through the Databricks Foundation Model API for parsing and verification, **Databricks SQL** for the weighted ranking, **Genie** for the analytical questions, and **MLflow 3** capturing every stage with latency and dollar cost. Deployed as a **Lakehouse App**."*

---

## Depth 2 — Architecture walk-through (~75s)

Say this when you want to explain HOW it works, not just what's in it. Pairs well as a replacement for the [2:30 — Tech + Close] section in [SPEECH.md](SPEECH.md).

> *"Let me show you what happens behind a single query.*
>
> *When you ask, 'find me an ICU in Bihar', the message hits a Node Express backend running as a Databricks Lakehouse App. It first goes to a **decision router** — a Llama call that classifies the request as one of five things: **crisis**, **analytics**, **search**, **redirect**, or **clarify**.*
>
> *For a search like this one, four steps run in sequence. **Step one**: Llama parses your intent and location. **Step two**: **Mosaic AI Vector Search** retrieves the top 50 semantic candidates from 10,000 facility profile embeddings — all in under 200 milliseconds. **Step three**: those candidate IDs filter a weighted SQL query running on a **Databricks SQL warehouse**, which ranks them by emergency, surgery, ICU, trust, and capability scores. **Step four**: a **self-verification pass** — a second Llama call audits each top result, checking whether the claimed capabilities are actually supported by the evidence text, and returns a verbatim quote.*
>
> *For analytical questions like 'how many hospitals in each state', the router sends them to **Databricks Genie**, which writes its own SQL, runs it on the same warehouse, and returns results with the query exposed.*
>
> *Every stage is wrapped in **MLflow 3** — we log per-step latency, prompt and completion tokens, and an estimated dollar cost. Each chat reply links to its own MLflow run.*
>
> *And the IDP pipeline you saw — that's the same stack: Llama 3.3 70B reading raw facility notes, validated against a **Virtue Foundation pydantic schema**, with every extracted field anchored to a verbatim quote."*

---

## Depth 3 — For Q&A (2-3 min total, broken into chunks)

Use these as reserve answers if a judge digs in.

### Q: "Why hybrid retrieval — why not just vector search or just SQL?"

> *"Pure vector search is great for 'show me anything that semantically matches this query', but it can't enforce hard constraints — like 'must be in Bihar' or 'trust score above 0.5'. Pure SQL is great for hard constraints but can't read the messy unstructured profile notes that contain phrases like 'ultra-modern OT' or 'MAKO robotic system'. We do **vector search first** to recall semantically relevant candidates from the unstructured embed_text, then **SQL second** to apply the hard filters and the weighted scoring — best of both. The SQL `WHERE facility_id IN (...)` clause uses the vector candidates as the recall set."*

### Q: "How does the self-verification work? Isn't an LLM grading itself unreliable?"

> *"It's not the same LLM grading the same call. The verifier uses a **different prompt**, takes only the facility's evidence text, and is forced to return JSON with a verbatim substring quote. If the quote isn't actually in the source text, validation fails. We measure **verification rate** as an MLflow metric on every chat — across our 30-case eval set, the verifier catches data-incomplete cases the original ranker missed. It's not a perfect oracle, but it adds a real consistency check that's missing from a one-shot retriever."*

### Q: "How is cost tracked?"

> *"Every chat request creates an MLflow run. We capture prompt and completion tokens for each LLM stage — decision routing, parsing, summarization, verification — and convert to dollars using the published Llama 3.3 70B pay-per-token rates. The rates are environment-overridable in case Databricks changes pricing. A typical chat run is well under a tenth of a cent. Across 10,000 queries, the system runs under $10."*

### Q: "What's Agent Bricks doing?"

> *"Two things. First, **serving** — Llama 3.3 70B is exposed via the Databricks Foundation Model API, which is the same surface Agent Bricks uses underneath. Second, the **Mosaic Agent Framework** — we wrote a `ChatAgent` class that wraps the entire pipeline and registered it to Unity Catalog at `workspace.default.medimap_agent`. With a feature flag, the Node backend can route SEARCH traffic through that endpoint instead of orchestrating locally. The agent gets MLflow tracing for free because spans are wired into the agent code with `mlflow.start_span`."*

### Q: "Why pydantic if the runtime is JavaScript?"

> *"The pydantic schema lives in the IDP notebook — that's where the **batch extraction** happens, against the full 10,000-row dataset, written as a Delta table. The runtime live demo on the Insights page mirrors the same shape with a JavaScript validator that checks the same fields, types, and ranges. So the schema is single-sourced conceptually — pydantic enforces it at extraction time, the JS validator enforces it at demo time. Either way, every field has a verbatim quote anchor."*

### Q: "What about safety? Crisis detection?"

> *"The decision router has a hard redline for crisis signals — phrases like 'I want to end my life' or self-harm metaphors. When that triggers, the router never reaches the search path. It returns three verified mental-health helplines — **KIRAN**, **Vandrevala Foundation**, **AASRA** — with `tel:` links so a phone tap dials immediately. The same redline triggers in any of the 12 supported Indian languages. We also have a **pilot rule** that politely refuses non-medical questions — so 'how do I become a pilot' or 'give me a recipe' gets redirected, not routed to facility search."*

### Q: "How does Genie integrate?"

> *"We use the Genie REST API directly — `start-conversation` and `conversations/{id}/messages` for follow-ups. We attach **clean_facilities** and **facility_signals** to the Genie space, plus a **schema instructions block** that tells Genie what each column means and how to handle phrases like 'state' (use `address_stateOrRegion`) or 'medical desert'. Genie writes the SQL, runs it on the warehouse, and returns the natural-language answer plus the SQL plus the result rows — fully auditable. The NGO Insights page uses **conversation continuity** so follow-ups like 'now break that down by city' preserve context."*

---

## Practice tip

Don't memorize Depth 2 word for word — memorize the **four steps** (parse → vector search → SQL ranking → self-verify) and the **stack names** (Mosaic Vector Search, Databricks SQL, Genie, MLflow 3, Foundation Model API). The connecting tissue you can improvise.

If a judge asks something not in the Q&A list, the safest answer is to point at MLflow: *"Let me show you the trace"* — opens the run page, lets the live data answer the question.
