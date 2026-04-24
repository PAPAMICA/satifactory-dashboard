import { useQuery } from "@tanstack/react-query";
import { useMemo, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import { ItemThumb } from "@/components/ItemThumb";
import { LinearFractionBar } from "@/components/LinearFractionBar";
import { useFrmRefetchMs } from "@/hooks/useFrmRefetchMs";
import { apiFetch } from "@/lib/api";
import { readEnergyControlPrefs, subscribeEnergyPrefs } from "@/lib/energyControlPrefs";
import { asFrmRowArray } from "@/lib/frmRows";
import { frmGetUrl } from "@/lib/frmApi";
import { formatDecimalSpaces } from "@/lib/formatNumber";
import { sumCircuitField } from "@/lib/monitoringFrm";
import { sumFactoryRowsPowerMw } from "@/lib/productionFrm";

function rowForBuildingId(
  id: string,
  factories: Record<string, unknown>[],
  generators: Record<string, unknown>[],
): Record<string, unknown> | undefined {
  const fac = factories.find((r) => String(r.ID ?? r.Id ?? "") === id);
  if (fac) return fac;
  return generators.find((r) => String(r.ID ?? r.Id ?? r.id ?? "") === id);
}

export function PowerFavoriteGroupsPanel() {
  const { t } = useTranslation();
  const prefs = useSyncExternalStore(subscribeEnergyPrefs, readEnergyControlPrefs, readEnergyControlPrefs);
  const refetchMs = useFrmRefetchMs();

  const powerQ = useQuery({
    queryKey: ["frm", "getPower"],
    queryFn: () => apiFetch<unknown>(frmGetUrl("getPower")),
    refetchInterval: refetchMs,
  });
  const facQ = useQuery({
    queryKey: ["frm", "getFactory"],
    queryFn: () => apiFetch<unknown>(frmGetUrl("getFactory")),
    refetchInterval: refetchMs,
  });
  const genQ = useQuery({
    queryKey: ["frm", "getGenerators"],
    queryFn: () => apiFetch<unknown>(frmGetUrl("getGenerators")),
    refetchInterval: refetchMs,
  });

  const circuits = useMemo(() => asFrmRowArray(powerQ.data), [powerQ.data]);
  const gridTotalMw = useMemo(() => sumCircuitField(circuits, "PowerConsumed"), [circuits]);
  const factories = asFrmRowArray(facQ.data);
  const generators = asFrmRowArray(genQ.data);

  const groups = useMemo(() => {
    const fav = new Set(prefs.favoriteBuildingGroupIds);
    return prefs.favoriteBuildingGroups
      .filter((g) => fav.has(g.id))
      .map((g) => {
        const memberRows: Record<string, unknown>[] = [];
        for (const mid of g.memberBuildingIds) {
          const row = rowForBuildingId(mid, factories, generators);
          if (row) memberRows.push(row);
        }
        const mw = sumFactoryRowsPowerMw(memberRows);
        const share = gridTotalMw > 1e-9 ? Math.min(1, mw / gridTotalMw) : 0;
        return { group: g, mw, share, configured: g.memberBuildingIds.length, resolved: memberRows.length };
      });
  }, [
    prefs.favoriteBuildingGroupIds,
    prefs.favoriteBuildingGroups,
    factories,
    generators,
    gridTotalMw,
  ]);

  if (!prefs.favoriteBuildingGroupIds.length) {
    return (
      <section className="sf-panel min-w-0  p-3 sm:p-4">
        <div className="mb-2 flex items-center gap-2">
          <ItemThumb className="Build_ManufacturerMk1_C" label="" size={28} />
          <h2 className="text-xs font-medium uppercase tracking-wider text-sf-muted">
            {t("monitoring.powerFavoriteGroupsTitle")}
          </h2>
        </div>
        <p className="text-sm text-sf-muted">{t("monitoring.powerFavoriteGroupsEmpty")}</p>
      </section>
    );
  }

  return (
    <section className="sf-panel min-w-0  p-3 sm:p-4">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <ItemThumb className="Build_ManufacturerMk1_C" label="" size={28} />
        <h2 className="text-xs font-medium uppercase tracking-wider text-sf-muted">
          {t("monitoring.powerFavoriteGroupsTitle")}
        </h2>
      </div>
      <p className="mb-3 text-[0.65rem] text-sf-muted/90">{t("monitoring.powerFavoriteGroupsHint")}</p>
      {facQ.isPending || genQ.isPending ?
        <p className="text-xs text-sf-muted">{t("common.loading")}</p>
      : !groups.length ?
        <p className="text-sm text-sf-muted">{t("monitoring.powerFavoriteGroupsEmpty")}</p>
      : (
        <ul className="space-y-3">
          {groups.map(({ group, mw, share, configured, resolved }) => (
            <li
              key={group.id}
              className="flex flex-col gap-2 rounded-lg border border-sf-border/50 bg-black/20 p-3 ring-1 ring-white/[0.03] sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <ItemThumb className={group.thumbClass} label="" size={36} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-sf-cream">{group.name}</p>
                  <p className="text-[0.65rem] text-sf-muted">
                    {t("dashboard.widgets.controlGroupBuildingCount", { count: configured })}
                    {resolved !== configured ?
                      <span className="text-sf-muted/70">
                        {" "}
                        ({t("monitoring.powerFavoriteGroupsResolved", { count: resolved })})
                      </span>
                    : null}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1 sm:min-w-[10rem]">
                <span className="font-mono text-sm tabular-nums text-sf-orange">
                  {formatDecimalSpaces(mw, 2)} MW
                </span>
                <div className="w-full max-w-[200px]">
                  <LinearFractionBar fraction={share} />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
