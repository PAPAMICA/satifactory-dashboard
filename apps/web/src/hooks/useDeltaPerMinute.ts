import { useEffect, useRef, useState } from "react";

const MIN_SPAN_MS = 400;
const MAX_SAMPLES = 32;

function nextMonotonicSampleTs(dataUpdatedAt: number, prevTs?: number): number {
  const fromQuery = dataUpdatedAt > 0 ? dataUpdatedAt : Date.now();
  if (prevTs === undefined) return fromQuery;
  if (fromQuery > prevTs) return fromQuery;
  return Math.max(Date.now(), prevTs + 1);
}

/**
 * Estime la variation par minute d’un scalaire sur le **dernier intervalle**
 * entre deux rafraîchissements (ex. `TotalPoints` du sink).
 */
export function useDeltaPerMinute(value: number, dataUpdatedAt: number): number | null {
  const samplesRef = useRef<{ ts: number; v: number }[]>([]);
  const [rate, setRate] = useState<number | null>(null);

  useEffect(() => {
    if (!Number.isFinite(value)) {
      samplesRef.current = [];
      setRate(null);
      return;
    }

    const arr = samplesRef.current;
    const last = arr.at(-1);
    const ts = nextMonotonicSampleTs(dataUpdatedAt, last?.ts);

    if (last && last.ts === ts) {
      last.v = value;
    } else {
      arr.push({ ts, v: value });
      while (arr.length > MAX_SAMPLES) arr.shift();
    }

    if (arr.length < 2) {
      setRate(null);
      return;
    }

    const older = arr[arr.length - 2]!;
    const newer = arr[arr.length - 1]!;
    const dtMs = newer.ts - older.ts;
    if (dtMs < MIN_SPAN_MS) {
      return;
    }

    const dv = newer.v - older.v;
    setRate((dv / dtMs) * 60_000);
  }, [value, dataUpdatedAt]);

  return rate;
}
