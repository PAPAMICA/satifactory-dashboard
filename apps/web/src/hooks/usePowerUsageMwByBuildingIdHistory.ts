import { useCallback, useEffect, useRef, useState } from "react";
import { powerMWFromUsageRow } from "@/lib/monitoringFrm";

const DEFAULT_WINDOW_MS = 60 * 60_000;
const DEFAULT_MAX_SAMPLES = 450;

function mwForBuildingId(rows: Record<string, unknown>[], buildingId: string): number {
  const row = rows.find((r) => String(r.ID ?? r.Id ?? "").trim() === buildingId);
  if (!row) return 0;
  return powerMWFromUsageRow(row);
}

/**
 * Historise la conso MW d’un bâtiment précis (ligne `getPowerUsage` avec le même `ID`) à chaque rafraîchissement FRM.
 */
export function usePowerUsageMwByBuildingIdHistory(
  usageRows: Record<string, unknown>[] | undefined,
  dataUpdatedAt: number | undefined,
  enabled: boolean,
  buildingId: string | null | undefined,
  windowMs: number = DEFAULT_WINDOW_MS,
  maxSamples: number = DEFAULT_MAX_SAMPLES,
) {
  const rowsRef = useRef<Record<string, unknown>[]>([]);
  rowsRef.current = usageRows ?? [];
  const idRef = useRef(buildingId ?? null);
  idRef.current = buildingId ?? null;

  const buf = useRef<{ ts: number; mw: number }[]>([]);
  const [gen, setGen] = useState(0);

  useEffect(() => {
    buf.current = [];
  }, [buildingId]);

  useEffect(() => {
    const id = idRef.current;
    if (!enabled || !id || dataUpdatedAt == null || dataUpdatedAt === 0) return;
    const rows = rowsRef.current;
    const mw = mwForBuildingId(rows, id);
    const last = buf.current[buf.current.length - 1];
    if (last?.ts === dataUpdatedAt) {
      buf.current[buf.current.length - 1] = { ts: dataUpdatedAt, mw };
    } else {
      buf.current.push({ ts: dataUpdatedAt, mw });
    }
    const cutoff = Date.now() - windowMs;
    buf.current = buf.current.filter((s) => s.ts >= cutoff);
    if (buf.current.length > maxSamples) buf.current = buf.current.slice(-maxSamples);
    setGen((g) => g + 1);
  }, [enabled, dataUpdatedAt, buildingId, windowMs, maxSamples]);

  const getSeries = useCallback((): number[] => buf.current.map((s) => s.mw), [gen]);

  return { getSeries, sampleCount: buf.current.length };
}
