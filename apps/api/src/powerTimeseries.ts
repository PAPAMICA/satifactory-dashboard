import { getPool } from "./db.js";

export type PowerCircuitRow = {
  PowerProduction?: number;
  PowerConsumed?: number;
  PowerCapacity?: number;
  BatteryPercent?: number;
  FuseTriggered?: boolean;
};

export type PowerSampleAgg = {
  tsMs: number;
  production: number;
  consumption: number;
  capacity: number;
  batteryAvg: number;
  fuseCount: number;
};

function sumPower(rows: PowerCircuitRow[], key: keyof PowerCircuitRow): number {
  if (!rows?.length) return 0;
  return rows.reduce((a, r) => a + (Number(r[key]) || 0), 0);
}

export function aggregatePowerSample(rows: PowerCircuitRow[], tsMs: number): PowerSampleAgg {
  const production = sumPower(rows, "PowerProduction");
  const consumption = sumPower(rows, "PowerConsumed");
  const capacity = sumPower(rows, "PowerCapacity");
  const fuseCount = rows.filter((p) => p.FuseTriggered).length;
  const batteryAvg =
    rows.length ?
      rows.reduce((a, p) => a + (Number(p.BatteryPercent) || 0), 0) / rows.length
    : 0;
  return {
    tsMs,
    production,
    consumption,
    capacity,
    batteryAvg,
    fuseCount,
  };
}

export async function insertPowerSample(rows: PowerCircuitRow[], tsMs = Date.now()): Promise<void> {
  const a = aggregatePowerSample(rows, tsMs);
  await getPool().query(
    `INSERT INTO power_ts (ts_ms, production, consumption, capacity, battery_avg, fuse_count)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [a.tsMs, a.production, a.consumption, a.capacity, a.batteryAvg, a.fuseCount],
  );
  await prunePowerSamples();
}

function retentionMs(): number {
  const days = Number(process.env.POWER_TS_RETENTION_DAYS ?? "90");
  const d = Number.isFinite(days) && days > 1 ? Math.min(days, 365) : 90;
  return d * 86_400_000;
}

async function prunePowerSamples(): Promise<void> {
  const cutoff = Date.now() - retentionMs();
  await getPool().query("DELETE FROM power_ts WHERE ts_ms < $1", [cutoff]);
}

export type PowerHistoryPoint = {
  tsMs: number;
  production: number;
  consumption: number;
  capacity: number;
  batteryAvg: number;
  fuseCount: number;
};

/** Derniers échantillons chronologiques (pour courbe dashboard). */
export async function queryPowerHistorySince(sinceMs: number, maxPoints: number): Promise<PowerHistoryPoint[]> {
  const cap = Math.min(Math.max(maxPoints, 10), 5000);
  const { rows } = await getPool().query<PowerHistoryPoint>(
    `SELECT ts_ms AS "tsMs", production, consumption, capacity,
            battery_avg AS "batteryAvg", fuse_count AS "fuseCount"
     FROM power_ts
     WHERE ts_ms >= $1
     ORDER BY ts_ms ASC`,
    [sinceMs],
  );
  if (rows.length <= cap) return rows;
  const stride = Math.ceil(rows.length / cap);
  const out: PowerHistoryPoint[] = [];
  for (let i = 0; i < rows.length; i += stride) {
    out.push(rows[i]!);
  }
  if (out[out.length - 1] !== rows[rows.length - 1]) {
    out.push(rows[rows.length - 1]!);
  }
  return out.slice(-cap);
}
