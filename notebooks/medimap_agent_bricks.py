# Databricks notebook source
# MAGIC %md
# MAGIC # MediMap — Agent Bricks deployment
# MAGIC
# MAGIC Wraps the existing MediMap pipeline (Groq parser → Mosaic Vector Search → weighted SQL ranking → Llama summarizer) as a Mosaic AI **ChatAgent** and deploys it to Model Serving.
# MAGIC
# MAGIC After deployment, the Node backend can call the deployed endpoint instead of orchestrating the four steps itself.
# MAGIC
# MAGIC **Workspace requirements:**
# MAGIC - Unity Catalog enabled (we register to `workspace.default.medimap_agent`)
# MAGIC - SQL warehouse running (used at inference time)
# MAGIC - Mosaic AI Vector Search index `workspace.default.clean_facilities_vs_index` ONLINE
# MAGIC - Foundation model serving: `databricks-meta-llama-3-3-70b-instruct`
# MAGIC - Groq API key (parser) — set as a Databricks secret
# MAGIC
# MAGIC **Note on Model Serving tier:** if your workspace does not support provisioned throughput, the final `agents.deploy` cell will need pay-per-token / CPU serving (see comments in the deploy cell).

# COMMAND ----------

# MAGIC %pip install -U -q "mlflow[databricks]>=3.0" databricks-agents databricks-vectorsearch databricks-sql-connector openai
# MAGIC %restart_python

# COMMAND ----------

import os
import json
import time
from typing import Any, Generator, Optional
from dataclasses import dataclass

import mlflow
from mlflow.pyfunc import ChatAgent
from mlflow.types.agent import (
    ChatAgentMessage,
    ChatAgentResponse,
    ChatAgentChunk,
    ChatContext,
)

# COMMAND ----------

# MAGIC %md
# MAGIC ## 1. Configuration
# MAGIC Edit these to match your workspace.

# COMMAND ----------

CONFIG = {
    "uc_model_name": "workspace.default.medimap_agent",
    "experiment_path": "/Users/arayikdev@gmail.com/medimap-traces",
    "agent_table": "workspace.default.facility_signals",
    "vs_endpoint": "medimap_vs",
    "vs_index": "workspace.default.clean_facilities_vs_index",
    "summarizer_endpoint": "databricks-meta-llama-3-3-70b-instruct",
    "groq_secret_scope": "medimap",
    "groq_secret_key": "groq_api_key",
    "sql_http_path": "/sql/1.0/warehouses/c97006fe61977e51",
}

# Set the experiment so model logging lands in the same place as runtime traces
mlflow.set_experiment(CONFIG["experiment_path"])

# COMMAND ----------

# MAGIC %md
# MAGIC ## 2. Store the Groq key as a Databricks secret (one-time)
# MAGIC Run this **only once** from a notebook cell with your key, then comment it out.
# MAGIC ```python
# MAGIC from databricks.sdk import WorkspaceClient
# MAGIC w = WorkspaceClient()
# MAGIC w.secrets.create_scope(scope=CONFIG["groq_secret_scope"])
# MAGIC w.secrets.put_secret(scope=CONFIG["groq_secret_scope"], key=CONFIG["groq_secret_key"], string_value="gsk_...")
# MAGIC ```

# COMMAND ----------

# MAGIC %md
# MAGIC ## 3. Define the agent
# MAGIC The agent below is a self-contained `ChatAgent`. The `predict` method runs the full pipeline; MLflow auto-tracing captures each stage.

# COMMAND ----------

