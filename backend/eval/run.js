// Offline evaluation harness for MediMap.
//
// Runs each case through the live `/api/chat` route, compares the routed
// `action` (and parsed-intent flags for SEARCH cases) to the expected label,
// and logs aggregate metrics to a dedicated MLflow run inside
// MLFLOW_EXPERIMENT_PATH.
//
// Usage:
//   yarn eval                          # runs all cases against http://localhost:3001
//   API_BASE=http://... yarn eval      # custom backend
//   EVAL_LIMIT=5 yarn eval             # subset
//
// The backend must be running for this to do anything useful.

import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATASET_PATH = path.join(__dirname, 'dataset.json');

const API_BASE = process.env.API_BASE ?? 'http://localhost:3001';
const LIMIT = process.env.EVAL_LIMIT ? Number(process.env.EVAL_LIMIT) : null;

const {
  DATABRICKS_HOST,
  DATABRICKS_TOKEN,
  MLFLOW_EXPERIMENT_PATH,
} = process.env;

const MLFLOW_ENABLED = Boolean(DATABRICKS_HOST && DATABRICKS_TOKEN && MLFLOW_EXPERIMENT_PATH);
const host = (DATABRICKS_HOST || '').replace(/^https?:\/\//, '').replace(/\/.*$/, '');
const baseUrl = host ? `https://${host}` : '';

async function mlflowFetch(p, body) {
  const res = await fetch(`${baseUrl}${p}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${DATABRICKS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`MLflow ${p} ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

async function getOrCreateExperiment(name) {
  try {
    const found = await mlflowFetch('/api/2.0/mlflow/experiments/get-by-name', {
      experiment_name: name,
    });
    return found?.experiment?.experiment_id ?? null;
  } catch {
    const created = await mlflowFetch('/api/2.0/mlflow/experiments/create', { name });
    return created?.experiment_id ?? null;
  }
}

function classifyResponse(data) {
  if (data.isCrisis) return 'crisis';
  if (data.isRedirect) return 'redirect';
  if (data.isClarification) return 'clarify';
  if (data.isAnalytics) return 'analytics';
  if (data.agent) return 'search';
  return 'unknown';
}

async function runCase(c) {
  const started = Date.now();
  const res = await fetch(`${API_BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: [{ role: 'user', content: c.query }] }),
  });
  const data = await res.json();
  const latency = Date.now() - started;

  const action = classifyResponse(data);
  const actionMatch = action === c.expected_action;

  // Intent-level checks for SEARCH cases
  const parsed = data?.agent?.parsed_query ?? null;
  let intentsMatch = null;
  let locationMatch = null;
  let topKMatch = null;
  if (c.expected_action === 'search' && parsed) {
    if (Array.isArray(c.expected_intents) && c.expected_intents.length > 0) {
      intentsMatch = c.expected_intents.every((flag) => Boolean(parsed[flag]));
    }
    if (c.expected_location) {
      locationMatch = (parsed.location_text ?? '').toLowerCase().includes(c.expected_location.toLowerCase());
    }
    if (c.expected_top_k != null) {
      topKMatch = Number(parsed.top_k) === Number(c.expected_top_k);
    }
  }

  return {
    id: c.id,
    query: c.query,
    expected_action: c.expected_action,
    actual_action: action,
    actionMatch,
    intentsMatch,
    locationMatch,
    topKMatch,
    latency_ms: latency,
    trace_url: data.trace_url ?? null,
    reply_preview: (data.reply ?? '').slice(0, 120),
  };
}

function pad(s, n) {
  s = String(s);
  return s.length >= n ? s : s + ' '.repeat(n - s.length);
}

function summarize(results) {
  const total = results.length;
  const actionCorrect = results.filter((r) => r.actionMatch).length;

  const byAction = {};
  for (const r of results) {
    byAction[r.expected_action] ??= { total: 0, correct: 0 };
    byAction[r.expected_action].total += 1;
    if (r.actionMatch) byAction[r.expected_action].correct += 1;
  }

  const searches = results.filter((r) => r.expected_action === 'search');
  const intentsScored = searches.filter((r) => r.intentsMatch != null);
  const intentsCorrect = intentsScored.filter((r) => r.intentsMatch).length;
  const locScored = searches.filter((r) => r.locationMatch != null);
  const locCorrect = locScored.filter((r) => r.locationMatch).length;
  const topkScored = searches.filter((r) => r.topKMatch != null);
  const topkCorrect = topkScored.filter((r) => r.topKMatch).length;

  const latencies = results.map((r) => r.latency_ms).sort((a, b) => a - b);
  const p50 = latencies[Math.floor(latencies.length * 0.5)] ?? 0;
  const p95 = latencies[Math.floor(latencies.length * 0.95)] ?? 0;

  return {
    total,
    action_accuracy: actionCorrect / total,
    by_action: Object.fromEntries(
      Object.entries(byAction).map(([k, v]) => [k, { ...v, accuracy: v.correct / v.total }])
    ),
    intent_accuracy: intentsScored.length ? intentsCorrect / intentsScored.length : null,
    location_accuracy: locScored.length ? locCorrect / locScored.length : null,
    top_k_accuracy: topkScored.length ? topkCorrect / topkScored.length : null,
    latency_p50_ms: p50,
    latency_p95_ms: p95,
  };
}

async function logToMlflow(summary, results) {
  if (!MLFLOW_ENABLED) {
    console.log('[mlflow] not configured — skipping run upload');
    return null;
  }
  const experimentId = await getOrCreateExperiment(MLFLOW_EXPERIMENT_PATH);
  if (!experimentId) return null;

  const startedAt = Date.now();
  const created = await mlflowFetch('/api/2.0/mlflow/runs/create', {
    experiment_id: experimentId,
    start_time: startedAt,
    run_name: `eval-${new Date(startedAt).toISOString()}`,
    tags: [
      { key: 'mlflow.runName', value: `eval-${new Date(startedAt).toISOString()}` },
      { key: 'service', value: 'medimap-eval' },
      { key: 'kind', value: 'evaluation' },
    ],
  });
  const runId = created?.run?.info?.run_id;
  if (!runId) return null;

  const ts = Date.now();
  const metrics = [
    { key: 'total_cases', value: summary.total, timestamp: ts, step: 0 },
    { key: 'action_accuracy', value: summary.action_accuracy, timestamp: ts, step: 0 },
    { key: 'latency_p50_ms', value: summary.latency_p50_ms, timestamp: ts, step: 0 },
    { key: 'latency_p95_ms', value: summary.latency_p95_ms, timestamp: ts, step: 0 },
  ];
  if (summary.intent_accuracy != null) metrics.push({ key: 'intent_accuracy', value: summary.intent_accuracy, timestamp: ts, step: 0 });
  if (summary.location_accuracy != null) metrics.push({ key: 'location_accuracy', value: summary.location_accuracy, timestamp: ts, step: 0 });
  if (summary.top_k_accuracy != null) metrics.push({ key: 'top_k_accuracy', value: summary.top_k_accuracy, timestamp: ts, step: 0 });
  for (const [action, stats] of Object.entries(summary.by_action)) {
    metrics.push({ key: `accuracy_${action}`, value: stats.accuracy, timestamp: ts, step: 0 });
  }

  await mlflowFetch('/api/2.0/mlflow/runs/log-batch', {
    run_id: runId,
    metrics,
    params: [
      { key: 'api_base', value: API_BASE.slice(0, 240) },
      { key: 'limit', value: LIMIT == null ? 'all' : String(LIMIT) },
    ],
    tags: [{ key: 'eval_dataset_path', value: DATASET_PATH.split('/').slice(-2).join('/') }],
  });

  await mlflowFetch('/api/2.0/mlflow/runs/update', {
    run_id: runId,
    status: 'FINISHED',
    end_time: Date.now(),
  });

  return `${baseUrl}/ml/experiments/${experimentId}/runs/${runId}`;
}

async function main() {
  const dataset = JSON.parse(await fs.readFile(DATASET_PATH, 'utf8'));
  const cases = LIMIT ? dataset.cases.slice(0, LIMIT) : dataset.cases;

  console.log(`Running ${cases.length} eval cases against ${API_BASE}…\n`);

  const results = [];
  for (const c of cases) {
    process.stdout.write(`  ${pad(c.id, 32)} `);
    try {
      const r = await runCase(c);
      results.push(r);
      const ok = r.actionMatch ? '✓' : '✗';
      const extra = [];
      if (r.intentsMatch === false) extra.push('intent✗');
      if (r.locationMatch === false) extra.push('loc✗');
      if (r.topKMatch === false) extra.push('topK✗');
      console.log(`${ok} ${pad(r.actual_action, 10)} (expected ${c.expected_action})${extra.length ? ' [' + extra.join(', ') + ']' : ''}`);
    } catch (err) {
      console.log(`✗ error: ${err.message}`);
      results.push({
        id: c.id,
        query: c.query,
        expected_action: c.expected_action,
        actual_action: 'error',
        actionMatch: false,
        latency_ms: 0,
        error: err.message,
      });
    }
  }

  const summary = summarize(results);

  console.log('\n══════ Summary ══════');
  console.log(`  total cases       : ${summary.total}`);
  console.log(`  action accuracy   : ${(summary.action_accuracy * 100).toFixed(1)}%`);
  if (summary.intent_accuracy != null)
    console.log(`  intent accuracy   : ${(summary.intent_accuracy * 100).toFixed(1)}%`);
  if (summary.location_accuracy != null)
    console.log(`  location accuracy : ${(summary.location_accuracy * 100).toFixed(1)}%`);
  if (summary.top_k_accuracy != null)
    console.log(`  top_k accuracy    : ${(summary.top_k_accuracy * 100).toFixed(1)}%`);
  console.log(`  latency p50 / p95 : ${summary.latency_p50_ms} / ${summary.latency_p95_ms} ms`);
  console.log('  by action:');
  for (const [action, stats] of Object.entries(summary.by_action)) {
    console.log(`    ${pad(action, 10)} ${stats.correct}/${stats.total} = ${(stats.accuracy * 100).toFixed(1)}%`);
  }

  const mlflowUrl = await logToMlflow(summary, results);
  if (mlflowUrl) console.log(`\nMLflow run: ${mlflowUrl}`);

  process.exit(summary.action_accuracy === 1 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
