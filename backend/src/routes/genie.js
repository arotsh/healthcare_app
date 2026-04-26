import { Router } from 'express';
import { askGenie, isGenieEnabled } from '../services/genie.js';
import { askGenieLocal, isLocalMode } from '../services/genieLocal.js';
import { startChatRun, isMlflowEnabled } from '../services/mlflow.js';

// Direct Genie endpoint — bypasses DECISION_SYSTEM classification.
// Used by the NGO Insights page where the question is already known to be analytical.
const router = Router();

router.post('/', async (req, res, next) => {
  if (!isLocalMode() && !isGenieEnabled()) {
    return res.status(503).json({ error: 'Genie not configured (DATABRICKS_GENIE_SPACE_ID missing)' });
  }

  const question = typeof req.body?.question === 'string' ? req.body.question.trim() : '';
  if (!question) {
    return res.status(400).json({ error: 'question is required' });
  }
  const conversationId =
    typeof req.body?.conversationId === 'string' && req.body.conversationId.trim()
      ? req.body.conversationId.trim()
      : null;

  let tracker = { stageStart() {}, stageEnd() {}, addTokens() {}, traceUrl() { return null; }, async finish() {} };
  if (isMlflowEnabled()) {
    tracker = await startChatRun({
      runName: 'medimap-genie-direct',
      query: question,
      hasLocation: false,
      clarifyCount: 0,
    });
  }

  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 90_000);
  try {
    tracker.stageStart('genie');
    const result = isLocalMode()
      ? await askGenieLocal(question)
      : await askGenie(question, { signal: ctrl.signal, conversationId });
    tracker.stageEnd('genie');
    await tracker.finish({
      action: 'genie_direct',
      resultCount: result?.table?.rows?.length ?? 0,
    });
    res.json({
      reply: result.answer || result.description || null,
      genie: {
        sql: result.sql,
        description: result.description,
        table: result.table,
        conversation_id: result.conversation_id,
        message_id: result.message_id,
      },
      trace_url: tracker.traceUrl(),
    });
  } catch (err) {
    tracker.stageEnd('genie');
    await tracker.finish({ action: 'genie_direct', errorMessage: err.message });
    if (err.name === 'AbortError') {
      return res.status(504).json({ error: 'Genie timed out' });
    }
    next(err);
  } finally {
    clearTimeout(timeout);
  }
});

export default router;
