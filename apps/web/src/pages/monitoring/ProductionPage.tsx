import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { FactoryLocationMap } from "@/components/FactoryLocationMap";
import { FicsitPageLoader } from "@/components/FicsitPageLoader";
import { ItemThumb } from "@/components/ItemThumb";
import { MonitoringGate } from "@/components/MonitoringGate";
import { useFrmRefetchMs } from "@/hooks/useFrmRefetchMs";
import { apiFetch } from "@/lib/api";
import { asFrmRowArray } from "@/lib/frmRows";
import { frmgClassLabel } from "@/lib/dashboardFrmgDisplay";
import { frmGetUrl } from "@/lib/frmApi";
import { itemLabel } from "@/lib/itemCatalog";
import { formatDecimalSpaces, formatIntegerSpaces } from "@/lib/formatNumber";
import {
  factoryBuildingClassForThumb,
  factoryCircuitGroupId,
  factoryCircuitId,
  factoryHasPowerConnection,
  factoryIngredientLines,
  factoryIsBoosted,
  factoryManuSpeedPct,
  factoryPowerConsumedMw,
  factoryPowerMaxMw,
  factoryPowerShards,
  factoryProductivityPct,
  factoryProductionLines,
  factorySomersloops,
  factoryStatusBucket,
  factoryTotalCurrentConsumePerMin,
  factoryTotalCurrentProdPerMin,
  type FactoryStatusBucket,
  type ProductionLine,
} from "@/lib/productionFrm";

const MAX_ROWS = 300;

/** Nom d’affichage catalogue uniquement (pas le nom anglais FRM `Name`). */
function productionItemDisplayName(line: ProductionLine, lang: string): string {
  const c = String(line.ClassName ?? line.className ?? "").trim();
  if (!c) return "—";
  return itemLabel(c, lang) ?? c;
}

/** Texte de recherche pour les sorties `production[]` (libellés FR/EN + classe + nom FRM). */
function factoryRowProductionItemsHaystack(r: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const line of factoryProductionLines(r)) {
    const c = String(line.ClassName ?? line.className ?? "").trim();
    if (c) {
      parts.push(c);
      const lf = itemLabel(c, "fr");
      const le = itemLabel(c, "en");
      if (lf) parts.push(lf);
      if (le && le !== lf) parts.push(le);
    }
    const nm = String(line.Name ?? line.name ?? "").trim();
    if (nm) parts.push(nm);
  }
  return parts.join(" ").toLowerCase();
}

const STATUS_SORT_RANK: Record<FactoryStatusBucket, number> = {
  producing: 0,
  standby: 1,
  paused: 2,
  not_configured: 3,
};

/** Titre usine : type traduit ; sous-titre seulement si le nom FRM est un vrai renommage. */
function factoryBuildingPrimarySecondary(
  r: Record<string, unknown>,
  lang: string,
): { primary: string; secondary?: string } {
  const thumbCls = factoryBuildingClassForThumb(r);
  const type = frmgClassLabel(thumbCls, lang);
  const typeEn = frmgClassLabel(thumbCls, "en");
  const typeFr = frmgClassLabel(thumbCls, "fr");
  const inst = String(r.Name ?? r.name ?? "").trim();
  if (!inst) return { primary: type };
  const il = inst.toLowerCase();
  if (il === type.toLowerCase() || il === typeEn.toLowerCase() || il === typeFr.toLowerCase()) {
    return { primary: type };
  }
  return { primary: type, secondary: inst };
}

function factoryRowMatchesText(r: Record<string, unknown>, f: string, lang: string): boolean {
  const thumb = factoryBuildingClassForThumb(r);
  const blob = [
    String(r.Name ?? r.name ?? ""),
    String(r.ClassName ?? r.className ?? ""),
    String(r.Recipe ?? r.recipe ?? ""),
    frmgClassLabel(thumb, "fr"),
    frmgClassLabel(thumb, "en"),
    frmgClassLabel(thumb, lang),
    factoryRowProductionItemsHaystack(r),
  ]
    .join(" ")
    .toLowerCase();
  return blob.includes(f);
}