# MAGIC %%writefile agent.py
# MAGIC import json
# MAGIC import os
# MAGIC import re
# MAGIC import math
# MAGIC import time
# MAGIC from typing import Any, Optional
# MAGIC
# MAGIC import mlflow
# MAGIC from mlflow.pyfunc import ChatAgent
# MAGIC from mlflow.types.agent import (
# MAGIC     ChatAgentMessage,
# MAGIC     ChatAgentResponse,
# MAGIC     ChatContext,
# MAGIC )
# MAGIC from openai import OpenAI
# MAGIC from databricks.vector_search.client import VectorSearchClient
# MAGIC from databricks import sql as dbsql
# MAGIC
# MAGIC mlflow.openai.autolog()
# MAGIC
# MAGIC AGENT_TABLE = "workspace.default.facility_signals"
# MAGIC VS_ENDPOINT = "medimap_vs"
# MAGIC VS_INDEX = "workspace.default.clean_facilities_vs_index"
# MAGIC SUMMARIZER_ENDPOINT = "databricks-meta-llama-3-3-70b-instruct"
# MAGIC SQL_HTTP_PATH = "/sql/1.0/warehouses/c97006fe61977e51"
# MAGIC GROQ_SECRET_SCOPE = "medimap"
# MAGIC GROQ_SECRET_KEY = "groq_api_key"
# MAGIC VS_CANDIDATE_POOL = 50
# MAGIC
# MAGIC PARSE_PROMPT = """Return raw JSON only. No markdown. No explanation.
# MAGIC
# MAGIC Parse this healthcare facility search query (English, Hindi, Hinglish, Bengali, Tamil, Telugu, Marathi, Gujarati, Kannada, Malayalam, Punjabi, or Urdu).
# MAGIC
# MAGIC Schema:
# MAGIC {{
# MAGIC   "location_text": null,
# MAGIC   "needs_emergency": true/false,
# MAGIC   "needs_surgery": true/false,
# MAGIC   "needs_diagnostics": true/false,
# MAGIC   "needs_critical_care": true/false,
# MAGIC   "needs_maternal": true/false,
# MAGIC   "needs_specialty": true/false,
# MAGIC   "top_k": null,
# MAGIC   "priority": []
# MAGIC }}
# MAGIC
# MAGIC Rules:
# MAGIC - ICU, ventilator, oxygen, critical care => needs_critical_care
# MAGIC - surgery, operation, surgeon => needs_surgery
# MAGIC - MRI, CT, scan, X-ray, diagnostic => needs_diagnostics
# MAGIC - maternity, delivery, neonatal, NICU => needs_maternal
# MAGIC - oncology, cardiology, neurology, dialysis, specialist => needs_specialty
# MAGIC - emergency, trauma, urgent, casualty => needs_emergency
# MAGIC - location_text always lowercase English Latin script
# MAGIC - top_k: number user explicitly asked for (1–20), else null
# MAGIC
# MAGIC Query:
# MAGIC {q}"""
# MAGIC
# MAGIC SUMMARY_SYSTEM = """You are MediBot, a healthcare facility finder for India.
# MAGIC You're given the JSON output of a structured agent that already searched a Databricks-hosted facility directory.
# MAGIC Output a markdown reply with a one-sentence intro and a bulleted list (max 6) of facilities. Each bullet:
# MAGIC - **Bold facility name**
# MAGIC - City, State · Score X.XX · Status (Verified / ⚠ Caution / Data Incomplete)
# MAGIC After the top result, add a "Trust Note" line citing one short quote from evidence_snippet (under 20 words).
# MAGIC Sort DESCENDING unless user asked for "worst/lowest". If parsed_query.needs_emergency, prefix with "🚑 Call 102 (ambulance) or 108 (emergency) immediately.".
# MAGIC Never invent capabilities. Match the language of the user's query."""
# MAGIC
# MAGIC
# MAGIC def _get_groq_client():
# MAGIC     try:
# MAGIC         from databricks.sdk.runtime import dbutils
# MAGIC         key = dbutils.secrets.get(GROQ_SECRET_SCOPE, GROQ_SECRET_KEY)
# MAGIC     except Exception:
# MAGIC         key = os.environ.get("GROQ_API_KEY")
# MAGIC     if not key:
# MAGIC         return None
# MAGIC     return OpenAI(api_key=key, base_url="https://api.groq.com/openai/v1")
# MAGIC
# MAGIC
# MAGIC def _databricks_token():
# MAGIC     try:
# MAGIC         from databricks.sdk.runtime import dbutils
# MAGIC         return dbutils.notebook.entry_point.getDbutils().notebook().getContext().apiToken().get()
# MAGIC     except Exception:
# MAGIC         return os.environ.get("DATABRICKS_TOKEN")
# MAGIC
# MAGIC
# MAGIC def _databricks_host():
# MAGIC     return os.environ.get("DATABRICKS_HOST") or os.environ.get("DATABRICKS_WORKSPACE_URL") or ""
# MAGIC
# MAGIC
# MAGIC def parse_query(query: str) -> dict:
# MAGIC     client = _get_groq_client()
# MAGIC     if client is None:
# MAGIC         return _simple_parse(query)
# MAGIC     try:
# MAGIC         resp = client.chat.completions.create(
# MAGIC             model="llama-3.3-70b-versatile",
# MAGIC             messages=[{"role": "user", "content": PARSE_PROMPT.format(q=query)}],
# MAGIC             temperature=0,
# MAGIC             timeout=15,
# MAGIC         )
# MAGIC         text = resp.choices[0].message.content.strip()
# MAGIC         text = re.sub(r"^```(?:json)?", "", text).rstrip("`").strip()
# MAGIC         m = re.search(r"\{[\s\S]*\}", text)
# MAGIC         parsed = json.loads(m.group(0) if m else text)
# MAGIC         parsed["raw_query"] = query
# MAGIC         return parsed
# MAGIC     except Exception:
# MAGIC         return _simple_parse(query)
# MAGIC
# MAGIC
# MAGIC def _simple_parse(query: str) -> dict:
# MAGIC     q = query.lower()
# MAGIC     def has(words): return any(w in q for w in words)
# MAGIC     parsed = {
# MAGIC         "raw_query": query,
# MAGIC         "needs_emergency": has(["emergency", "urgent", "trauma"]),
# MAGIC         "needs_surgery": has(["surgery", "operation", "surgeon"]),
# MAGIC         "needs_diagnostics": has(["mri", "ct", "scan", "x-ray", "diagnostic"]),
# MAGIC         "needs_critical_care": has(["icu", "ventilator", "critical care"]),
# MAGIC         "needs_maternal": has(["maternity", "neonatal", "nicu", "delivery"]),
# MAGIC         "needs_specialty": has(["oncology", "cardiology", "neurology", "dialysis"]),
# MAGIC         "location_text": None,
# MAGIC         "top_k": None,
# MAGIC         "priority": [],
# MAGIC     }
# MAGIC     m = re.search(r"\b(\d+)\b", q)
# MAGIC     if m:
# MAGIC         parsed["top_k"] = max(1, min(20, int(m.group(1))))
# MAGIC     for loc in ["delhi", "mumbai", "bangalore", "bengaluru", "chennai", "kolkata", "patna", "hyderabad", "pune", "bihar", "karnataka", "kerala", "gujarat", "rajasthan", "tamil nadu", "uttar pradesh", "maharashtra", "west bengal"]:
# MAGIC         if loc in q:
# MAGIC             parsed["location_text"] = loc
# MAGIC             break
# MAGIC     return parsed
# MAGIC
# MAGIC
# MAGIC def vector_search(query: str, num_results: int = VS_CANDIDATE_POOL):
# MAGIC     try:
# MAGIC         vsc = VectorSearchClient(disable_notice=True)
# MAGIC         index = vsc.get_index(endpoint_name=VS_ENDPOINT, index_name=VS_INDEX)
# MAGIC         res = index.similarity_search(
# MAGIC             query_text=query,
# MAGIC             columns=["facility_id", "name", "address_city", "address_stateOrRegion", "embed_text"],
# MAGIC             num_results=num_results,
# MAGIC         )
# MAGIC         cols = [c["name"] for c in res["manifest"]["columns"]]
# MAGIC         data = res["result"]["data_array"]
# MAGIC         items = []
# MAGIC         for row in data:
# MAGIC             obj = dict(zip(cols, row))
# MAGIC             if len(row) > len(cols):
# MAGIC                 obj["score"] = row[-1]
# MAGIC             items.append(obj)
# MAGIC         return items
# MAGIC     except Exception as e:
# MAGIC         print(f"[vector_search] skipped: {e}")
# MAGIC         return []
# MAGIC
# MAGIC
# MAGIC def best_excerpt(text: Optional[str], words, max_len: int = 220) -> Optional[str]:
# MAGIC     if not text: return None
# MAGIC     lower = text.lower()
# MAGIC     best_idx = -1
# MAGIC     for w in words:
# MAGIC         if len(w) < 3: continue
# MAGIC         i = lower.find(w)
# MAGIC         if i != -1 and (best_idx == -1 or i < best_idx):
# MAGIC             best_idx = i
# MAGIC     if best_idx == -1:
# MAGIC         return text[:max_len] + ("…" if len(text) > max_len else "")
# MAGIC     start = max(0, best_idx - 60)
# MAGIC     end = min(len(text), best_idx + 200)
# MAGIC     return ("…" if start > 0 else "") + text[start:end] + ("…" if end < len(text) else "")
# MAGIC
# MAGIC
# MAGIC def run_sql_ranking(parsed: dict, semantic_ids, top_k: int = 5) -> list:
# MAGIC     intent_terms = []
# MAGIC     if parsed.get("needs_emergency"): intent_terms.append("(COALESCE(emergency_score, 0) / 3.0) * 0.20")
# MAGIC     if parsed.get("needs_surgery"): intent_terms.append("(COALESCE(surgery_score, 0) / 3.0) * 0.22")
# MAGIC     if parsed.get("needs_diagnostics"): intent_terms.append("(COALESCE(diagnostic_score, 0) / 3.0) * 0.18")
# MAGIC     if parsed.get("needs_critical_care"): intent_terms.append("(COALESCE(critical_care_score, 0) / 3.0) * 0.25")
# MAGIC     if parsed.get("needs_maternal"): intent_terms.append("(COALESCE(maternal_neonatal_score, 0) / 3.0) * 0.15")
# MAGIC     if parsed.get("needs_specialty"): intent_terms.append("(COALESCE(specialty_score, 0) / 3.0) * 0.15")
# MAGIC     query_match = "(" + " + ".join(intent_terms) + ")" if intent_terms else "COALESCE(overall_facility_score, 0)"
# MAGIC
# MAGIC     where = []
# MAGIC     if parsed.get("location_text"):
# MAGIC         loc = parsed["location_text"].lower().replace("'", "''")
# MAGIC         where.append(f"(lower(address_city) LIKE '%{loc}%' OR lower(address_stateOrRegion) LIKE '%{loc}%')")
# MAGIC     if semantic_ids:
# MAGIC         id_list = ", ".join(str(int(i)) for i in semantic_ids if i is not None)
# MAGIC         if id_list:
# MAGIC             where.append(f"facility_id IN ({id_list})")
# MAGIC     where_sql = ("WHERE " + " AND ".join(where)) if where else ""
# MAGIC
# MAGIC     requested = parsed.get("top_k")
# MAGIC     if isinstance(requested, (int, float)) and requested > 0:
# MAGIC         cap = max(1, min(20, int(requested)))
# MAGIC     else:
# MAGIC         cap = max(1, min(50, top_k))
# MAGIC
# MAGIC     sql = f"""
# MAGIC         WITH scored AS (
# MAGIC             SELECT *, {query_match} AS query_match_score
# MAGIC             FROM {AGENT_TABLE}
# MAGIC             {where_sql}
# MAGIC         )
# MAGIC         SELECT *,
# MAGIC             (query_match_score * 0.45 +
# MAGIC              COALESCE(trust_score, 0) * 0.25 +
# MAGIC              COALESCE(capability_score, 0) * 0.20 +
# MAGIC              0.5 * 0.10) AS final_score
# MAGIC         FROM scored
# MAGIC         ORDER BY final_score DESC
# MAGIC         LIMIT {cap}
# MAGIC     """
# MAGIC
# MAGIC     host = _databricks_host().replace("https://", "").rstrip("/")
# MAGIC     token = _databricks_token()
# MAGIC     with dbsql.connect(server_hostname=host, http_path=SQL_HTTP_PATH, access_token=token) as conn:
# MAGIC         with conn.cursor() as cur:
# MAGIC             cur.execute(sql)
# MAGIC             columns = [d[0] for d in cur.description]
# MAGIC             rows = [dict(zip(columns, row)) for row in cur.fetchall()]
# MAGIC     return rows
# MAGIC
# MAGIC
# MAGIC def summarize(query: str, agent_response: dict) -> str:
# MAGIC     from mlflow.deployments import get_deploy_client
# MAGIC     client = get_deploy_client("databricks")
# MAGIC     prompt = f"User query: \"{query}\"\n\nAgent output:\n{json.dumps(agent_response, default=str, indent=2)}"
# MAGIC     resp = client.predict(
# MAGIC         endpoint=SUMMARIZER_ENDPOINT,
# MAGIC         inputs={
# MAGIC             "messages": [
# MAGIC                 {"role": "system", "content": SUMMARY_SYSTEM},
# MAGIC                 {"role": "user", "content": prompt},
# MAGIC             ],
# MAGIC             "temperature": 0.3,
# MAGIC             "max_tokens": 600,
# MAGIC         },
# MAGIC     )
# MAGIC     return resp["choices"][0]["message"]["content"]
# MAGIC
# MAGIC
# MAGIC class MediMapAgent(ChatAgent):
# MAGIC     def predict(self, messages, context: Optional[ChatContext] = None, custom_inputs=None) -> ChatAgentResponse:
# MAGIC         user_msgs = [m for m in messages if m.role == "user"]
# MAGIC         if not user_msgs:
# MAGIC             return ChatAgentResponse(messages=[ChatAgentMessage(role="assistant", content="No user message provided.")])
# MAGIC         query = user_msgs[-1].content
# MAGIC
# MAGIC         with mlflow.start_span(name="parse") as s:
# MAGIC             parsed = parse_query(query)
# MAGIC             s.set_attribute("location_text", parsed.get("location_text") or "")
# MAGIC
# MAGIC         with mlflow.start_span(name="vector_search") as s:
# MAGIC             vs_items = vector_search(query)
# MAGIC             s.set_attribute("candidates", len(vs_items))
# MAGIC
# MAGIC         words = [w for w in re.split(r"\W+", query.lower()) if w]
# MAGIC         semantic_by_id = {}
# MAGIC         for it in vs_items:
# MAGIC             fid = it.get("facility_id")
# MAGIC             if fid is None: continue
# MAGIC             semantic_by_id[int(fid)] = {
# MAGIC                 "score": it.get("score"),
# MAGIC                 "excerpt": best_excerpt(it.get("embed_text"), words),
# MAGIC             }
# MAGIC
# MAGIC         with mlflow.start_span(name="sql_rank") as s:
# MAGIC             rows = run_sql_ranking(parsed, list(semantic_by_id.keys()))
# MAGIC             s.set_attribute("results", len(rows))
# MAGIC
# MAGIC         results = []
# MAGIC         for row in rows:
# MAGIC             info = semantic_by_id.get(int(row.get("facility_id"))) if row.get("facility_id") is not None else None
# MAGIC             results.append({
# MAGIC                 "facility_id": row.get("facility_id"),
# MAGIC                 "name": row.get("name"),
# MAGIC                 "city": row.get("address_city"),
# MAGIC                 "state": row.get("address_stateOrRegion"),
# MAGIC                 "final_score": float(row.get("final_score") or 0),
# MAGIC                 "trust_score": float(row.get("trust_score") or 0),
# MAGIC                 "capability_score": float(row.get("capability_score") or 0),
# MAGIC                 "evidence_snippet": (row.get("facility_profile_text") or "")[:500],
# MAGIC                 "semantic": {"matched": info is not None, "score": info["score"] if info else None, "excerpt": info["excerpt"] if info else None},
# MAGIC             })
# MAGIC
# MAGIC         agent_response = {
# MAGIC             "query": query,
# MAGIC             "parsed_query": parsed,
# MAGIC             "result_count": len(results),
# MAGIC             "semantic_used": bool(semantic_by_id),
# MAGIC             "results": results,
# MAGIC         }
# MAGIC
# MAGIC         with mlflow.start_span(name="summarize"):
# MAGIC             reply = summarize(query, agent_response)
# MAGIC
# MAGIC         return ChatAgentResponse(
# MAGIC             messages=[ChatAgentMessage(role="assistant", content=reply)],
# MAGIC             custom_outputs=agent_response,
# MAGIC         )
# MAGIC
# MAGIC
# MAGIC AGENT = MediMapAgent()
# MAGIC mlflow.models.set_model(AGENT)

