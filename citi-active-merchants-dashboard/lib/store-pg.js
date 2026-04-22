const { Pool } = require('pg');

const KEYS = { latest: 'latest', removals: 'removals', meta: 'meta' };

function poolOptions() {
  const connectionString = (process.env.DATABASE_URL || '').trim();
  const forceSsl =
    process.env.DATABASE_SSL === '1' ||
    process.env.DATABASE_SSL === 'true' ||
    process.env.DATABASE_SSL === 'require';
  const disableSsl = process.env.DATABASE_SSL === '0' || process.env.DATABASE_SSL === 'false';
  const local =
    /localhost|127\.0\.0\.1/i.test(connectionString) && !forceSsl;

  let ssl = undefined;
  if (disableSsl || local) {
    ssl = false;
  } else {
    ssl = { rejectUnauthorized: false };
  }

  return { connectionString, ssl, max: Number(process.env.PG_POOL_MAX || 10) };
}

async function createPgStore() {
  const pool = new Pool(poolOptions());
  await pool.query(`
    CREATE TABLE IF NOT EXISTS citi_dashboard_kv (
      k text PRIMARY KEY,
      v jsonb NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  `);

  async function get(key, fallback) {
    const r = await pool.query('SELECT v FROM citi_dashboard_kv WHERE k = $1', [key]);
    if (!r.rows.length) return fallback;
    return r.rows[0].v;
  }

  async function set(key, value) {
    await pool.query(
      `INSERT INTO citi_dashboard_kv (k, v, updated_at)
       VALUES ($1, $2::jsonb, now())
       ON CONFLICT (k) DO UPDATE SET v = EXCLUDED.v, updated_at = now()`,
      [key, JSON.stringify(value)]
    );
  }

  return {
    pool,
    kind: () => 'postgres',
    readLatest: () => get(KEYS.latest, null),
    readRemovals: async () => {
      const arr = await get(KEYS.removals, []);
      return Array.isArray(arr) ? arr : [];
    },
    readMeta: () => get(KEYS.meta, {}),
    writeLatest: (doc) => set(KEYS.latest, doc),
    writeRemovals: (list) => set(KEYS.removals, list),
    writeMeta: async (partial) => {
      const cur = await get(KEYS.meta, {});
      await set(KEYS.meta, { ...cur, ...partial, updatedAt: new Date().toISOString() });
    }
  };
}

module.exports = { createPgStore };