function RecipeOutputsList({
  lines,
  lang,
  thumbSize = 32,
  dense,
}: {
  lines: ProductionLine[];
  lang: string;
  thumbSize?: number;
  dense?: boolean;
}) {
  const { t } = useTranslation();
  if (!lines.length) {
    return <p className="text-xs text-sf-muted">{t("monitoring.productionRecipeEmpty")}</p>;
  }
  return (
    <ul className={dense ? "space-y-1" : "space-y-2"}>
      {lines.map((line, i) => {
        const cls = String(line.ClassName ?? line.className ?? "").trim();
        const thumbCls = cls || "Desc_IronPlate_C";
        const nm = productionItemDisplayName(line, lang);
        return (
          <li
            key={`${cls}-${i}`}
            className="flex items-center justify-between gap-2 border-b border-sf-border/25 py-1.5 last:border-b-0"
          >
            <span className={`min-w-0 flex-1 truncate text-sf-cream ${dense ? "text-xs" : "text-sm"}`}>{nm}</span>
            <ItemThumb className={thumbCls} label={nm} size={thumbSize} />
          </li>
        );
      })}
    </ul>
  );
}

function chartRowsProd(lines: ProductionLine[], lang: string, maxLabelLen = 22) {
  return lines.map((line) => {
    const full = productionItemDisplayName(line, lang);
    const name = full.length > maxLabelLen ? `${full.slice(0, maxLabelLen - 1)}…` : full;
    return {
      name,
      current: Math.round((Number(line.CurrentProd ?? line.currentProd) || 0) * 100) / 100,
      max: Math.round((Number(line.MaxProd ?? line.maxProd) || 0) * 100) / 100,
    };
  });
}

