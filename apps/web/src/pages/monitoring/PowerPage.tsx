import { useQuery } from "@tanstack/react-query";
import { useMemo, useState, useSyncExternalStore } from "react";
import { FrmSwitchesPanel } from "@/components/FrmSwitchesPanel";
import { useTranslation } from "react-i18next";
import { FicsitPageLoader } from "@/components/FicsitPageLoader";
import { FrmPowerByBuildingType, totalGeneratorMw } from "@/components/FrmPowerByBuildingType";
import { FrmPowerSummaryGrid } from "@/components/FrmPowerSummaryGrid";
import { FrmPowerTrendPanel } from "@/components/FrmPowerTrendPanel";
import { PowerFavoriteGroupsPanel } from "@/components/PowerFavoriteGroupsPanel";
import { ItemThumb } from "@/components/ItemThumb";
import { LinearFractionBar } from "@/components/LinearFractionBar";
import { MonitoringGate } from "@/components/MonitoringGate";
import { useOpenBuildingDetail } from "@/contexts/BuildingDetailModalContext";
import { useFrmRefetchMs } from "@/hooks/useFrmRefetchMs";
import { apiFetch } from "@/lib/api";
import { asFrmRowArray } from "@/lib/frmRows";
import { frmGetUrl } from "@/lib/frmApi";
import { frmgClassLabel } from "@/lib/dashboardFrmgDisplay";
import type { WidgetVariant } from "@/lib/dashboardWidgetCatalog";
import { formatDecimalSpaces, formatIntegerSpaces } from "@/lib/formatNumber";
import {
  aggregatePowerMwByBuildType,
  generatorMwLive,
  powerMWFromUsageRow,
  normalizeBuildClassName,
  rowThumbClass,
  sumCircuitField,
} from "@/lib/monitoringFrm";
import type { ChartTimeWindow } from "@/lib/powerHistoryChart";
import { readEnergyControlPrefs, subscribeEnergyPrefs } from "@/lib/energyControlPrefs";
import { frmBuildingRowSearchBlob } from "@/lib/productionFrm";

function num(v: unknown): string {
  const n = Number(v);
  return Number.isFinite(n) ? String(Math.round(n * 10) / 10) : "—";
}

function fmtMw(n: number): string {
  const v = Math.round(n * 10) / 10;
  return `${formatDecimalSpaces(v, 1)} MW`;
}

const powerPageWidgetVariant: WidgetVariant = "visual";

