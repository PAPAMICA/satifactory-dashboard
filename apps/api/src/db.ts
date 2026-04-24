import pg from "pg";

export type UserRow = {
  id: number;
  username: string;
  password_hash: string;
  is_admin: number;
};

const { Pool } = pg;

let pool: pg.Pool | null = null;

/**
 * Chaîne type `postgresql://user:pass@host:5432/dbname` ou `postgres://...`
 * Variable d’environnement **obligatoire** (Docker Compose ou local).
 */
export async function initDb(): Promise<pg.Pool> {
  if (pool) return pool;
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error(
      "DATABASE_URL manquant : définir une URL PostgreSQL (ex. postgresql://ficsit:ficsit@localhost:5432/ficsit_control)",
    );
  }
  pool = new Pool({
    connectionString: url,
    max: Number(process.env.PG_POOL_MAX ?? "15"),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });
  pool.on("error", (err) => {
    // eslint-disable-next-line no-console
    console.error("[pg] pool error", err);
  });
  await migrate(pool);
  return pool;
}

export function getPool(): pg.Pool {
  if (!pool) {
    throw new Error("initDb() doit être appelé avant tout accès à la base");
  }
  return pool;
}

export async function closeDb(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

async function migrate(p: pg.Pool): Promise<void> {
  await p.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      is_admin INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS app_kv (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS favorites (
      class_name TEXT PRIMARY KEY
    );

    CREATE TABLE IF NOT EXISTS power_ts (
      id BIGSERIAL PRIMARY KEY,
      ts_ms BIGINT NOT NULL,
      production DOUBLE PRECISION NOT NULL,
      consumption DOUBLE PRECISION NOT NULL,
      capacity DOUBLE PRECISION NOT NULL,
      battery_avg DOUBLE PRECISION,
      fuse_count INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_power_ts_ms ON power_ts (ts_ms);

    CREATE TABLE IF NOT EXISTS inventory_samples (
      ts_ms BIGINT NOT NULL,
      class_name TEXT NOT NULL,
      amount DOUBLE PRECISION NOT NULL,
      PRIMARY KEY (ts_ms, class_name)
    );
    CREATE INDEX IF NOT EXISTS idx_inventory_samples_ts ON inventory_samples (ts_ms);

    CREATE TABLE IF NOT EXISTS scalar_samples (
      metric_key TEXT NOT NULL,
      ts_ms BIGINT NOT NULL,
      value DOUBLE PRECISION NOT NULL,
      PRIMARY KEY (metric_key, ts_ms)
    );
    CREATE INDEX IF NOT EXISTS idx_scalar_samples_ts ON scalar_samples (ts_ms);
  `);
}

export async function getKv(key: string): Promise<string | undefined> {
  const { rows } = await getPool().query<{ value: string }>("SELECT value FROM app_kv WHERE key = $1", [key]);
  return rows[0]?.value;
}

export async function setKv(key: string, value: string): Promise<void> {
  await getPool().query(
    `INSERT INTO app_kv (key, value) VALUES ($1, $2)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [key, value],
  );
}

export async function deleteKv(key: string): Promise<void> {
  await getPool().query("DELETE FROM app_kv WHERE key = $1", [key]);
}
