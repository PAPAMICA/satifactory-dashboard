import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { apiFetch } from "@/lib/api";
import { asFrmRowArray } from "@/lib/frmRows";
import { formatDecimalSpaces } from "@/lib/formatNumber";
import {
  type ChartTimeWindow,
  chartWindowMinutes,
  CHART_TIME_WINDOWS,
  formatChartAxisTime,
  type PowerHistoryApiPoint,
  type PowerHistoryRow,
} from "@/lib/powerHistoryChart";
import { sumCircuitField } from "@/lib/monitoringFrm";

type Settings = { frmTokenConfigured: boolean; pollIntervalMs?: number };

function fmtMw(n: number): string {
  const v = Math.round(n * 10) / 10;
  return `${formatDecimalSpaces(v, 1)} MW`;
}

export type FrmPowerTrendVariant = "visual" | "standard";

export function FrmPowerTrendPanel({
  variant,
  chartWindow,
  onChartWindowChange,
  showWindowPicker,
}: {
  variant: FrmPowerTrendVariant;
  chartWindow: ChartTimeWindow;
  onChartWindowChange: (w: ChartTimeWindow) => void;
  showWindowPicker: boolean;
}) {
  const { t, i18n } = useTranslation();
  const [history, setHistory] = useState<PowerHistoryRow[]>([]);

  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: () => apiFetch<Settings>("/api/settings"),
    staleTime: 5_000,
    refetchInterval: 45_000,
  });

  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: () => apiFetch<{ isPublicViewer?: boolean }>("/api/me"),
    staleTime: 60_000,
  });
  const disableHistory = Boolean(me?.isPublicViewer);

  const frmOk = Boolean(settings?.frmTokenConfigured);
  const interval = settings?.pollIntervalMs ?? 10_000;

  const powerQuery = useQuery({
    queryKey: ["frm", "getPower"],
    queryFn: () => apiFetch<unknown>("/api/frm/getPower"),
    refetchInterval: interval,
    refetchIntervalInBackground: true,
    staleTime: 0,
    enabled: frmOk,
  });

  const chartWindowMin = chartWindowMinutes(chartWindow);
  const powerHistoryQuery = useQuery({
    queryKey: ["metrics", "power", "history", chartWindowMin, 400],
    queryFn: () =>
      apiFetch<{ points: PowerHistoryApiPoint[] }>(
        `/api/metrics/power/history?minutes=${chartWindowMin}&maxPoints=400`,
      ),
    enabled: frmOk && !disableHistory,
    staleTime: Infinity,
  });

  const circuits = useMemo(() => asFrmRowArray(powerQuery.data), [powerQuery.data]);
  const produced = sumCircuitField(circuits, "PowerProduction");
  const consumed = sumCircuitField(circuits, "PowerConsumed");
  const capacity = sumCircuitField(circuits, "PowerCapacity");

  useEffect(() => {
    setHistory([]);
  }, [chartWindow]);

  useEffect(() => {
    if (!frmOk) return;
    if (powerHistoryQuery.isPending || powerHistoryQuery.isFetching) return;
    if (powerHistoryQuery.isError) return;
    const pts = powerHistoryQuery.data?.points ?? [];
    const lang = i18n.language;
    const wm = chartWindowMin;
    setHistory(
      pts.map((p) => ({
        tsMs: p.tsMs,
        t: formatChartAxisTime(p.tsMs, wm, lang),
        production: Math.round(p.production * 10) / 10,
        consumption: Math.round(p.consumption * 10) / 10,
        capacity: Math.round(p.capacity * 10) / 10,
      })),
    );
  }, [
    frmOk,
    chartWindow,
    chartWindowMin,
    i18n.language,
    powerHistoryQuery.isPending,
    powerHistoryQuery.isFetching,
    powerHistoryQuery.isError,
    powerHistoryQuery.data,
  ]);

  useEffect(() => {
    if (!frmOk) return;
    const rows = circuits;
    if (!rows.length || !powerQuery.isSuccess) return;
    const windowMs = chartWindowMin * 60_000;
    const tsMs = Date.now();
    const production = Math.round(sumCircuitField(rows, "PowerProduction") * 10) / 10;
    const consumption = Math.round(sumCircuitField(rows, "PowerConsumed") * 10) / 10;
    const cap = Math.round(sumCircuitField(rows, "PowerCapacity") * 10) / 10;
    setHistory((prev) => {
      const label = formatChartAxisTime(tsMs, chartWindowMin, i18n.language);
      const next = [...prev, { tsMs, t: label, production, consumption, capacity: cap }];
      const cutoff = Date.now() - windowMs;
      return next.filter((r) => r.tsMs >= cutoff).slice(-400);
    });
  }, [frmOk, chartWindowMin, i18n.language, powerQuery.dataUpdatedAt, powerQuery.data, powerQuery.isSuccess, circuits]);

  const chartBody = useMemo(() => {
    const tickFs = variant === "visual" ? 11 : 9;
    const strokeW = variant === "visual" ? 2.5 : 2;
    const last = history.length ? history[history.length - 1] : null;
    const chartEmpty = !history.length;
    const summary = (
      <div className="mb-2 grid w-full min-w-0 grid-cols-1 gap-2 sm:grid-cols-3">
        <div className="rounded-lg border border-sf-border/80 bg-black/25 px-3 py-2 text-center shadow-sm ring-1 ring-white/[0.04] sm:text-left">
          <p className="text-[0.6rem] uppercase tracking-wider text-sf-muted">{t("dashboard.production")}</p>
          <p className="sf-display text-lg font-semibold text-sf-orange sm:text-xl">
            {fmtMw(last?.production ?? produced)}
          </p>
        </div>
        <div className="rounded-lg border border-sf-border/80 bg-black/25 px-3 py-2 text-center shadow-sm ring-1 ring-white/[0.04] sm:text-left">
          <p className="text-[0.6rem] uppercase tracking-wider text-sf-muted">{t("dashboard.consumption")}</p>
          <p className="sf-display text-lg font-semibold text-sf-cyan sm:text-xl">
            {fmtMw(last?.consumption ?? consumed)}
          </p>
        </div>
        <div className="rounded-lg border border-sf-border/80 bg-black/25 px-3 py-2 text-center shadow-sm ring-1 ring-white/[0.04] sm:text-left">
          <p className="text-[0.6rem] uppercase tracking-wider text-sf-muted">{t("dashboard.capacity")}</p>
          <p className="sf-display text-lg font-semibold text-sf-muted sm:text-xl">
            {fmtMw(last?.capacity ?? capacity)}
          </p>
        </div>
      </div>
    );
    const chart = (
      <div className="relative min-h-[220px] w-full flex-1 basis-0 sm:min-h-[260px]">
        {chartEmpty ? (
          <div className="pointer-events-none absolute inset-0 z-[1] flex items-center justify-center p-4 text-center text-sm leading-relaxed text-sf-muted">
            {t("dashboard.chartNoData")}
          </div>
        ) : null}
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={history}
            margin={{
              top: variant === "visual" ? 36 : 32,
              right: 8,
              left: variant === "visual" ? 2 : -8,
              bottom: 4,
            }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#3d3528" />
            <XAxis dataKey="t" tick={{ fill: "#8a7f6e", fontSize: tickFs }} interval="preserveStartEnd" />
            <YAxis tick={{ fill: "#8a7f6e", fontSize: tickFs }} width={variant === "visual" ? 40 : 32} />
            <Tooltip
              contentStyle={{
                background: "#1e1c18",
                border: "1px solid #3d3528",
                borderRadius: 2,
                fontSize: variant === "visual" ? 13 : 12,
              }}
              labelStyle={{ color: "#e8dcc8" }}
            />
            <Legend
              verticalAlign="top"
              align="left"
              wrapperStyle={{
                fontSize: variant === "visual" ? 11 : 10,
                color: "#8a7f6e",
                paddingBottom: 4,
              }}
              formatter={(value) => {
                if (value === "production") return t("dashboard.legendProduction");
                if (value === "consumption") return t("dashboard.legendConsumption");
                if (value === "capacity") return t("dashboard.legendCapacity");
                return value;
              }}
            />
            <Line
              type="monotone"
              dataKey="production"
              name="production"
              stroke="#ff9a1a"
              strokeWidth={strokeW}
              dot={false}
              isAnimationActive
              animationDuration={500}
            />
            <Line
              type="monotone"
              dataKey="consumption"
              name="consumption"
              stroke="#5fd4ff"
              strokeWidth={strokeW}
              dot={false}
              isAnimationActive
              animationDuration={500}
            />
            <Line
              type="monotone"
              dataKey="capacity"
              name="capacity"
              stroke="#8a7f6e"
              strokeWidth={strokeW}
              strokeDasharray="5 4"
              dot={false}
              isAnimationActive
              animationDuration={500}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
    return (
      <div className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col gap-2">
        {variant === "visual" ? <div className="shrink-0">{summary}</div> : null}
        {chart}
      </div>
    );
  }, [history, t, variant, produced, consumed, capacity, disableHistory]);

  const windowPicker = (
    <div
      role="group"
      aria-label={t("dashboard.chartWindowAria")}
      className="flex max-w-full shrink-0 flex-wrap gap-0.5 overflow-x-auto rounded border border-sf-border/60 bg-black/20 p-0.5"
    >
      {CHART_TIME_WINDOWS.map((w) => (
        <button
          key={w}
          type="button"
          className={`shrink-0 rounded px-1.5 py-0.5 font-mono text-[0.55rem] leading-tight transition-colors sm:text-[0.6rem] ${
            chartWindow === w ?
              "bg-sf-orange/25 text-sf-orange ring-1 ring-sf-orange/50"
            : "text-sf-muted hover:bg-black/30 hover:text-sf-text"
          }`}
          onClick={() => onChartWindowChange(w)}
        >
          {t(`dashboard.chartWindows.${w}`)}
        </button>
      ))}
    </div>
  );

  return (
    <div className="box-border flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden p-2 sm:p-3">
      {disableHistory ?
        <p className="mb-2 shrink-0 rounded border border-sf-border/50 bg-black/25 px-2 py-1.5 text-[0.65rem] leading-snug text-sf-muted">
          {t("dashboard.publicNoPowerHistory")}
        </p>
      : null}
      {showWindowPicker ?
        <div className="mb-2 flex flex-wrap items-center justify-end gap-2">{windowPicker}</div>
      : null}
      {chartBody}
    </div>
  );
}
