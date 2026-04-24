import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { FicsitPageLoader } from "@/components/FicsitPageLoader";
import { ItemThumb } from "@/components/ItemThumb";
import {
  EfficiencyCapsule,
  factoryBuildingPrimarySecondary,
  RecipeOutputsList,
} from "@/components/ProductionBuildingModal";
import { useOpenBuildingDetail } from "@/contexts/BuildingDetailModalContext";
import { MonitoringGate } from "@/components/MonitoringGate";
import { useFrmRefetchMs } from "@/hooks/useFrmRefetchMs";
import { apiFetch } from "@/lib/api";
import { asFrmRowArray } from "@/lib/frmRows";
import { frmGetUrl } from "@/lib/frmApi";
import { frmgClassLabel } from "@/lib/dashboardFrmgDisplay";
import { formatDecimalSpaces, formatIntegerSpaces } from "@/lib/formatNumber";
import {
  factoryBuildingClassForThumb,
  factoryCircuitGroupId,
  factoryCircuitId,
  factoryHasPowerConnection,
  factoryIsBoosted,
  factoryPowerConsumedMw,
  factoryPowerMaxMw,
  factoryProductivityPct,
  factoryProductionLines,
  factoryStatusBucket,
  factoryTotalCurrentConsumePerMin,
  factoryTotalCurrentProdPerMin,
  type FactoryStatusBucket,
} from "@/lib/productionFrm";
import { itemLabel } from "@/lib/itemCatalog";

const MAX_ROWS = 300;

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

type ProductionStatusFilter = "all" | FactoryStatusBucket;
type ProductionBoostFilter = "all" | "yes" | "no";
type ProductionEffFilter = "all" | "high" | "mid" | "low";
type ProductionSortKey = "name" | "status" | "boost" | "efficiency";
type ProductionSortDir = "asc" | "desc";

