// Databricks MLflow tracing — one run per chat request.
// Captures stage latencies, token usage, and estimated cost so each
// request is observable in the MLflow experiment UI.

const {
  DATABRICKS_HOST,
  DATABRICKS_TOKEN,
  MLFLOW_EXPERIMENT_PATH,
  MLFLOW_LLAMA_INPUT_USD_PER_MTOK,
  MLFLOW_LLAMA_OUTPUT_USD_PER_MTOK,
} = process.env;

const MLFLOW_ENABLED = Boolean(DATABRICKS_HOST && DATABRICKS_TOKEN && MLFLOW_EXPERIMENT_PATH);

const host = (DATABRICKS_HOST || '').replace(/^https?:\/\//, '').replace(/\/.*$/, '');
const baseUrl = host ? `https://${host}` : '';

// Llama 3.3 70B on Databricks pay-per-token (override via env if rates change)
const INPUT_PRICE = Number(MLFLOW_LLAMA_INPUT_USD_PER_MTOK ?? 0.5);
const OUTPUT_PRICE = Number(MLFLOW_LLAMA_OUTPUT_USD_PER_MTOK ?? 1.5);

let cachedExperimentId = null;
let experimentLookupPromise = null;

async function mlflowFetch(path, body) {
  const res = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${DATABRICKS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`MLflow ${path} ${res.status}: ${text.slice(0, 240)}`);
  }
  return res.json();
}

async function getOrCreateExperiment() {
  if (cachedExperimentId) return cachedExperimentId;
  if (experimentLookupPromise) return experimentLookupPromise;

  experimentLookupPromise = (async () => {
    try {
      const found = await mlflowFetch('/api/2.0/mlflow/experiments/get-by-name', {
        experiment_name: MLFLOW_EXPERIMENT_PATH,
      });
      cachedExperimentId = found?.experiment?.experiment_id ?? null;
    } catch (err) {
      // Not found → create
      try {
        const created = await mlflowFetch('/api/2.0/mlflow/experiments/create', {
          name: MLFLOW_EXPERIMENT_PATH,
        });
        cachedExperimentId = created?.experiment_id ?? null;
      } catch (createErr) {
        console.warn('[mlflow] experiment create failed:', createErr.message);
        cachedExperimentId = null;
      }
    }
    experimentLookupPromise = null;
    return cachedExperimentId;
  })();

  return experimentLookupPromise;
}

const truncate = (v, max = 240) => {
  const s = String(v ?? '');
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
};

export function isMlflowEnabled() {
  return MLFLOW_ENABLED;
}

export function estimateLlamaCost({ promptTokens = 0, completionTokens = 0 } = {}) {
  return (
    (Number(promptTokens) * INPUT_PRICE) / 1_000_000 +
    (Number(completionTokens) * OUTPUT_PRICE) / 1_000_000
  );
}

/**
 * Start an MLflow run. Returns a tracker with stage timing helpers and a
 * `finish(extras)` method that batches all metrics/params/tags and ends
 * the run. All errors are swallowed so tracing never blocks the request.
 */
