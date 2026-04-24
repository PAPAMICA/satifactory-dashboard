import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
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

      <section className="sf-panel min-w-0  p-3 sm:p-4">
        <h2 className="mb-2 text-xs font-medium uppercase tracking-wider text-sf-muted">
          {t("monitoring.powerUsage")} ({usage.length})
        </h2>
        {usageQ.isError ? (
          <p className="text-sm text-sf-orange">{(usageQ.error as Error).message}</p>
        ) : usageQ.isPending ? (
          <FicsitPageLoader density="compact" className="min-h-56 border-0 bg-transparent" />
        ) : !usage.length ? (
          <p className="text-sm text-sf-muted">{t("monitoring.empty")}</p>
        ) : (
          <div className="min-h-0 overflow-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead className="sticky top-0 bg-[#14120f] text-sf-muted">
                <tr>
                  <th className="border-b border-sf-border p-2 font-normal w-10" aria-hidden />
                  <th className="border-b border-sf-border p-2 font-normal">{t("monitoring.colBuildingType")}</th>
                  <th className="border-b border-sf-border p-2 font-normal">MW</th>
                  <th className="border-b border-sf-border p-2 font-normal min-w-[120px]">
                    {t("monitoring.powerLoadShare")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {usage.slice(0, 200).map((r, i) => {
                  const pi = r.PowerInfo as Record<string, unknown> | undefined;
                  const mw = pi?.PowerConsumed ?? pi?.powerConsumed ?? r.PowerConsumed;
                  const rawClass = String(r.ClassName ?? r.className ?? "").trim();
                  const thumbClass = rowThumbClass(r, "Build_OilRefinery_C");
                  const normClass = rawClass ? normalizeBuildClassName(rawClass) : normalizeBuildClassName(thumbClass);
                  const imgClass = normClass !== "—" ? normClass : thumbClass;
                  const typeLabel = frmgClassLabel(imgClass, i18n.language);
                  const mwN = Number(mw) || 0;
                  const share =
                    totals.cons > 0 && mwN > 0 ? Math.min(1, mwN / totals.cons) : 0;
                  return (
                    <tr
                      key={String(r.ID ?? r.id ?? i)}
                      className="cursor-pointer border-b border-sf-border/40 transition-colors hover:bg-white/[0.04]"
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          openBuildingDetail(r, { showMap: true, showAdminControls: Boolean(me?.isAdmin) });
                        }
                      }}
                      onClick={() => openBuildingDetail(r, { showMap: true, showAdminControls: Boolean(me?.isAdmin) })}
                    >
                      <td className="p-2 align-middle">
                        <ItemThumb className={imgClass} label={typeLabel} size={28} />
                      </td>
                      <td className="p-2 align-middle text-sf-cream">{typeLabel}</td>
                      <td className="p-2 align-middle font-mono text-sf-orange">{num(mw)}</td>
                      <td className="p-2 align-middle">
                        <div className="max-w-[200px]">
                          <LinearFractionBar fraction={share} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
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
