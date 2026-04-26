import { Router } from 'express';
import { runQuery } from '../db.js';
import { extractOne } from '../services/idpExtract.js';
import { startChatRun, isMlflowEnabled, estimateLlamaCost } from '../services/mlflow.js';
import { LOCAL_MODE, sampleFacilitiesForIdp } from '../services/localStore.js';

const router = Router();

// IDP runs against the scored/joined facility table — same one the
// healthcare agent reads — because that's where the unstructured
// `facility_profile_text` lives.
const TABLE = process.env.DATABRICKS_AGENT_TABLE || 'workspace.default.facility_signals';

// Pulls N random facilities with non-trivial profile text and runs IDP
// extraction on each in parallel. Returns source text + structured output
// + validation status + tokens/latency, all live, no notebook required.
router.post('/extract', async (req, res, next) => {
  const count = Math.max(1, Math.min(5, Number(req.body?.count) || 3));

  let tracker = { stageStart() {}, stageEnd() {}, addTokens() {}, traceUrl() { return null; }, async finish() {} };
  if (isMlflowEnabled()) {
    tracker = await startChatRun({
      runName: 'medimap-idp-live',
      query: `live IDP extraction · ${count} facilities`,
      hasLocation: false,
      clarifyCount: 0,
    });
  }

  try {
    tracker.stageStart('sample_facilities');
    let rows;
    if (LOCAL_MODE) {
      rows = sampleFacilitiesForIdp(count);
    } else {
      const sampleSql = `
        SELECT facility_id, name, address_city, address_stateOrRegion, facility_profile_text
        FROM ${TABLE}
        WHERE facility_profile_text IS NOT NULL
          AND length(facility_profile_text) > 200
        ORDER BY rand()
        LIMIT ${count}
      `;
      rows = await runQuery(sampleSql);
    }
    tracker.stageEnd('sample_facilities');

    if (rows.length === 0) {
      await tracker.finish({ action: 'idp_live', errorMessage: 'no facilities sampled' });
      return res.status(404).json({ error: 'No facilities found with sufficient profile text' });
    }

    tracker.stageStart('extract_parallel');
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 120_000);
    let extractions;
    try {
      extractions = await Promise.all(
        rows.map(async (row) => {
          const ext = await extractOne(
            { facility_id: row.facility_id, source_text: row.facility_profile_text },
            { signal: ctrl.signal }
          );
          return { row, ext };
        })
      );
    } finally {
      clearTimeout(timeout);
    }
    tracker.stageEnd('extract_parallel');

    let totalPrompt = 0;
    let totalCompletion = 0;
    let validCount = 0;

    const results = extractions.map(({ row, ext }) => {
      totalPrompt += ext.prompt_tokens;
      totalCompletion += ext.completion_tokens;
      const validated = ext.extraction != null && ext.validation_errors.length === 0;
      if (validated) validCount += 1;
      return {
        facility_id: row.facility_id,
        name: row.name,
        city: row.address_city,
        state: row.address_stateOrRegion,
        source_text: row.facility_profile_text,
        extraction: ext.extraction,
        validation_errors: ext.validation_errors,
        parse_error: ext.parse_error ?? null,
        validated,
        latency_ms: ext.latency_ms,
        tokens: {
          prompt: ext.prompt_tokens,
          completion: ext.completion_tokens,
        },
      };
    });

    tracker.addTokens('extract', totalPrompt, totalCompletion);
    const totalCost = estimateLlamaCost({
      promptTokens: totalPrompt,
      completionTokens: totalCompletion,
    });

    await tracker.finish({
      action: 'idp_live',
      resultCount: results.length,
      verifiedCount: validCount,
      verifiedTotal: results.length,
    });

    res.json({
      results,
      summary: {
        total: results.length,
        validated: validCount,
        validation_rate: results.length > 0 ? validCount / results.length : 0,
        total_prompt_tokens: totalPrompt,
        total_completion_tokens: totalCompletion,
        total_cost_usd: Number(totalCost.toFixed(6)),
      },
      trace_url: tracker.traceUrl(),
    });
  } catch (err) {
    await tracker.finish({ action: 'idp_live', errorMessage: err.message });
    if (err.name === 'AbortError') {
      return res.status(504).json({ error: 'IDP extraction timed out' });
    }
    next(err);
  }
});

export default router;