# COMMAND ----------

# MAGIC %md
# MAGIC ## 4. Quick local sanity check
# MAGIC Imports the agent file and runs a single prompt against the live workspace before logging.

# COMMAND ----------

from agent import AGENT
from mlflow.types.agent import ChatAgentMessage

response = AGENT.predict(
    messages=[ChatAgentMessage(role="user", content="Find 3 hospitals with ICU and surgery capability in Bihar")],
)
print(response.messages[0].content)
print(json.dumps(response.custom_outputs, indent=2, default=str)[:1500])

# COMMAND ----------

# MAGIC %md
# MAGIC ## 5. Log + register the model to Unity Catalog

# COMMAND ----------

from mlflow.models.resources import (
    DatabricksServingEndpoint,
    DatabricksVectorSearchIndex,
    DatabricksSQLWarehouse,
    DatabricksFunction,
)

mlflow.set_registry_uri("databricks-uc")

with mlflow.start_run(run_name="medimap-agent-bricks"):
    info = mlflow.pyfunc.log_model(
        python_model="agent.py",
        artifact_path="agent",
        pip_requirements=[
            "mlflow[databricks]>=3.0",
            "databricks-vectorsearch",
            "databricks-sql-connector",
            "openai",
        ],
        resources=[
            DatabricksServingEndpoint(endpoint_name=CONFIG["summarizer_endpoint"]),
            DatabricksVectorSearchIndex(index_name=CONFIG["vs_index"]),
            DatabricksSQLWarehouse(warehouse_id=CONFIG["sql_http_path"].rsplit("/", 1)[-1]),
        ],
        registered_model_name=CONFIG["uc_model_name"],
    )