function ProductionModal({
  row,
  onClose,
}: {
  row: Record<string, unknown>;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const thumbCls = factoryBuildingClassForThumb(row);
  const { primary, secondary } = factoryBuildingPrimarySecondary(row, i18n.language);
  const mapPopupTitle = secondary ? `${primary} — ${secondary}` : primary;

  const prodLines = factoryProductionLines(row);
  const ingLines = factoryIngredientLines(row);
  const outChart = chartRowsProd(prodLines, i18n.language);
  const inChart = ingLines.map((line) => {
    const full = productionItemDisplayName(line, i18n.language);
    const name = full.length > 22 ? `${full.slice(0, 20)}…` : full;
    return {
      name,
      current: Math.round((Number(line.CurrentConsumed) || 0) * 100) / 100,
      max: Math.round((Number(line.MaxConsumed) || 0) * 100) / 100,
    };
  });

  const manu = factoryManuSpeedPct(row);
  const shards = factoryPowerShards(row);
  const loops = factorySomersloops(row);
  const boosted = factoryIsBoosted(row);
  const g = factoryCircuitGroupId(row);
  const c = factoryCircuitId(row);
  const connected = factoryHasPowerConnection(row);
  const pCur = factoryPowerConsumedMw(row);
  const pMax = factoryPowerMaxMw(row);
  const effPct = factoryProductivityPct(row);

  const isConfigured = Boolean(row.IsConfigured ?? row.isConfigured);
  const isProducing = Boolean(row.IsProducing ?? row.isProducing);
  const isPaused = Boolean(row.IsPaused ?? row.isPaused);

  const chartH = 200;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col bg-black/80 p-0 sm:p-2"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal
        aria-labelledby="production-modal-title"
        className="flex h-[100dvh] max-h-[100dvh] w-full max-w-none flex-col overflow-hidden rounded-none border-0 border-sf-border/80 bg-[#14120f] shadow-2xl ring-1 ring-black/40 sm:mx-auto sm:h-[min(calc(100dvh-16px),920px)] sm:max-h-[min(calc(100dvh-16px),920px)] sm:w-[min(100%,calc(100vw-16px))] sm:max-w-[min(1600px,calc(100vw-16px))] sm:rounded-xl sm:border"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-sf-border/60 px-4 py-3 sm:px-5">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <ItemThumb className={thumbCls} label={primary} size={44} />
            <div className="min-w-0">
              <h2 id="production-modal-title" className="sf-display text-base font-semibold text-sf-cream sm:text-lg">
                {primary}
              </h2>
              {secondary ?
                <p className="mt-0.5 truncate text-xs text-sf-muted">{secondary}</p>
              : null}
              <p className="mt-1 font-mono text-[0.65rem] text-sf-muted">
                {t("monitoring.productionFilterEfficiency")}: {formatDecimalSpaces(effPct, 1)}%
              </p>
            </div>
          </div>
          <button
            type="button"
            className="shrink-0 rounded border border-sf-border/60 px-3 py-1.5 text-xs text-sf-muted hover:border-sf-orange/50 hover:text-sf-orange"
            onClick={onClose}
          >
            {t("monitoring.productionClose")}
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row lg:items-stretch">
          <div className="flex min-h-0 w-full flex-col gap-3 overflow-y-auto border-sf-border/40 p-4 sm:p-5 lg:w-[58%] lg:shrink-0 lg:border-r lg:pr-5">
            <div className="rounded-lg border border-sf-border/70 bg-black/25 p-3 ring-1 ring-white/[0.04] sm:p-4">
              <p className="text-[0.65rem] font-medium uppercase tracking-wider text-sf-muted">
                {t("monitoring.productionRecipeItems")}
              </p>
              <div className="mt-2 max-h-[min(30vh,260px)] overflow-y-auto pr-1 lg:max-h-none">
                <RecipeOutputsList lines={prodLines} lang={i18n.language} thumbSize={36} />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-sf-border/70 bg-black/25 p-3 ring-1 ring-white/[0.04] sm:p-3.5">
                <p className="text-[0.6rem] font-medium uppercase tracking-wider text-sf-muted">
                  {t("monitoring.productionCardState")}
                </p>
                <ul className="mt-1.5 space-y-1 text-xs text-sf-cream sm:text-sm">
                  <li>
                    {t("monitoring.productionConfigured")}:{" "}
                    <span className={isConfigured ? "text-sf-ok" : "text-sf-muted"}>
                      {isConfigured ? t("common.yes") : t("common.no")}
                    </span>
                  </li>
                  <li>
                    {t("monitoring.productionProducing")}:{" "}
                    <span className={isProducing ? "text-sf-ok" : "text-sf-muted"}>
                      {isProducing ? t("common.yes") : t("common.no")}
                    </span>
                  </li>
                  <li>
                    {t("monitoring.productionPaused")}:{" "}
                    <span className={isPaused ? "text-sf-orange" : "text-sf-muted"}>
                      {isPaused ? t("common.yes") : t("common.no")}
                    </span>
                  </li>
                </ul>
              </div>

              <div className="rounded-lg border border-sf-border/70 bg-black/25 p-3 ring-1 ring-white/[0.04] sm:p-3.5">
                <p className="text-[0.6rem] font-medium uppercase tracking-wider text-sf-muted">
                  {t("monitoring.productionCardBoost")}
                </p>
                <ul className="mt-1.5 space-y-1 text-xs text-sf-cream sm:text-sm">
                  <li>
                    {t("monitoring.productionSpeed", { n: formatDecimalSpaces(manu, 1) })}
                    {boosted ? <span className="ml-1 text-sf-orange">({t("monitoring.productionBoost")})</span> : null}
                  </li>
                  <li>
                    {t("monitoring.productionPowerShards")}:{" "}
                    <span className="font-mono text-sf-cyan">{formatIntegerSpaces(shards)}</span>
                  </li>
                  <li>
                    {t("monitoring.productionSomersloops")}:{" "}
                    <span className="font-mono text-sf-cyan">{formatIntegerSpaces(loops)}</span>
                  </li>
                </ul>
              </div>

              <div className="rounded-lg border border-sf-border/70 bg-black/25 p-3 ring-1 ring-white/[0.04] sm:col-span-1 sm:p-3.5">
                <p className="text-[0.6rem] font-medium uppercase tracking-wider text-sf-muted">
                  {t("monitoring.productionCardPower")}
                </p>
                <p className="mt-1.5 text-xs text-sf-cream sm:text-sm">
                  {connected && g != null && c != null ?
                    t("monitoring.productionConnect", { g, c })
                  : t("monitoring.productionNotConnected")}
                </p>
                <p className="mt-1 font-mono text-sm text-sf-orange sm:text-base">
                  {formatDecimalSpaces(pCur, 2)} / {formatDecimalSpaces(pMax, 2)} MW
                </p>
              </div>
            </div>

            {outChart.length || inChart.length ?
              <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-2">
                {outChart.length ?
                  <div className="flex min-h-0 flex-col rounded-lg border border-sf-border/70 bg-black/20 p-3">
                    <p className="mb-1 shrink-0 text-[0.65rem] font-medium uppercase tracking-wider text-sf-muted">
                      {t("monitoring.productionChartOutputs")}
                    </p>
                    <div className="min-h-0 w-full flex-1" style={{ height: chartH, minHeight: chartH }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={outChart} layout="vertical" margin={{ left: 4, right: 4, top: 2, bottom: 2 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#3d3528" horizontal={false} />
                          <XAxis type="number" tick={{ fill: "#8a7f6e", fontSize: 9 }} />
                          <YAxis type="category" dataKey="name" width={100} tick={{ fill: "#8a7f6e", fontSize: 8 }} />
                          <Tooltip
                            contentStyle={{ background: "#1a1814", border: "1px solid #3d3528", borderRadius: 4 }}
                            formatter={(v: number, name: string) => [
                              v,
                              name === "current" ? t("monitoring.productionChartCurrent") : t("monitoring.productionChartMax"),
                            ]}
                          />
                          <Legend
                            wrapperStyle={{ fontSize: 10 }}
                            formatter={(v) =>
                              v === "current" ? t("monitoring.productionChartCurrent") : t("monitoring.productionChartMax")
                            }
                          />
                          <Bar dataKey="current" name="current" fill="#7cfc8a" radius={[0, 3, 3, 0]} />
                          <Bar dataKey="max" name="max" fill="#4a4336" radius={[0, 3, 3, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                : null}
                {inChart.length ?
                  <div className="flex min-h-0 flex-col rounded-lg border border-sf-border/70 bg-black/20 p-3">
                    <p className="mb-1 shrink-0 text-[0.65rem] font-medium uppercase tracking-wider text-sf-muted">
                      {t("monitoring.productionChartInputs")}
                    </p>
                    <div className="min-h-0 w-full flex-1" style={{ height: chartH, minHeight: chartH }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={inChart} layout="vertical" margin={{ left: 4, right: 4, top: 2, bottom: 2 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#3d3528" horizontal={false} />
                          <XAxis type="number" tick={{ fill: "#8a7f6e", fontSize: 9 }} />
                          <YAxis type="category" dataKey="name" width={100} tick={{ fill: "#8a7f6e", fontSize: 8 }} />
                          <Tooltip
                            contentStyle={{ background: "#1a1814", border: "1px solid #3d3528", borderRadius: 4 }}
                            formatter={(v: number, name: string) => [
                              v,
                              name === "current" ? t("monitoring.productionChartCurrent") : t("monitoring.productionChartMax"),
                            ]}
                          />
                          <Legend
                            wrapperStyle={{ fontSize: 10 }}
                            formatter={(v) =>
                              v === "current" ? t("monitoring.productionChartCurrent") : t("monitoring.productionChartMax")
                            }
                          />
                          <Bar dataKey="current" name="current" fill="#5fd4ff" radius={[0, 3, 3, 0]} />
                          <Bar dataKey="max" name="max" fill="#4a4336" radius={[0, 3, 3, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                : null}
              </div>
            : null}
          </div>

          <div className="flex w-full shrink-0 flex-col border-t border-sf-border/50 bg-black/10 p-4 sm:p-5 lg:h-full lg:min-h-0 lg:w-[42%] lg:min-w-0 lg:max-w-[42%] lg:shrink-0 lg:border-l lg:border-t-0 lg:pl-5">
            <p className="text-[0.65rem] font-medium uppercase tracking-wider text-sf-muted lg:sr-only">
              {t("monitoring.productionModalMap")}
            </p>
            <div className="flex min-h-[min(280px,55vw)] flex-1 items-center justify-center lg:min-h-0">
              <div className="aspect-square w-full max-w-full max-h-full min-h-0 overflow-hidden rounded-lg border border-sf-border/60 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03)]">
                <FactoryLocationMap row={row} title={mapPopupTitle} fillParent className="h-full min-h-0 w-full rounded-lg border-0" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

type ProductionStatusFilter = "all" | FactoryStatusBucket;
type ProductionBoostFilter = "all" | "yes" | "no";
type ProductionEffFilter = "all" | "high" | "mid" | "low";
type ProductionSortKey = "name" | "status" | "boost" | "efficiency";
type ProductionSortDir = "asc" | "desc";

function ProductionPageBody() {
  const { t, i18n } = useTranslation();
  const refetchMs = useFrmRefetchMs();
  const [filter, setFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<ProductionStatusFilter>("all");
  const [boostFilter, setBoostFilter] = useState<ProductionBoostFilter>("all");
  const [effFilter, setEffFilter] = useState<ProductionEffFilter>("all");
  const [sortKey, setSortKey] = useState<ProductionSortKey>("name");
  const [sortDir, setSortDir] = useState<ProductionSortDir>("asc");
  const [selected, setSelected] = useState<Record<string, unknown> | null>(null);

  const q = useQuery({
    queryKey: ["frm", "getFactory"],
    queryFn: () => apiFetch<unknown>(frmGetUrl("getFactory")),
    refetchInterval: refetchMs,
  });
  const rows = asFrmRowArray(q.data);
  const f = filter.trim().toLowerCase();
  const lang = i18n.language;

  const textFiltered = useMemo(() => {
    if (!f) return rows;
    return rows.filter((r) => factoryRowMatchesText(r, f, lang));
  }, [rows, f, lang]);

  const filtered = useMemo(() => {
    return textFiltered.filter((r) => {
      if (statusFilter !== "all" && factoryStatusBucket(r) !== statusFilter) return false;
      if (boostFilter === "yes" && !factoryIsBoosted(r)) return false;
      if (boostFilter === "no" && factoryIsBoosted(r)) return false;
      const eff = factoryProductivityPct(r);
      if (effFilter === "high" && eff < 75) return false;
      if (effFilter === "mid" && (eff < 25 || eff >= 75)) return false;
      if (effFilter === "low" && eff >= 25) return false;
      return true;
    });
  }, [textFiltered, statusFilter, boostFilter, effFilter]);

  const sorted = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    const list = filtered.map((r) => {
      const { primary, secondary } = factoryBuildingPrimarySecondary(r, lang);
      return {
        row: r,
        primary,
        secondary,
        boosted: factoryIsBoosted(r),
        bucket: factoryStatusBucket(r),
        efficiency: factoryProductivityPct(r),
      };
    });
    list.sort((a, b) => {
      let c = 0;
      if (sortKey === "name") {
        c = a.primary.localeCompare(b.primary, lang, { sensitivity: "base" });
      } else if (sortKey === "status") {
        c = STATUS_SORT_RANK[a.bucket] - STATUS_SORT_RANK[b.bucket];
      } else if (sortKey === "boost") {
        c = Number(a.boosted) - Number(b.boosted);
      } else {
        c = a.efficiency - b.efficiency;
      }
      if (c !== 0) return c * dir;
      return a.primary.localeCompare(b.primary, lang, { sensitivity: "base" });
    });
    return list;
  }, [filtered, sortKey, sortDir, lang]);

  const shown = sorted.slice(0, MAX_ROWS);

  const openRow = useCallback((r: Record<string, unknown>) => setSelected(r), []);

  return (
    <div className="w-full min-w-0 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="sf-display text-lg font-semibold uppercase tracking-[0.12em] text-sf-orange sm:text-xl">
            {t("monitoring.productionTitle")}
          </h1>
          <p className="mt-1 text-xs text-sf-muted">{t("monitoring.productionHint", { max: MAX_ROWS })}</p>
          <p className="mt-1 text-xs text-sf-muted">{t("monitoring.productionHintClick")}</p>
        </div>
        <ItemThumb className="Build_ManufacturerMk1_C" label="" size={48} />
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-2">
        <div className="rounded border border-sf-border/60 bg-black/25 px-3 py-2">
          <p className="text-[0.65rem] uppercase tracking-wider text-sf-muted">{t("monitoring.productionStatBuildings")}</p>
          <p className="sf-display mt-1 text-2xl font-semibold text-sf-cream">{formatIntegerSpaces(rows.length)}</p>
        </div>
        <div className="rounded border border-sf-border/60 bg-black/25 px-3 py-2">
          <p className="text-[0.65rem] uppercase tracking-wider text-sf-muted">{t("monitoring.productionStatFiltered")}</p>
          <p className="sf-display mt-1 text-2xl font-semibold text-sf-cyan">{formatIntegerSpaces(filtered.length)}</p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs text-sf-muted">
            {t("monitoring.productionFilter")}
            <input
              type="search"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="sf-input ml-2 min-h-9 min-w-[12rem] text-sm"
            />
          </label>
          <span className="text-xs text-sf-muted">
            {t("monitoring.productionCount", { n: filtered.length, total: rows.length })}
          </span>
        </div>
        <div className="flex flex-wrap items-end gap-2 sm:gap-3">
          <label className="flex flex-col gap-0.5 text-[0.65rem] text-sf-muted">
            {t("monitoring.productionFilterStatus")}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as ProductionStatusFilter)}
              className="sf-input min-h-9 min-w-[10.5rem] text-xs"
            >
              <option value="all">{t("monitoring.productionFilterStatusAll")}</option>
              <option value="producing">{t("monitoring.productionFilterStatusProducing")}</option>
              <option value="paused">{t("monitoring.productionFilterStatusPaused")}</option>
              <option value="standby">{t("monitoring.productionFilterStatusStandby")}</option>
              <option value="not_configured">{t("monitoring.productionFilterStatusNotConfigured")}</option>
            </select>
          </label>
          <label className="flex flex-col gap-0.5 text-[0.65rem] text-sf-muted">
            {t("monitoring.productionFilterBoost")}
            <select
              value={boostFilter}
              onChange={(e) => setBoostFilter(e.target.value as ProductionBoostFilter)}
              className="sf-input min-h-9 min-w-[9rem] text-xs"
            >
              <option value="all">{t("monitoring.productionFilterBoostAll")}</option>
              <option value="yes">{t("monitoring.productionFilterBoostYes")}</option>
              <option value="no">{t("monitoring.productionFilterBoostNo")}</option>
            </select>
          </label>
          <label className="flex flex-col gap-0.5 text-[0.65rem] text-sf-muted">
            {t("monitoring.productionFilterEfficiency")}
            <select
              value={effFilter}
              onChange={(e) => setEffFilter(e.target.value as ProductionEffFilter)}
              className="sf-input min-h-9 min-w-[11rem] text-xs"
            >
              <option value="all">{t("monitoring.productionFilterEfficiencyAll")}</option>
              <option value="high">{t("monitoring.productionFilterEfficiencyHigh")}</option>
              <option value="mid">{t("monitoring.productionFilterEfficiencyMid")}</option>
              <option value="low">{t("monitoring.productionFilterEfficiencyLow")}</option>
            </select>
          </label>
          <label className="flex flex-col gap-0.5 text-[0.65rem] text-sf-muted">
            {t("monitoring.productionSortBy")}
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as ProductionSortKey)}
              className="sf-input min-h-9 min-w-[9rem] text-xs"
            >
              <option value="name">{t("monitoring.productionSortName")}</option>
              <option value="status">{t("monitoring.productionSortStatus")}</option>
              <option value="boost">{t("monitoring.productionSortBoost")}</option>
              <option value="efficiency">{t("monitoring.productionSortEfficiency")}</option>
            </select>
          </label>
          <label className="flex flex-col gap-0.5 text-[0.65rem] text-sf-muted">
            {t("monitoring.productionSortDirection")}
            <select
              value={sortDir}
              onChange={(e) => setSortDir(e.target.value as ProductionSortDir)}
              className="sf-input min-h-9 min-w-[9rem] text-xs"
            >
              <option value="asc">{t("monitoring.productionSortDirAsc")}</option>
              <option value="desc">{t("monitoring.productionSortDirDesc")}</option>
            </select>
          </label>
        </div>
      </div>

      <div className="sf-panel min-w-0 overflow-hidden p-3 sm:p-4">
        {q.isError ?
          <p className="text-sm text-sf-orange">{(q.error as Error).message}</p>
        : q.isPending ?
          <FicsitPageLoader className="min-h-[min(52dvh,480px)] border-0 bg-transparent" />
        : !rows.length ?
          <p className="text-sm text-sf-muted">{t("monitoring.empty")}</p>
        : (
          <div className="grid max-h-[min(75vh,720px)] gap-3 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((vm, i) => {
              const r = vm.row;
              const thumbCls = factoryBuildingClassForThumb(r);
              const g = factoryCircuitGroupId(r);
              const c = factoryCircuitId(r);
              const connected = factoryHasPowerConnection(r);
              const pCur = factoryPowerConsumedMw(r);
              const pMax = factoryPowerMaxMw(r);
              const outPm = factoryTotalCurrentProdPerMin(r);
              const inPm = factoryTotalCurrentConsumePerMin(r);
              const prodLinesCard = factoryProductionLines(r);

              return (
                <button
                  key={String(r.ID ?? r.id ?? i)}
                  type="button"
                  onClick={() => openRow(r)}
                  className="flex w-full min-w-0 flex-col gap-2 rounded-lg border border-sf-border/70 bg-black/25 p-3 text-left shadow-sm ring-1 ring-white/[0.04] transition-colors hover:border-sf-orange/40 hover:bg-black/35"
                >
                  <div className="flex items-start gap-3">
                    <ItemThumb className={thumbCls} label={vm.primary} size={44} />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold leading-snug text-sf-cream">{vm.primary}</p>
                      {vm.secondary ?
                        <p className="mt-0.5 truncate text-xs text-sf-muted">{vm.secondary}</p>
                      : null}
                      <p className="mt-0.5 font-mono text-[0.65rem] text-sf-muted">
                        {t("monitoring.productionFilterEfficiency")}: {formatDecimalSpaces(vm.efficiency, 1)}%
                      </p>
                      <div className="mt-2">
                        <p className="text-[0.65rem] font-medium uppercase tracking-wider text-sf-muted">
                          {t("monitoring.productionRecipeItems")}
                        </p>
                        <RecipeOutputsList
                          lines={prodLinesCard.slice(0, 4)}
                          lang={i18n.language}
                          thumbSize={28}
                          dense
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5 text-[0.65rem] text-sf-muted">
                    {vm.boosted ?
                      <span className="rounded bg-sf-orange/15 px-1.5 py-0.5 font-medium text-sf-orange">
                        {t("monitoring.productionBoost")}
                      </span>
                    : null}
                    <span className="rounded border border-sf-border/50 px-1.5 py-0.5">
                      {connected && g != null && c != null ?
                        t("monitoring.productionConnectShort", { g, c })
                      : t("monitoring.productionNotConnected")}
                    </span>
                    <span className="rounded border border-sf-border/50 px-1.5 py-0.5">
                      {formatDecimalSpaces(pCur, 2)} / {formatDecimalSpaces(pMax, 2)} MW
                    </span>
                    <span className="rounded border border-sf-border/50 px-1.5 py-0.5">
                      Σ {formatDecimalSpaces(outPm, 2)} /min
                    </span>
                    <span className="rounded border border-sf-border/50 px-1.5 py-0.5">
                      ↓ {formatDecimalSpaces(inPm, 2)} /min
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {selected ? <ProductionModal row={selected} onClose={() => setSelected(null)} /> : null}
    </div>
  );
}

export function ProductionPage() {
  return (
    <MonitoringGate>
      <ProductionPageBody />
    </MonitoringGate>
  );
}
