import 'dotenv/config';
import { runQuery } from '../db.js';

const TABLE = process.env.DATABRICKS_TABLE;

const cols = await runQuery(`DESCRIBE TABLE ${TABLE}`);
console.log('Columns:');
for (const c of cols) {
  if (!c.col_name || c.col_name.startsWith('#')) continue;
  console.log(`  ${c.col_name.padEnd(40)} ${c.data_type}`);
}

const count = await runQuery(`SELECT count(*) AS n FROM ${TABLE}`);
console.log(`\nRow count: ${count[0]?.n}`);
process.exit(0);