print("Model URI:", info.model_uri)
print("Registered:", CONFIG["uc_model_name"])

# COMMAND ----------

# MAGIC %md
# MAGIC ## 6. Deploy to Model Serving
# MAGIC
# MAGIC `agents.deploy` provisions a serving endpoint that calls the agent. If your workspace does not allow provisioned-throughput endpoints, you can:
# MAGIC - Use `workload_size="Small"` on a CPU-only model serving endpoint (cost-controlled), OR
# MAGIC - Skip this cell and call the agent locally via `mlflow.pyfunc.load_model(...).predict(...)`.

# COMMAND ----------

from databricks import agents
from mlflow import MlflowClient

client = MlflowClient(registry_uri="databricks-uc")
versions = client.search_model_versions(f"name='{CONFIG['uc_model_name']}'")
latest_version = max(versions, key=lambda v: int(v.version)).version
print("Deploying version:", latest_version)

deployment = agents.deploy(
    model_name=CONFIG["uc_model_name"],
    model_version=latest_version,
    scale_to_zero=True,
    environment_vars={
        "MLFLOW_EXPERIMENT_NAME": CONFIG["experiment_path"],
    },
    tags={"app": "medimap"},
)

print("Endpoint name:", deployment.endpoint_name)
print("Endpoint URL :", deployment.query_endpoint)

# COMMAND ----------

# MAGIC %md
# MAGIC ## 7. Smoke test the deployed endpoint

# COMMAND ----------

from mlflow.deployments import get_deploy_client

client = get_deploy_client("databricks")
result = client.predict(
    endpoint=deployment.endpoint_name,
    inputs={"messages": [{"role": "user", "content": "Find a top maternity hospital in Patna"}]},
)
print(json.dumps(result, indent=2, default=str)[:2000])

# COMMAND ----------

# MAGIC %md
# MAGIC ## 8. Wire the Node backend to the deployed endpoint
# MAGIC Once `deployment.endpoint_name` is live, set in `backend/.env`:
# MAGIC ```
# MAGIC DATABRICKS_BRICKS_AGENT_ENDPOINT=<deployment.endpoint_name>
# MAGIC ```
# MAGIC and add a feature flag in `backend/src/routes/chat.js` that routes to the deployed endpoint instead of orchestrating locally. The local orchestration stays as the fallback when the endpoint is unset or returns an error.
