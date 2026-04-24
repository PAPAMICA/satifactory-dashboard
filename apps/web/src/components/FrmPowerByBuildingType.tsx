import { useTranslation } from "react-i18next";
import { LinearFractionBar } from "@/components/LinearFractionBar";
import { ItemThumb } from "@/components/ItemThumb";
import { usePowerUsageMwByClassHistory } from "@/hooks/usePowerUsageMwByClassHistory";
import { frmgClassLabel } from "@/lib/dashboardFrmgDisplay";
import { formatDecimalSpaces } from "@/lib/formatNumber";
import type { WidgetVariant } from "@/lib/dashboardWidgetCatalog";
import { rowThumbClass } from "@/lib/monitoringFrm";

function fmtMw(n: number): string {
  const v = Math.round(n * 10) / 10;
  return `${formatDecimalSpaces(v, 1)} MW`;
}

function MiniMwSparkline({
  values,
  title,
  compact,
  showAxes = true,
}: {
  values: number[];
  title?: string;
  /** Liste compacte : pas de marge haute, hauteur pilotée par le parent. */
  compact?: boolean;
  /** Axes L / bas (repères visuels pour la courbe MW). */
  showAxes?: boolean;
}) {
  const w = 120;
  const h = compact ? 22 : 30;
  const padL = showAxes ? 14 : 0;
  const padB = showAxes ? 6 : 2;
  const plotW = Math.max(1, w - padL - 2);
  const plotH = Math.max(1, h - padB - 2);
  const x0 = padL;
  const y0 = 1;
  const yAxisBottom = h - padB;
  const marginCls = compact ? "block h-[22px] w-full max-w-full shrink-0" : "mt-1.5 block h-[30px] w-full shrink-0";
  const axisStroke = "#5c5345";
  const gridStroke = "rgba(92,83,69,0.35)";
  const vals = values.map((v) => Number(v) || 0);

  const axisFrame = showAxes ? (
    <>
      <line x1={x0} y1={yAxisBottom} x2={w - 0.5} y2={yAxisBottom} stroke={axisStroke} strokeWidth="0.9" />
      <line x1={x0} y1={y0} x2={x0} y2={yAxisBottom} stroke={axisStroke} strokeWidth="0.9" />
      <line x1={x0 + plotW * 0.5} y1={y0 + 1} x2={x0 + plotW * 0.5} y2={yAxisBottom - 0.5} stroke={gridStroke} strokeWidth="0.45" />
      <line x1={w - 1} y1={yAxisBottom - 3} x2={w - 1} y2={yAxisBottom} stroke={axisStroke} strokeWidth="0.65" />
      <line x1={x0} y1={y0 + 1} x2={x0 + 3} y2={y0 + 1} stroke={axisStroke} strokeWidth="0.65" />
    </>
  ) : null;

  if (vals.length === 0) {
    return (
      <svg
        className={`${marginCls} min-w-0 rounded bg-black/25 text-sf-orange/70 ring-1 ring-sf-border/30`}
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={title}
      >
        {axisFrame}
        <line
          x1={x0 + 1}
          y1={y0 + plotH * 0.55}
          x2={x0 + plotW - 1}
          y2={y0 + plotH * 0.55}
          stroke="currentColor"
          strokeWidth="0.6"
          strokeDasharray="3 2"
          opacity="0.5"
        />
      </svg>
    );
  }

  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min;
  const pad = span < 1e-6 ? 1 : 0;
  const lo = min - pad;
  const hi = max + pad;
  const range = hi - lo || 1;

  const yForMw = (mw: number) => y0 + plotH - 2 - ((Number(mw) - lo) / range) * (plotH - 4);

  const ptsPairs: [number, number][] =
    vals.length === 1 ?
      [
        [x0 + 1, yForMw(vals[0])],
        [x0 + plotW - 1, yForMw(vals[0])],
      ]
    : vals.map((v, i) => {
        const x = x0 + (i / (vals.length - 1)) * plotW;
        return [x, yForMw(v)] as [number, number];
      });

  const pts = ptsPairs.map(([x, y]) => `${x},${y}`).join(" ");
  const fillD =
    vals.length >= 1 ?
      `M ${ptsPairs[0][0]},${yAxisBottom} L ${ptsPairs.map(([x, y]) => `${x},${y}`).join(" L ")} L ${ptsPairs[ptsPairs.length - 1][0]},${yAxisBottom} Z`
    : "";

  const fmtTick = (n: number) => (Math.abs(n) >= 100 ? String(Math.round(n)) : String(Math.round(n * 10) / 10));

  return (
    <svg
      className={`${marginCls} min-w-0 text-sf-orange`}
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={title}
    >
      {axisFrame}
      {showAxes && vals.length ?
        <>
          <text x={1} y={y0 + 8} fill="#7a6f5e" fontSize="6.5" fontFamily="ui-monospace, monospace">
            {fmtTick(hi)}
          </text>
          <text x={1} y={yAxisBottom - 1} fill="#7a6f5e" fontSize="6.5" fontFamily="ui-monospace, monospace">
            {fmtTick(lo)}
          </text>
        </>
      : null}
      {fillD ?
        <path d={fillD} fill="rgba(255, 154, 26, 0.12)" stroke="none" />
      : null}
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinejoin="round"
        strokeLinecap="round"
        points={pts}
      />
    </svg>
  );
}

