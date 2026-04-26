// Vercel catch-all serverless function — handles every /api/* request.
// We reuse the existing Express app from backend/src/server.js so all routes
// (chat, genie, idp, hospitals, health) come along for free. The Express
// `app.listen` call is skipped when VERCEL=1, so importing the module here
// is a pure side-effect-free routing graph.

import serverless from 'serverless-http';
import app from '../backend/src/server.js';

export default serverless(app);

export const config = {
  // Vercel Pro / Enterprise allow up to 60s / 300s respectively.
  // Our chat path runs decision → vector search → SQL → verify → summarize,
  // which is ~10-20s on a warm function. Free tier (10s) will time out.
  maxDuration: 60,
};