function ProductionPageBody() {
  const { t, i18n } = useTranslation();
  const refetchMs = useFrmRefetchMs();
  const openBuildingDetail = useOpenBuildingDetail();
  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: () => apiFetch<{ isAdmin?: boolean }>("/api/me"),
    staleTime: 60_000,
  });
  const [filter, setFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<ProductionStatusFilter>("all");
  const [boostFilter, setBoostFilter] = useState<ProductionBoostFilter>("all");
  const [effFilter, setEffFilter] = useState<ProductionEffFilter>("all");
  const [sortKey, setSortKey] = useState<ProductionSortKey>("name");
  const [sortDir, setSortDir] = useState<ProductionSortDir>("asc");

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
      const { primary } = factoryBuildingPrimarySecondary(r, lang);
      return {
        row: r,
        primary,
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

  const openRow = useCallback(
    (r: Record<string, unknown>) => openBuildingDetail(r, { showMap: true, showAdminControls: Boolean(me?.isAdmin) }),
    [me?.isAdmin, openBuildingDetail],
  );

  return (
    <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col gap-4">
      <div className="flex shrink-0 flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="sf-display text-lg font-semibold uppercase tracking-[0.12em] text-sf-orange sm:text-xl">
            {t("monitoring.productionTitle")}
          </h1>
          <p className="mt-1 text-xs text-sf-muted">{t("monitoring.productionHint", { max: MAX_ROWS })}</p>
          <p className="mt-1 text-xs text-sf-muted">{t("monitoring.productionHintClick")}</p>
        </div>
        <ItemThumb className="Build_ManufacturerMk1_C" label="" size={48} />
      </div>

      <div className="grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-2">
        <div className="rounded border border-sf-border/60 bg-black/25 px-3 py-2">
          <p className="text-[0.65rem] uppercase tracking-wider text-sf-muted">{t("monitoring.productionStatBuildings")}</p>
          <p className="sf-display mt-1 text-2xl font-semibold text-sf-cream">{formatIntegerSpaces(rows.length)}</p>
        </div>
        <div className="rounded border border-sf-border/60 bg-black/25 px-3 py-2">
          <p className="text-[0.65rem] uppercase tracking-wider text-sf-muted">{t("monitoring.productionStatFiltered")}</p>
          <p className="sf-display mt-1 text-2xl font-semibold text-sf-cyan">{formatIntegerSpaces(filtered.length)}</p>
        </div>
      </div>

      <div className="flex shrink-0 flex-col gap-2">
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

      <div className="sf-panel flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-3 sm:p-4">
        {q.isError ?
          <p className="text-sm text-sf-orange">{(q.error as Error).message}</p>
        : q.isPending ?
          <FicsitPageLoader className="min-h-0 flex-1 border-0 bg-transparent" />
        : !rows.length ?
          <p className="text-sm text-sf-muted">{t("monitoring.empty")}</p>
        : (
          <div className="mx-auto grid min-h-0 w-full max-w-6xl flex-1 grid-cols-2 gap-2 overflow-y-auto overscroll-contain sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
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
              const pillMuted = "rounded border border-sf-border/50 bg-black/20 px-1.5 py-0.5 text-[0.62rem] text-sf-muted";
              const netOk = connected && g != null && c != null;

              return (
                <button
                  key={String(r.ID ?? r.id ?? i)}
                  type="button"
                  onClick={() => openRow(r)}
                  className="relative flex w-full max-w-[13.5rem] flex-col gap-2 rounded-lg border border-sf-border/70 bg-black/25 p-2.5 text-left shadow-sm ring-1 ring-white/[0.04] transition-colors hover:border-sf-orange/40 hover:bg-black/35 sm:max-w-none sm:p-3"
                >
                  <div className="absolute right-2 top-2 z-[1]">
                    <EfficiencyCapsule pct={vm.efficiency} />
                  </div>
                  <div className="flex items-start gap-2 pr-12 sm:gap-3 sm:pr-14">
                    <ItemThumb className={thumbCls} label={vm.primary} size={40} />
                    <div className="min-w-0 flex-1">
                      <p className="pr-1 font-semibold leading-snug text-sf-cream">{vm.primary}</p>
                      <div className="mt-1.5">
                        <RecipeOutputsList
                          lines={prodLinesCard.slice(0, 4)}
                          lang={i18n.language}
                          thumbSize={26}
                          dense
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5 text-[0.62rem]">
                    {vm.boosted ?
                      <span className="rounded bg-sf-orange/15 px-1.5 py-0.5 font-medium text-sf-orange">
                        {t("monitoring.productionBoost")}
                      </span>
                    : null}
                    <span
                      className={
                        netOk ?
                          "rounded border border-sf-cyan/35 bg-sf-cyan/10 px-1.5 py-0.5 text-[0.62rem] text-sf-cyan"
                        : pillMuted
                      }
                    >
                      {netOk ? t("monitoring.productionConnectShort", { g, c }) : t("monitoring.productionNotConnected")}
                    </span>
                    <span
                      className={
                        pCur > 0.01 ?
                          "rounded border border-sf-orange/40 bg-sf-orange/10 px-1.5 py-0.5 font-mono text-[0.62rem] text-sf-orange"
                        : `${pillMuted} font-mono`
                      }
                    >
                      {formatDecimalSpaces(pCur, 2)} / {formatDecimalSpaces(pMax, 2)} MW
                    </span>
                    <span
                      className={
                        outPm > 0 ?
                          "rounded border border-emerald-600/35 bg-emerald-950/45 px-1.5 py-0.5 font-mono text-[0.62rem] text-emerald-200"
                        : `${pillMuted} font-mono`
                      }
                    >
                      Σ {formatDecimalSpaces(outPm, 2)} /min
                    </span>
                    <span
                      className={
                        inPm > 0 ?
                          "rounded border border-amber-600/35 bg-amber-950/45 px-1.5 py-0.5 font-mono text-[0.62rem] text-amber-100"
                        : `${pillMuted} font-mono`
                      }
                    >
                      ↓ {formatDecimalSpaces(inPm, 2)} /min
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

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