export type FrmPowerByBuildingKind = "consumption" | "production";

export type FrmPowerByBuildingSummary = { label: string; value: string };

/**
 * Répartition conso / prod par type de bâtiment (même présentation que l’ancien widget conso du dashboard).
 */
export function FrmPowerByBuildingType({
  variant,
  entries,
  kind,
  summaries,
  emptyLabelKey = "monitoring.empty",
  maxVisualItems = 8,
  maxListItems = 14,
  usageHistoryRows,
  usageHistoryUpdatedAt,
}: {
  variant: WidgetVariant;
  entries: { className: string; count: number; mw: number }[];
  kind: FrmPowerByBuildingKind;
  summaries?: FrmPowerByBuildingSummary[];
  /** Clé i18n si `entries` est vide (évite une chaîne en dur). */
  emptyLabelKey?: string;
  maxVisualItems?: number;
  maxListItems?: number;
  /** Lignes brutes `getPowerUsage` : permet la mini courbe 1 h (conso par type). */
  usageHistoryRows?: Record<string, unknown>[];
  usageHistoryUpdatedAt?: number;
}) {
  const { t, i18n } = useTranslation();
  const historyEnabled =
    kind === "consumption" && Boolean(usageHistoryRows?.length && usageHistoryUpdatedAt);
  const { getSeries } = usePowerUsageMwByClassHistory(
    usageHistoryRows,
    usageHistoryUpdatedAt,
    historyEnabled,
  );
  const top = entries.slice(0, variant === "visual" ? maxVisualItems : maxListItems);
  const maxMw = top.length ? top[0].mw : 0;
  const thumbFallback = kind === "production" ? "Build_GeneratorFuel_C" : "Build_PowerTower_C";

  if (!top.length) {
    return <p className="p-3 text-sm text-sf-muted">{t(emptyLabelKey)}</p>;
  }

  if (variant === "visual") {
    return (
      <div className="grid min-h-0 w-full grid-cols-1 content-start items-start gap-2 overflow-x-auto overflow-y-visible p-2 sm:grid-cols-[repeat(auto-fill,minmax(200px,1fr))] sm:gap-2.5 sm:p-2.5 md:flex-1 md:overflow-auto">
        {summaries?.length ?
          <div className="col-span-full flex flex-wrap justify-center gap-3 sm:justify-start">
            {summaries.map((s, i) => (
              <div
                key={`${s.label}-${i}`}
                className="min-w-[140px] flex-1 rounded-lg border border-sf-border/80 bg-black/25 px-3 py-2 text-center shadow-sm ring-1 ring-white/[0.04] sm:text-left"
              >
                <p className="text-[0.65rem] uppercase tracking-wider text-sf-muted">{s.label}</p>
                <p className="sf-display mt-1 text-xl font-semibold text-sf-orange sm:text-2xl">{s.value}</p>
              </div>
            ))}
          </div>
        : null}
        {top.map((row, i) => {
          const uc = rowThumbClass({ ClassName: row.className }, thumbFallback);
          const typeLabel = frmgClassLabel(uc, i18n.language);
          const frac = maxMw > 0 ? row.mw / maxMw : 0;
          return (
            <div
              key={`${row.className}-${i}`}
              className="h-auto w-full max-w-full self-start rounded-lg border border-sf-border/70 bg-black/20 p-2 shadow-sm ring-1 ring-white/[0.03] sm:p-2.5"
            >
              <div className="flex items-start gap-2">
                <ItemThumb className={uc} label={typeLabel} size={34} />
                <div className="min-w-0 flex-1">
                  <p
                    className="line-clamp-2 text-[0.8125rem] font-semibold leading-snug text-sf-cream sm:text-sm"
                    title={typeLabel}
                  >
                    {typeLabel}
                  </p>
                  <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
                    <p className="text-[0.65rem] text-sf-muted" title={row.className}>
                      {t("dashboard.widgets.powerByTypeCount", { count: row.count })}
                    </p>
                    <span className="shrink-0 font-mono text-xs text-sf-orange">{fmtMw(row.mw)}</span>
                  </div>
                  <div className="mt-1.5">
                    <LinearFractionBar fraction={frac} kind={kind} />
                  </div>
                  {historyEnabled ?
                    <MiniMwSparkline
                      values={getSeries(row.className)}
                      title={t("dashboard.widgets.powerByTypeSparkAria")}
                      showAxes
                    />
                  : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex min-h-0 w-full flex-col gap-1.5 overflow-x-auto overflow-y-visible p-1.5 sm:gap-2 sm:p-3 md:flex-1 md:overflow-auto">
      {summaries?.length ?
        <div className="flex flex-wrap gap-2 text-[0.65rem] text-sf-muted sm:text-xs">
          {summaries.map((s, i) => (
            <span key={`${s.label}-${i}`}>
              <span className="text-sf-muted">{s.label}: </span>
              <span className="font-mono text-sf-orange">{s.value}</span>
            </span>
          ))}
        </div>
      : null}
      <ul className="min-h-0 space-y-1 overflow-y-auto text-[0.65rem] sm:space-y-1.5 sm:text-xs md:flex-1">
        {top.map((row, i) => {
          const uc = rowThumbClass({ ClassName: row.className }, thumbFallback);
          const typeLabel = frmgClassLabel(uc, i18n.language);
          return (
            <li
              key={`${row.className}-${i}`}
              className="flex min-h-0 items-center gap-1.5 rounded-lg border border-sf-border/50 bg-black/15 px-1.5 py-1.5 sm:gap-2 sm:px-2 sm:py-2"
            >
              <ItemThumb className={uc} label="" size={22} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-sf-cream">{typeLabel}</p>
                <p className="truncate text-[0.6rem] text-sf-muted">
                  {t("dashboard.widgets.powerByTypeCount", { count: row.count })}
                </p>
                <p className="mt-0.5 font-mono text-[0.65rem] text-sf-orange">{fmtMw(row.mw)}</p>
              </div>
              {historyEnabled ?
                <div className="flex h-[22px] w-[88px] shrink-0 items-center self-center">
                  <MiniMwSparkline
                    values={getSeries(row.className)}
                    title={t("dashboard.widgets.powerByTypeSparkAria")}
                    compact
                    showAxes={false}
                  />
                </div>
              : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function totalGeneratorMw(rows: Record<string, unknown>[], getMw: (r: Record<string, unknown>) => number): number {
  return Math.round(rows.reduce((a, r) => a + getMw(r), 0) * 10) / 10;
}
