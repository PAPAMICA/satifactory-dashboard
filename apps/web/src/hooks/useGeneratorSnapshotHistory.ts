import { useEffect, useMemo, useRef, useState } from "react";
import { generatorMwLive } from "@/lib/monitoringFrm";

const DEFAULT_WINDOW_MS = 60 * 60_000;
const DEFAULT_MAX = 120;

function readSupplementCurrentConsumed(r: Record<string, unknown>): number {
  const sup = r.Supplement ?? r.supplement;
  if (!sup || typeof sup !== "object") return 0;
  const o = sup as Record<string, unknown>;
  return Number(o.CurrentConsumed ?? o.currentConsumed) || 0;
}

/**
 * Historise MW produits + conso du complément (eau, etc.) à chaque refresh `getGenerators`.
 */
export function useGeneratorSnapshotHistory(
  enabled: boolean,
  dataUpdatedAt: number | undefined,
  row: Record<string, unknown> | null,
  allRows: Record<string, unknown>[] | undefined,
  windowMs: number = DEFAULT_WINDOW_MS,
  maxSamples: number = DEFAULT_MAX,
) {
  const buf = useRef<{ ts: number; mw: number; sup: number }[]>([]);
  const [gen, setGen] = useState(0);

  useEffect(() => {
    if (!enabled || !row || dataUpdatedAt == null || dataUpdatedAt === 0) return;
    const id = String(row.ID ?? row.Id ?? "").trim();
    if (!id || !allRows?.length) return;
    const latest = allRows.find((x) => String(x.ID ?? x.Id ?? "") === String(row.ID ?? row.Id ?? ""));
    if (!latest) return;
    const mw = generatorMwLive(latest);
    const sup = readSupplementCurrentConsumed(latest);
    const last = buf.current[buf.current.length - 1];
    if (last?.ts === dataUpdatedAt) {
      buf.current[buf.current.length - 1] = { ts: dataUpdatedAt, mw, sup };
    } else {
      buf.current.push({ ts: dataUpdatedAt, mw, sup });
    }
    const cutoff = Date.now() - windowMs;
    buf.current = buf.current.filter((s) => s.ts >= cutoff);
    if (buf.current.length > maxSamples) buf.current = buf.current.slice(-maxSamples);
    setGen((g) => g + 1);
  }, [enabled, row, dataUpdatedAt, allRows, windowMs, maxSamples]);

  const chartData = useMemo(
    () => buf.current.map((p, i) => ({ i, mw: p.mw, sup: p.sup })),
    [gen],
  );

  return { chartData, sampleCount: buf.current.length };
}
