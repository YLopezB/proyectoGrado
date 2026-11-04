const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'postgres',
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DB,
  max: 10,
});
pool.on('error', (e) => console.error('[pg] error inesperado:', e.message));

const query = (text, params) => pool.query(text, params);

async function waitForDb(retries = 30, delayMs = 2000) {
  for (let i = 1; i <= retries; i++) {
    try {
      await pool.query('SELECT 1');
      console.log('[db] conexión establecida');
      return;
    } catch (e) {
      console.log(`[db] esperando PostgreSQL (${i}/${retries}): ${e.message}`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw new Error('No fue posible conectar con PostgreSQL');
}

module.exports = { pool, query, waitForDb };
