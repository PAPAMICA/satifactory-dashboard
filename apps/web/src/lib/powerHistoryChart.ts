export type ChartTimeWindow = "1m" | "10m" | "30m" | "1h" | "4h" | "8h" | "1j" | "3j" | "7j";

export const CHART_TIME_WINDOWS: ChartTimeWindow[] = ["1m", "10m", "30m", "1h", "4h", "8h", "1j", "3j", "7j"];

export function chartWindowMinutes(w: ChartTimeWindow): number {
  switch (w) {
    case "1m":
      return 1;
    case "10m":
      return 10;
    case "30m":
      return 30;
    case "1h":
      return 60;
    case "4h":
      return 240;
    case "8h":
      return 480;
    case "1j":
      return 1440;
    case "3j":
      return 4320;
    case "7j":
      return 10080;
    default:
      return 1440;
  }
}

export function formatChartAxisTime(tsMs: number | string, windowMinutes: number, locale: string): string {
  const ms = typeof tsMs === "number" && Number.isFinite(tsMs) ? tsMs : Number(tsMs);
  const d = new Date(ms);
  if (!Number.isFinite(ms) || Number.isNaN(d.getTime())) {
    return "—";
  }
  if (windowMinutes <= 60) {
    return d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  }
  if (windowMinutes <= 480) {
    return d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleString(locale, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export type PowerHistoryRow = {
  tsMs: number;
  t: string;
  production: number;
  consumption: number;
  capacity: number;
};

export type PowerHistoryApiPoint = {
  tsMs: number;
  production: number;
  consumption: number;
  capacity: number;
};
