/**
 * TheValveHubs — Database Connection
 * Uses pg (node-postgres) with Neon serverless PostgreSQL
 * Single pool shared across all warm function invocations
 */
const { Pool } = require('pg');

let pool;

function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 5,              // Small pool for serverless
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

    pool.on('error', (err) => {
      console.error('Unexpected pool error:', err.message);
      pool = null; // Reset so next call creates fresh pool
    });
  }
  return pool;
}

/**
 * Execute a query — auto-acquires/releases connection
 */
async function query(sql, params = []) {
  const p = getPool();
  const client = await p.connect();
  try {
    const result = await client.query(sql, params);
    return result;
  } finally {
    client.release();
  }
}

/**
 * Execute multiple queries in a transaction
 */
async function transaction(queries) {
  const p = getPool();
  const client = await p.connect();
  try {
    await client.query('BEGIN');
    const results = [];
    for (const { sql, params } of queries) {
      results.push(await client.query(sql, params || []));
    }
    await client.query('COMMIT');
    return results;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { query, transaction };
