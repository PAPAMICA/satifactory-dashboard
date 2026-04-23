import { useCallback, useEffect, useRef, useState } from "react";
import { aggregatePowerMwByBuildType, powerMWFromUsageRow } from "@/lib/monitoringFrm";

const DEFAULT_WINDOW_MS = 60 * 60_000;
const DEFAULT_MAX_SAMPLES = 450;

function snapshotMwByClass(rows: Record<string, unknown>[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const e of aggregatePowerMwByBuildType(rows, powerMWFromUsageRow)) {
    m.set(e.className, e.mw);
  }
  return m;
}

/**
 * Historise la conso agrégée par type de bâtiment à chaque mise à jour FRM (`dataUpdatedAt`),
 * sur une fenêtre glissante (par défaut 1 h), pour de mini courbes par type.
 */
export function usePowerUsageMwByClassHistory(
  usageRows: Record<string, unknown>[] | undefined,
  dataUpdatedAt: number | undefined,
  enabled: boolean,
  windowMs: number = DEFAULT_WINDOW_MS,
  maxSamples: number = DEFAULT_MAX_SAMPLES,
) {
  const rowsRef = useRef<Record<string, unknown>[]>([]);
  rowsRef.current = usageRows ?? [];

  const buf = useRef<{ ts: number; mwByClass: Map<string, number> }[]>([]);
  const [gen, setGen] = useState(0);

  useEffect(() => {
    if (!enabled || dataUpdatedAt == null || dataUpdatedAt === 0) return;
    const rows = rowsRef.current;
    if (!rows.length) return;

    const mwByClass = snapshotMwByClass(rows);
    const last = buf.current[buf.current.length - 1];
    if (last?.ts === dataUpdatedAt) {
      buf.current[buf.current.length - 1] = { ts: dataUpdatedAt, mwByClass };
    } else {
      buf.current.push({ ts: dataUpdatedAt, mwByClass });
    }

    const cutoff = Date.now() - windowMs;
    buf.current = buf.current.filter((s) => s.ts >= cutoff);
    if (buf.current.length > maxSamples) {
      buf.current = buf.current.slice(-maxSamples);
    }
    setGen((g) => g + 1);
  }, [enabled, dataUpdatedAt, windowMs, maxSamples]);

  const getSeries = useCallback(
    (className: string): number[] => buf.current.map((s) => s.mwByClass.get(className) ?? 0),
    [gen],
  );

  const sampleCount = buf.current.length;

  return { getSeries, sampleCount };
}
