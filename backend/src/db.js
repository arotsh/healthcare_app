import { DBSQLClient } from '@databricks/sql';

const { DATABRICKS_HOST, DATABRICKS_TOKEN, DATABRICKS_HTTP_PATH } = process.env;

if (!DATABRICKS_HOST || !DATABRICKS_TOKEN || !DATABRICKS_HTTP_PATH) {
  throw new Error(
    'Missing Databricks env vars. Required: DATABRICKS_HOST, DATABRICKS_TOKEN, DATABRICKS_HTTP_PATH'
  );
}

const host = DATABRICKS_HOST.replace(/^https?:\/\//, '').replace(/\/.*$/, '');

export async function runQuery(sql, { namedParameters, maxRows = 10000 } = {}) {
  const client = new DBSQLClient();
  await client.connect({ host, path: DATABRICKS_HTTP_PATH, token: DATABRICKS_TOKEN });
  const session = await client.openSession();
  try {
    const op = await session.executeStatement(sql, {
      runAsync: true,
      ...(namedParameters ? { namedParameters } : {}),
    });
    const rows = await op.fetchAll({ maxRows });
    await op.close();
    return rows;
  } finally {
    await session.close();
    await client.close();
  }
}
