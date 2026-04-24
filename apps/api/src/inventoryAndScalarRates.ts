import { getDb } from "./db.js";

/** Fenêtre conservée en base (2 minutes). */
export const INVENTORY_RATE_RETENTION_MS = 120_000;
/** Fenêtre « dernière minute » pour le taux affiché. */
const LAST_MINUTE_MS = 60_000;
/** Écart minimal entre deux points pour éviter le bruit (poll ~2–10 s). */
const MIN_SPAN_MS = 2_000;

type AmountRow = { ts_ms: number; amount: number };

function pruneInventoryOlderThan(db: ReturnType<typeof getDb>, beforeMs: number) {
  db.prepare("DELETE FROM inventory_samples WHERE ts_ms < ?").run(beforeMs);
}

function pruneScalarOlderThan(db: ReturnType<typeof getDb>, beforeMs: number) {
  db.prepare("DELETE FROM scalar_samples WHERE ts_ms < ?").run(beforeMs);
}

/** Enregistre un instantané d’inventaire (toutes les classes) et purge > 2 min. */
export function recordInventorySamples(tsMs: number, items: { className: string; amount: number }[]) {
  const db = getDb();
  const cutoff = tsMs - INVENTORY_RATE_RETENTION_MS;
  const upsert = db.prepare(
    "INSERT OR REPLACE INTO inventory_samples (ts_ms, class_name, amount) VALUES (?, ?, ?)",
  );
  for (const it of items) {
    upsert.run(tsMs, it.className, it.amount);
  }
  pruneInventoryOlderThan(db, cutoff);
}

/** Enregistre les TotalPoints du sink (une série par ligne / index). */
export function recordSinkSamples(kind: "resource" | "exploration", data: unknown, tsMs: number) {
  const rows = Array.isArray(data) ? data : data && typeof data === "object" ? [data] : [];
  const db = getDb();
  const cutoff = tsMs - INVENTORY_RATE_RETENTION_MS;
  const upsert = db.prepare(
    "INSERT OR REPLACE INTO scalar_samples (metric_key, ts_ms, value) VALUES (?, ?, ?)",
  );
  rows.forEach((row, idx) => {
    const o = row as Record<string, unknown>;
    const tp = Number(o.TotalPoints ?? o.totalPoints);
    if (!Number.isFinite(tp)) return;
    const key = `sink_${kind}_${idx}`;
    upsert.run(key, tsMs, tp);
  });
  pruneScalarOlderThan(db, cutoff);
}

function samplesForClass(db: ReturnType<typeof getDb>, className: string, sinceMs: number): AmountRow[] {
  return db
    .prepare(
      "SELECT ts_ms, amount FROM inventory_samples WHERE class_name = ? AND ts_ms >= ? ORDER BY ts_ms ASC",
    )
    .all(className, sinceMs) as AmountRow[];
}

function pickEndpoints(samples: AmountRow[], nowMs: number): { first: AmountRow; last: AmountRow } | null {
  if (samples.length < 2) return null;
  const inLastMinute = samples.filter((s) => s.ts_ms >= nowMs - LAST_MINUTE_MS && s.ts_ms <= nowMs);
  const use = inLastMinute.length >= 2 ? inLastMinute : samples;
  if (use.length < 2) return null;
  const first = use[0]!;
  const last = use[use.length - 1]!;
  return { first, last };
}

/** Taux d’acquisition (≥ 0) / min par classe, moyenne glissante sur la dernière minute (données 2 min en base). */
export function computeInventoryRatesPerMinute(nowMs: number = Date.now()): Record<string, number> {
  const db = getDb();
  const since = nowMs - INVENTORY_RATE_RETENTION_MS;
  const classNames = db
    .prepare(
      "SELECT DISTINCT class_name FROM inventory_samples WHERE ts_ms >= ? ORDER BY class_name",
    )
    .all(since) as { class_name: string }[];

  const rates: Record<string, number> = {};
  for (const { class_name } of classNames) {
    const samples = samplesForClass(db, class_name, since);
    const ends = pickEndpoints(samples, nowMs);
    if (!ends) continue;
    const dt = ends.last.ts_ms - ends.first.ts_ms;
    if (dt < MIN_SPAN_MS) continue;
    const delta = ends.last.amount - ends.first.amount;
    rates[class_name] = (Math.max(0, delta) / dt) * 60_000;
  }
  return rates;
}

function scalarSamplesForKey(db: ReturnType<typeof getDb>, metricKey: string, sinceMs: number): AmountRow[] {
  return db
    .prepare(
      "SELECT ts_ms, value AS amount FROM scalar_samples WHERE metric_key = ? AND ts_ms >= ? ORDER BY ts_ms ASC",
    )
    .all(metricKey, sinceMs) as AmountRow[];
}

/** Variation signée / minute (ex. points sink). */
export function computeScalarRatePerMinute(metricKey: string, nowMs: number = Date.now()): number | null {
  const db = getDb();
  const since = nowMs - INVENTORY_RATE_RETENTION_MS;
  const samples = scalarSamplesForKey(db, metricKey, since);
  const ends = pickEndpoints(samples, nowMs);
  if (!ends) return null;
  const dt = ends.last.ts_ms - ends.first.ts_ms;
  if (dt < MIN_SPAN_MS) return null;
  const delta = ends.last.amount - ends.first.amount;
  return (delta / dt) * 60_000;
}

/** Tous les taux sink connus en base (clés `sink_resource_0`, …). */
export function computeAllSinkRatesPerMinute(nowMs: number = Date.now()): Record<string, number> {
  const db = getDb();
  const since = nowMs - INVENTORY_RATE_RETENTION_MS;
  const keys = db
    .prepare(
      "SELECT DISTINCT metric_key FROM scalar_samples WHERE ts_ms >= ? AND (metric_key GLOB 'sink_resource_*' OR metric_key GLOB 'sink_exploration_*') ORDER BY metric_key",
    )
    .all(since) as { metric_key: string }[];

  const rates: Record<string, number> = {};
  for (const { metric_key } of keys) {
    const r = computeScalarRatePerMinute(metric_key, nowMs);
    if (r != null && Number.isFinite(r)) rates[metric_key] = r;
  }
  return rates;
}