function PowerPageBody() {
  const { t, i18n } = useTranslation();
  const refetchMs = useFrmRefetchMs();
  const [chartWindow, setChartWindow] = useState<ChartTimeWindow>("30m");
  const [usageBuildingSearch, setUsageBuildingSearch] = useState("");
  const energyPrefs = useSyncExternalStore(subscribeEnergyPrefs, readEnergyControlPrefs, readEnergyControlPrefs);
  const openBuildingDetail = useOpenBuildingDetail();
  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: () => apiFetch<{ isAdmin?: boolean; isPublicViewer?: boolean }>("/api/me"),
    staleTime: 60_000,
  });

  const powerQ = useQuery({
    queryKey: ["frm", "getPower"],
    queryFn: () => apiFetch<unknown>(frmGetUrl("getPower")),
    refetchInterval: refetchMs,
  });
  const usageQ = useQuery({
    queryKey: ["frm", "getPowerUsage"],
    queryFn: () => apiFetch<unknown>(frmGetUrl("getPowerUsage")),
    refetchInterval: refetchMs,
  });
  const genQ = useQuery({
    queryKey: ["frm", "getGenerators"],
    queryFn: () => apiFetch<unknown>(frmGetUrl("getGenerators")),
    refetchInterval: refetchMs,
  });

  const circuits = asFrmRowArray(powerQ.data);
  const usage = asFrmRowArray(usageQ.data);
  const generators = asFrmRowArray(genQ.data);

  const totals = useMemo(
    () => ({ cons: sumCircuitField(circuits, "PowerConsumed") }),
    [circuits],
  );

  const genByType = useMemo(
    () => aggregatePowerMwByBuildType(generators, generatorMwLive),
    [generators],
  );
  const usageByType = useMemo(() => aggregatePowerMwByBuildType(usage, powerMWFromUsageRow), [usage]);
  const genTotalMw = useMemo(() => totalGeneratorMw(generators, generatorMwLive), [generators]);
  const genSummaries = useMemo(
    () => [
      { label: t("dashboard.widgets.generatorsTotal"), value: formatIntegerSpaces(generators.length) },
      { label: t("dashboard.widgets.generatorsLiveMw"), value: fmtMw(genTotalMw) },
    ],
    [t, generators.length, genTotalMw],
  );

  const usageBuildingQ = usageBuildingSearch.trim().toLowerCase();
  const usageDisplayed = useMemo(() => {
    const cap = usage.slice(0, 200);
    if (!usageBuildingQ) return cap;
    return cap.filter((r) => {
      const id = String(r.ID ?? r.id ?? "").trim();
      const alias = (energyPrefs.buildingAliases[id] ?? "").toLowerCase();
      return frmBuildingRowSearchBlob(r, i18n.language).includes(usageBuildingQ) || alias.includes(usageBuildingQ);
    });
  }, [usage, usageBuildingQ, i18n.language, energyPrefs.buildingAliases]);

  return (
    <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col">
      <div className="flex shrink-0 flex-wrap items-end justify-between gap-3">
        <h1 className="sf-display text-lg font-semibold uppercase tracking-[0.12em] text-sf-orange sm:text-xl">
          {t("monitoring.powerTitle")}
        </h1>
        <div className="flex items-center gap-2">
          <ItemThumb className="Build_GeneratorBiomass_C" label="" size={44} />
          <ItemThumb className="Build_PowerStorageMk1_C" label="" size={44} />
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 pr-0.5">
      {powerQ.isError ? (
        <p className="text-sm text-sf-orange">{(powerQ.error as Error).message}</p>
      ) : powerQ.isPending ? (
        <FicsitPageLoader className="min-h-40 border-0 bg-transparent" />
      ) : (
        <>
          {!circuits.length ? (
            <p className="text-sm text-sf-muted">{t("monitoring.empty")}</p>
          ) : (
            <section className="sf-panel flex min-w-0 flex-col ">
              <div className="sf-panel-header flex min-w-0 flex-wrap items-center gap-2 sm:gap-2">
                <ItemThumb className="Build_GeneratorFuel_C" label="" size={28} />
                <span className="min-w-0 truncate">{t("dashboard.powerTitle")}</span>
              </div>
              <div className="flex min-h-[12rem] min-w-0 w-full flex-col  sm:min-h-[14rem]">
                <FrmPowerSummaryGrid circuits={circuits} variant="visual" />
              </div>
            </section>
          )}

          {!me?.isPublicViewer ? <PowerFavoriteGroupsPanel /> : null}

          {me?.isAdmin ?
            <section className="sf-panel min-w-0 ">
              <div className="sf-panel-header flex min-w-0 flex-wrap items-center gap-2 border-b border-sf-border/40 bg-gradient-to-r from-sf-cyan/10 to-transparent">
                <ItemThumb className="Build_PriorityPowerSwitch_C" label="" size={28} />
                <span className="min-w-0 truncate font-medium uppercase tracking-wider text-sf-cream">
                  {t("control.sectionSwitches")}
                </span>
              </div>
              <div className="max-h-[min(50vh,520px)] overflow-y-auto p-3 sm:p-4">
                <FrmSwitchesPanel />
              </div>
            </section>
          : null}

          <section className="sf-panel flex min-w-0 flex-col ">
            <div className="sf-panel-header flex min-w-0 flex-wrap items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <ItemThumb className="Build_PowerStorageMk1_C" label="" size={28} />
                <span className="min-w-0 truncate">{t("dashboard.chartTitle")}</span>
              </div>
            </div>
            <div className="flex min-h-[min(32dvh,280px)] min-w-0 w-full flex-col  md:min-h-[min(38dvh,400px)]">
              <FrmPowerTrendPanel
                variant="visual"
                chartWindow={chartWindow}
                onChartWindowChange={setChartWindow}
                showWindowPicker
              />
            </div>
          </section>

          {circuits.length ?
            <section className="sf-panel min-w-0  p-3 sm:p-4">
              <h2 className="mb-2 text-xs font-medium uppercase tracking-wider text-sf-muted">
                {t("monitoring.powerCircuits")}
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] border-collapse text-left text-xs">
                  <thead className="text-sf-muted">
                    <tr>
                      <th className="border-b border-sf-border p-2 font-normal w-10" aria-hidden />
                      <th className="border-b border-sf-border p-2 font-normal">ID</th>
                      <th className="border-b border-sf-border p-2 font-normal">{t("monitoring.colProduction")}</th>
                      <th className="border-b border-sf-border p-2 font-normal">{t("monitoring.colConsumption")}</th>
                      <th className="border-b border-sf-border p-2 font-normal">{t("monitoring.colCapacity")}</th>
                      <th className="border-b border-sf-border p-2 font-normal">%</th>
                      <th className="border-b border-sf-border p-2 font-normal">Fuse</th>
                    </tr>
                  </thead>
                  <tbody>
                    {circuits.map((r, i) => {
                      const id = r.CircuitGroupID ?? i;
                      const fuse = Boolean(r.FuseTriggered);
                      const cons = Number(r.PowerConsumed) || 0;
                      const cap = Number(r.PowerCapacity) || 0;
                      const loadFrac = cap > 0 ? Math.min(1, cons / cap) : 0;
                      return (
                        <tr key={String(id)} className="border-b border-sf-border/50">
                          <td className="p-2">
                            <ItemThumb className="Build_PowerLine_C" label="" size={28} />
                          </td>
                          <td className="p-2 font-mono text-sf-cream">{String(id)}</td>
                          <td className="p-2 font-mono text-sf-ok">{num(r.PowerProduction)}</td>
                          <td className="p-2 font-mono text-sf-orange">{num(r.PowerConsumed)}</td>
                          <td className="p-2 font-mono text-sf-cyan">{num(r.PowerCapacity)}</td>
                          <td className="max-w-[140px] p-2">
                            <div className="font-mono text-sf-muted">{num(r.BatteryPercent)}</div>
                            <div className="mt-1">
                              <LinearFractionBar fraction={loadFrac} />
                            </div>
                          </td>
                          <td className="p-2">{fuse ? <span className="text-sf-danger">●</span> : "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          : null}

          <section className="sf-panel flex min-w-0 flex-col ">
            <div className="sf-panel-header flex min-w-0 flex-wrap items-center gap-2">
              <ItemThumb className="Build_GeneratorNuclear_C" label="" size={28} />
              <span className="min-w-0 truncate">{t("dashboard.widgets.generatorsCatalog")}</span>
            </div>
            <div className="flex min-h-[14rem] min-w-0 w-full flex-col  sm:min-h-[16rem]">
              {genQ.isError ? (
                <p className="p-3 text-sm text-sf-orange">{(genQ.error as Error).message}</p>
              ) : genQ.isPending ? (
                <FicsitPageLoader density="compact" className="min-h-52 border-0 bg-transparent" />
              ) : (
                <FrmPowerByBuildingType
                  variant={powerPageWidgetVariant}
                  entries={genByType}
                  kind="production"
                  summaries={genSummaries}
                  maxVisualItems={12}
                  maxListItems={24}
                />
              )}
            </div>
          </section>

          <section className="sf-panel flex min-w-0 flex-col ">
            <div className="sf-panel-header flex min-w-0 flex-wrap items-center gap-2">
              <ItemThumb className="Build_PowerTower_C" label="" size={28} />
              <span className="min-w-0 truncate">{t("dashboard.widgets.powerUsageCatalog")}</span>
            </div>
            <div className="flex min-h-[14rem] min-w-0 w-full flex-col  sm:min-h-[16rem]">
              {usageQ.isError ? (
                <p className="p-3 text-sm text-sf-orange">{(usageQ.error as Error).message}</p>
              ) : usageQ.isPending ? (
                <FicsitPageLoader density="compact" className="min-h-52 border-0 bg-transparent" />
              ) : (
                <FrmPowerByBuildingType
                  variant={powerPageWidgetVariant}
                  entries={usageByType}
                  kind="consumption"
                  usageHistoryRows={usage}
                  usageHistoryUpdatedAt={usageQ.dataUpdatedAt}
                />
              )}
            </div>
          </section>
        </>
      )}

      <section className="sf-panel flex min-h-0 min-w-0 flex-col overflow-hidden p-3 sm:p-4">
        <div className="mb-3 flex shrink-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
          <h2 className="text-xs font-medium uppercase tracking-wider text-sf-muted">
            <span>
              {t("monitoring.powerUsage")} ({usage.length})
            </span>
            {usageBuildingQ ?
              <span className="ml-1 font-normal normal-case text-sf-orange/90">· {usageDisplayed.length}</span>
            : null}
          </h2>
          {!usageQ.isError && !usageQ.isPending && usage.length ?
            <input
              type="search"
              value={usageBuildingSearch}
              onChange={(e) => setUsageBuildingSearch(e.target.value)}
              placeholder={t("monitoring.powerUsageByBuildingSearch")}
              className="sf-input min-h-9 w-full min-w-0 max-w-md text-sm sm:w-72"
              autoComplete="off"
            />
          : null}
        </div>
        {usageQ.isError ? (
          <p className="text-sm text-sf-orange">{(usageQ.error as Error).message}</p>
        ) : usageQ.isPending ? (
          <FicsitPageLoader density="compact" className="min-h-56 border-0 bg-transparent" />
        ) : !usage.length ? (
          <p className="text-sm text-sf-muted">{t("monitoring.empty")}</p>
        ) : (
          <div className="min-h-0 flex-1 overflow-auto pr-0.5">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[repeat(auto-fill,minmax(14rem,1fr))] sm:gap-2.5">
              {usageDisplayed.map((r, i) => {
                const pi = r.PowerInfo as Record<string, unknown> | undefined;
                const mw = pi?.PowerConsumed ?? pi?.powerConsumed ?? r.PowerConsumed;
                const rawClass = String(r.ClassName ?? r.className ?? "").trim();
                const thumbClass = rowThumbClass(r, "Build_OilRefinery_C");
                const normClass = rawClass ? normalizeBuildClassName(rawClass) : normalizeBuildClassName(thumbClass);
                const imgClass = normClass !== "—" ? normClass : thumbClass;
                const typeLabel = frmgClassLabel(imgClass, i18n.language);
                const mwN = Number(mw) || 0;
                const share = totals.cons > 0 && mwN > 0 ? Math.min(1, mwN / totals.cons) : 0;
                const bid = String(r.ID ?? r.id ?? "").trim();
                const alias = bid ? (energyPrefs.buildingAliases[bid] ?? "").trim() : "";
                return (
                  <button
                    key={String(r.ID ?? r.id ?? i)}
                    type="button"
                    className="flex w-full min-w-0 flex-col gap-2 rounded-lg border border-sf-border/70 bg-black/20 p-2.5 text-left shadow-sm ring-1 ring-white/[0.03] transition-colors hover:border-sf-orange/35 hover:bg-black/30 sm:p-3"
                    onClick={() => openBuildingDetail(r, { showMap: true, showAdminControls: Boolean(me?.isAdmin) })}
                  >
                    <div className="flex items-start gap-2">
                      <ItemThumb className={imgClass} label={typeLabel} size={36} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-sf-cream">{typeLabel}</p>
                        {alias ?
                          <p className="mt-0.5 truncate text-[0.65rem] text-sf-muted" title={alias}>
                            {alias}
                          </p>
                        : null}
                        <p className="mt-1 font-mono text-xs text-sf-orange">{num(mw)} MW</p>
                      </div>
                    </div>
                    <div className="min-w-0">
                      <p className="mb-1 text-[0.6rem] uppercase tracking-wider text-sf-muted">
                        {t("monitoring.powerLoadShare")}
                      </p>
                      <LinearFractionBar fraction={share} />
                    </div>
                  </button>
                );
              })}
            </div>
            {!usageDisplayed.length && usageBuildingQ ?
              <p className="mt-3 text-sm text-sf-muted">{t("monitoring.empty")}</p>
            : null}
          </div>
        )}
      </section>
      </div>
    </div>
  );
}

export function PowerPage() {
  return (
    <MonitoringGate>
      <PowerPageBody />
    </MonitoringGate>
  );
}
