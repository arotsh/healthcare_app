import 'dotenv/config';
import { runQuery } from '../db.js';

const TABLE = process.env.DATABRICKS_TABLE;

try {
  console.log('Pinging Databricks…');
  const rows = await runQuery('SELECT 1 AS ok');
  console.log('SELECT 1 →', rows);

  if (TABLE) {
    console.log(`\nReading ${TABLE}…`);
    const sample = await runQuery(`SELECT * FROM ${TABLE} LIMIT 3`);
    console.log(sample);
  }
  process.exit(0);
} catch (err) {
  console.error('Ping failed:', err);
  process.exit(1);
}
