import type { FastifyBaseLogger } from "fastify";
import { getFrmConfig, frmFetchJson } from "./frm.js";
import type { PowerCircuitRow } from "./powerTimeseries.js";
import { insertPowerSample } from "./powerTimeseries.js";

/**
 * Échantillonne FRM sur l’intervalle lu à chaque cycle (poll_interval_ms),
 * indépendamment des clients — historique série temporelle fiable.
 */
export function startPowerSampler(
  getIntervalMs: () => number | Promise<number>,
  log: FastifyBaseLogger,
): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let busy = false;
  let stopped = false;

  const tick = async () => {
    if (stopped || busy) return;
    if (!(await getFrmConfig())) return;
    busy = true;
    try {
      const rows = await frmFetchJson<PowerCircuitRow[]>("/getPower");
      if (Array.isArray(rows) && rows.length) {
        await insertPowerSample(rows, Date.now());
      }
    } catch (e) {
      log.warn({ err: e }, "power sampler tick failed");
    } finally {
      busy = false;
    }
  };

  const loop = async () => {
    if (stopped) return;
    const raw = await Promise.resolve(getIntervalMs());
    const delay = Math.min(120_000, Math.max(2000, Number(raw) || 10_000));
    await tick();
    if (stopped) return;
    timer = setTimeout(() => void loop(), delay);
  };

  timer = setTimeout(() => void loop(), 1500);

  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    timer = null;
  };
}
