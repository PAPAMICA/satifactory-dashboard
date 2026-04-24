import { getPool } from "./db.js";

/** Fenêtre conservée en base (2 minutes). */
export const INVENTORY_RATE_RETENTION_MS = 120_000;
/** Fenêtre « dernière minute » pour le taux affiché. */
const LAST_MINUTE_MS = 60_000;
/** Écart minimal entre deux points pour éviter le bruit (poll ~2–10 s). */
const MIN_SPAN_MS = 2_000;

type AmountRow = { ts_ms: number; amount: number };

/** Enregistre un instantané d’inventaire (toutes les classes) et purge > 2 min. */
export async function recordInventorySamples(
  tsMs: number,
  items: { className: string; amount: number }[],
): Promise<void> {
  const pool = getPool();
  const cutoff = tsMs - INVENTORY_RATE_RETENTION_MS;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const it of items) {
      await client.query(
        `INSERT INTO inventory_samples (ts_ms, class_name, amount) VALUES ($1, $2, $3)
         ON CONFLICT (ts_ms, class_name) DO UPDATE SET amount = EXCLUDED.amount`,
        [tsMs, it.className, it.amount],
      );
    }
    await client.query("DELETE FROM inventory_samples WHERE ts_ms < $1", [cutoff]);
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

/** Enregistre les TotalPoints du sink (une série par ligne / index). */
export async function recordSinkSamples(kind: "resource" | "exploration", data: unknown, tsMs: number): Promise<void> {
  const rows = Array.isArray(data) ? data : data && typeof data === "object" ? [data] : [];
  const pool = getPool();
  const cutoff = tsMs - INVENTORY_RATE_RETENTION_MS;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (let idx = 0; idx < rows.length; idx++) {
      const row = rows[idx];
      const o = row as Record<string, unknown>;
      const tp = Number(o.TotalPoints ?? o.totalPoints);
      if (!Number.isFinite(tp)) continue;
      const key = `sink_${kind}_${idx}`;
      await client.query(
        `INSERT INTO scalar_samples (metric_key, ts_ms, value) VALUES ($1, $2, $3)
         ON CONFLICT (metric_key, ts_ms) DO UPDATE SET value = EXCLUDED.value`,
        [key, tsMs, tp],
      );
    }
    await client.query("DELETE FROM scalar_samples WHERE ts_ms < $1", [cutoff]);
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

async function samplesForClass(className: string, sinceMs: number): Promise<AmountRow[]> {
  const { rows } = await getPool().query<{ ts_ms: string | number; amount: string | number }>(
    "SELECT ts_ms, amount FROM inventory_samples WHERE class_name = $1 AND ts_ms >= $2 ORDER BY ts_ms ASC",
    [className, sinceMs],
  );
  return rows.map((r) => ({ ts_ms: Number(r.ts_ms), amount: Number(r.amount) }));
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
export async function computeInventoryRatesPerMinute(nowMs: number = Date.now()): Promise<Record<string, number>> {
  const since = nowMs - INVENTORY_RATE_RETENTION_MS;
  const { rows: classNames } = await getPool().query<{ class_name: string }>(
    "SELECT DISTINCT class_name FROM inventory_samples WHERE ts_ms >= $1 ORDER BY class_name",
    [since],
  );

  const rates: Record<string, number> = {};
  for (const { class_name } of classNames) {
    const samples = await samplesForClass(class_name, since);
    const ends = pickEndpoints(samples, nowMs);
    if (!ends) continue;
    const dt = ends.last.ts_ms - ends.first.ts_ms;
    if (dt < MIN_SPAN_MS) continue;
    const delta = ends.last.amount - ends.first.amount;
    rates[class_name] = (Math.max(0, delta) / dt) * 60_000;
  }
  return rates;
}

async function scalarSamplesForKey(metricKey: string, sinceMs: number): Promise<AmountRow[]> {
  const { rows } = await getPool().query<{ ts_ms: string | number; amount: string | number }>(
    "SELECT ts_ms, value AS amount FROM scalar_samples WHERE metric_key = $1 AND ts_ms >= $2 ORDER BY ts_ms ASC",
    [metricKey, sinceMs],
  );
  return rows.map((r) => ({ ts_ms: Number(r.ts_ms), amount: Number(r.amount) }));
}

/** Variation signée / minute (ex. points sink). */
export async function computeScalarRatePerMinute(metricKey: string, nowMs: number = Date.now()): Promise<number | null> {
  const since = nowMs - INVENTORY_RATE_RETENTION_MS;
  const samples = await scalarSamplesForKey(metricKey, since);
  const ends = pickEndpoints(samples, nowMs);
  if (!ends) return null;
  const dt = ends.last.ts_ms - ends.first.ts_ms;
  if (dt < MIN_SPAN_MS) return null;
  const delta = ends.last.amount - ends.first.amount;
  return (delta / dt) * 60_000;
}

/** Tous les taux sink connus en base (clés `sink_resource_0`, …). */
export async function computeAllSinkRatesPerMinute(nowMs: number = Date.now()): Promise<Record<string, number>> {
  const since = nowMs - INVENTORY_RATE_RETENTION_MS;
  const { rows: keys } = await getPool().query<{ metric_key: string }>(
    `SELECT DISTINCT metric_key FROM scalar_samples
     WHERE ts_ms >= $1
       AND (metric_key ~ '^sink_resource_[0-9]+$' OR metric_key ~ '^sink_exploration_[0-9]+$')
     ORDER BY metric_key`,
    [since],
  );

  const rates: Record<string, number> = {};
  for (const { metric_key } of keys) {
    const r = await computeScalarRatePerMinute(metric_key, nowMs);
    if (r != null && Number.isFinite(r)) rates[metric_key] = r;
  }
  return rates;
}
