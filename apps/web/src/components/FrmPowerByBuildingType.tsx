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
}: {
  values: number[];
  title?: string;
  /** Liste compacte : pas de marge haute, hauteur pilotée par le parent. */
  compact?: boolean;
}) {
  const w = 120;
  const h = 26;
  const marginCls = compact ? "mt-0 h-full max-h-[26px]" : "mt-1.5 h-[26px]";
  if (values.length < 2) {
    return (
      <div
        title={title}
        className={`${marginCls} w-full min-w-0 rounded bg-black/25 ring-1 ring-sf-border/30`}
        role="img"
        aria-hidden
      />
    );
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min;
  const pad = span < 1e-6 ? 1 : 0;
  const lo = min - pad;
  const hi = max + pad;
  const range = hi - lo || 1;
  const pts = values
    .map((v, i) => {
      const x = values.length === 1 ? w / 2 : (i / (values.length - 1)) * w;
      const y = h - 2 - ((Number(v) - lo) / range) * (h - 4);
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg
      className={`${marginCls} w-full min-w-0 text-sf-orange`}
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={title}
    >
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
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
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 overflow-auto p-2 sm:grid-cols-[repeat(auto-fill,minmax(200px,1fr))] sm:p-3">
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
              className="rounded-lg border border-sf-border/70 bg-black/20 p-2 shadow-sm ring-1 ring-white/[0.03]"
            >
              <div className="flex items-start gap-2">
                <ItemThumb className={uc} label="" size={44} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="min-w-0 truncate text-sm font-medium text-sf-cream">{typeLabel}</p>
                    <span className="shrink-0 font-mono text-xs text-sf-orange">{fmtMw(row.mw)}</span>
                  </div>
                  <p className="mt-0.5 truncate text-[0.65rem] text-sf-muted" title={row.className}>
                    {t("dashboard.widgets.powerByTypeCount", { count: row.count })}
                  </p>
                  <div className="mt-2">
                    <LinearFractionBar fraction={frac} kind={kind} />
                  </div>
                  {historyEnabled ?
                    <MiniMwSparkline
                      values={getSeries(row.className)}
                      title={t("dashboard.widgets.powerByTypeSparkAria")}
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
    <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-auto p-1.5 sm:gap-2 sm:p-3">
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
      <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto text-[0.65rem] sm:space-y-1.5 sm:text-xs">
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
                <div className="flex h-[26px] w-[88px] shrink-0 items-center self-center">
                  <MiniMwSparkline
                    values={getSeries(row.className)}
                    title={t("dashboard.widgets.powerByTypeSparkAria")}
                    compact
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
