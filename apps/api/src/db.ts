import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

export type UserRow = {
  id: number;
  username: string;
  password_hash: string;
  is_admin: number;
};

let db: DatabaseSync | null = null;

export function getDbPath(): string {
  const dir = process.env.DATA_DIR ?? path.join(process.cwd(), "data");
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, "dashboard.sqlite");
}

export function getDb(): DatabaseSync {
  if (!db) {
    db = new DatabaseSync(getDbPath());
    try {
      db.exec("PRAGMA journal_mode = WAL;");
    } catch {
      /* ignore if unsupported */
    }
    migrate(db);
  }
  return db;
}

function migrate(database: DatabaseSync) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
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

    /* Série temporelle agrégée (tout réseau) — index sur le temps pour requêtes plage */
    CREATE TABLE IF NOT EXISTS power_ts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ts_ms INTEGER NOT NULL,
      production REAL NOT NULL,
      consumption REAL NOT NULL,
      capacity REAL NOT NULL,
      battery_avg REAL,
      fuse_count INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_power_ts_ms ON power_ts (ts_ms);
  `);
}

export function getKv(key: string): string | undefined {
  const stmt = getDb().prepare("SELECT value FROM app_kv WHERE key = ?");
  const row = stmt.get(key) as { value: string } | undefined;
  return row?.value;
}

export function setKv(key: string, value: string) {
  getDb()
    .prepare(
      "INSERT INTO app_kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    )
    .run(key, value);
}

export function deleteKv(key: string) {
  getDb().prepare("DELETE FROM app_kv WHERE key = ?").run(key);
}