export async function startChatRun({ runName, query, hasLocation, clarifyCount } = {}) {
  if (!MLFLOW_ENABLED) return makeNoopTracker();

  const startedAt = Date.now();
  let runId = null;
  let experimentId = null;
  try {
    experimentId = await getOrCreateExperiment();
    if (!experimentId) return makeNoopTracker();
    const created = await mlflowFetch('/api/2.0/mlflow/runs/create', {
      experiment_id: experimentId,
      start_time: startedAt,
      run_name: runName ?? 'medimap-chat',
      tags: [
        { key: 'mlflow.runName', value: runName ?? 'medimap-chat' },
        { key: 'service', value: 'medimap-backend' },
        { key: 'has_location', value: hasLocation ? 'true' : 'false' },
        { key: 'clarify_count_in', value: String(clarifyCount ?? 0) },
      ],
    });
    runId = created?.run?.info?.run_id ?? null;
  } catch (err) {
    console.warn('[mlflow] startChatRun failed:', err.message);
    return makeNoopTracker();
  }

  const stageTimes = {};
  const stageRunning = {};
  const tokens = {};

  const tracker = {
    runId,
    experimentId,
    enabled: true,

    stageStart(name) {
      stageRunning[name] = Date.now();
    },
    stageEnd(name) {
      if (stageRunning[name] != null) {
        stageTimes[name] = Date.now() - stageRunning[name];
        delete stageRunning[name];
      }
    },
    addTokens(stage, prompt, completion) {
      tokens[stage] = {
        prompt: Number(prompt) || 0,
        completion: Number(completion) || 0,
      };
    },

    traceUrl() {
      if (!runId || !experimentId || !baseUrl) return null;
      return `${baseUrl}/ml/experiments/${experimentId}/runs/${runId}`;
    },

    async finish(extras = {}) {
      if (!runId) return;
      const endedAt = Date.now();
      const totalLatency = endedAt - startedAt;

      const params = [
        { key: 'query', value: truncate(query, 240) },
        { key: 'has_location', value: String(Boolean(hasLocation)) },
        { key: 'clarify_count_in', value: String(clarifyCount ?? 0) },
      ];
      if (extras.parsedIntent) {
        params.push({ key: 'parsed_intent', value: truncate(extras.parsedIntent, 240) });
      }
      if (extras.topK != null) {
        params.push({ key: 'top_k', value: String(extras.topK) });
      }
      if (extras.action) {
        params.push({ key: 'action', value: truncate(extras.action, 64) });
      }

      const tagList = [
        { key: 'action', value: extras.action ?? 'unknown' },
        { key: 'semantic_used', value: extras.semanticUsed ? 'true' : 'false' },
      ];
      if (extras.vsSkippedReason) {
        tagList.push({ key: 'vs_skipped_reason', value: truncate(extras.vsSkippedReason, 240) });
      }
      if (extras.errorMessage) {
        tagList.push({ key: 'error', value: truncate(extras.errorMessage, 240) });
      }

      const metricTs = endedAt;
      const metricList = [
        { key: 'total_latency_ms', value: totalLatency, timestamp: metricTs, step: 0 },
      ];
      for (const [name, ms] of Object.entries(stageTimes)) {
        metricList.push({ key: `stage_${name}_ms`, value: Number(ms), timestamp: metricTs, step: 0 });
      }
      if (extras.semanticPool != null) {
        metricList.push({ key: 'semantic_pool', value: Number(extras.semanticPool), timestamp: metricTs, step: 0 });
      }
      if (extras.resultCount != null) {
        metricList.push({ key: 'result_count', value: Number(extras.resultCount), timestamp: metricTs, step: 0 });
      }
      if (extras.verifiedCount != null) {
        metricList.push({ key: 'verified_count', value: Number(extras.verifiedCount), timestamp: metricTs, step: 0 });
      }
      if (extras.verifiedTotal != null && Number(extras.verifiedTotal) > 0) {
        metricList.push({
          key: 'verification_rate',
          value: Number(extras.verifiedCount) / Number(extras.verifiedTotal),
          timestamp: metricTs,
          step: 0,
        });
      }

      let totalPrompt = 0;
      let totalCompletion = 0;
      for (const [stage, t] of Object.entries(tokens)) {
        totalPrompt += t.prompt;
        totalCompletion += t.completion;
        metricList.push({ key: `tokens_${stage}_prompt`, value: t.prompt, timestamp: metricTs, step: 0 });
        metricList.push({ key: `tokens_${stage}_completion`, value: t.completion, timestamp: metricTs, step: 0 });
      }
      const cost = estimateLlamaCost({ promptTokens: totalPrompt, completionTokens: totalCompletion });
      metricList.push({ key: 'tokens_total', value: totalPrompt + totalCompletion, timestamp: metricTs, step: 0 });
      metricList.push({ key: 'cost_usd', value: Number(cost.toFixed(6)), timestamp: metricTs, step: 0 });

      try {
        await mlflowFetch('/api/2.0/mlflow/runs/log-batch', {
          run_id: runId,
          metrics: metricList,
          params,
          tags: tagList,
        });
      } catch (err) {
        console.warn('[mlflow] log-batch failed:', err.message);
      }

      try {
        await mlflowFetch('/api/2.0/mlflow/runs/update', {
          run_id: runId,
          status: extras.errorMessage ? 'FAILED' : 'FINISHED',
          end_time: endedAt,
        });
      } catch (err) {
        console.warn('[mlflow] runs/update failed:', err.message);
      }
    },
  };

  return tracker;
}

function makeNoopTracker() {
  return {
    runId: null,
    experimentId: null,
    enabled: false,
    stageStart() {},
    stageEnd() {},
    addTokens() {},
    traceUrl() {
      return null;
    },
    async finish() {},
  };
}
