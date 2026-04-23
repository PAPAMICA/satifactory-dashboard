import { useEffect, useMemo, useRef, useState } from "react";
import type { InventoryItemRow } from "@/lib/items";

/** Garde quelques échantillons pour mémoire ; le taux utilise seulement les 2 derniers. */
const MAX_SAMPLES = 32;
const MIN_SPAN_MS = 400;

type Sample = { ts: number; amounts: Record<string, number> };

function unionClassNames(a: Record<string, number>, b: Record<string, number>): Set<string> {
  const keys = new Set<string>();
  for (const k of Object.keys(a)) keys.add(k);
  for (const k of Object.keys(b)) keys.add(k);
  return keys;
}

function fingerprintItems(items: InventoryItemRow[] | undefined): string {
  if (!items?.length) return "";
  return items.map((i) => `${i.className}:${i.amount}`).join("|");
}

function nextMonotonicSampleTs(dataUpdatedAt: number, prevSample: Sample | undefined): number {
  const fromQuery = dataUpdatedAt > 0 ? dataUpdatedAt : Date.now();
  if (!prevSample) return fromQuery;
  if (fromQuery > prevSample.ts) return fromQuery;
  return Math.max(Date.now(), prevSample.ts + 1);
}

/**
 * Estime l’acquisition (Δ quantité ≥ 0) par minute à partir du **dernier intervalle**
 * entre deux inventaires successifs (pas une moyenne sur 60 s à remplir).
 */
export function useInventoryRates(
  items: InventoryItemRow[] | undefined,
  dataUpdatedAt: number,
): Record<string, number> {
  const samplesRef = useRef<Sample[]>([]);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const [rates, setRates] = useState<Record<string, number>>({});

  const itemsFingerprint = useMemo(() => fingerprintItems(items), [items]);

  useEffect(() => {
    const cur = itemsRef.current;
    if (!cur?.length) {
      samplesRef.current = [];
      setRates({});
      return;
    }

    const amounts = Object.fromEntries(cur.map((i) => [i.className, i.amount]));
    const prev = samplesRef.current.at(-1);
    const ts = nextMonotonicSampleTs(dataUpdatedAt, prev);

    if (prev && prev.ts === ts) {
      prev.amounts = amounts;
    } else {
      samplesRef.current = [...samplesRef.current, { ts, amounts }].slice(-MAX_SAMPLES);
    }

    const samples = samplesRef.current;
    if (samples.length < 2) {
      setRates({});
      return;
    }

    const older = samples[samples.length - 2]!;
    const newer = samples[samples.length - 1]!;
    const dtMs = newer.ts - older.ts;
    if (dtMs < MIN_SPAN_MS) {
      return;
    }

    const keys = unionClassNames(older.amounts, newer.amounts);
    for (const cn of cur) keys.add(cn.className);

    const next: Record<string, number> = {};
    for (const className of keys) {
      const a0 = older.amounts[className] ?? 0;
      const a1 = newer.amounts[className] ?? 0;
      const delta = a1 - a0;
      next[className] = (Math.max(0, delta) / dtMs) * 60_000;
    }
    setRates(next);
  }, [dataUpdatedAt, itemsFingerprint]);

  return rates;
}
