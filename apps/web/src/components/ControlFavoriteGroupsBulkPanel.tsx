import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import { ItemThumb } from "@/components/ItemThumb";
import { useFrmRefetchMs } from "@/hooks/useFrmRefetchMs";
import { apiFetch } from "@/lib/api";
import { readEnergyControlPrefs, subscribeEnergyPrefs } from "@/lib/energyControlPrefs";
import { asFrmRowArray } from "@/lib/frmRows";
import { frmGetUrl } from "@/lib/frmApi";
import {
  cacheBuildingEnabled,
  parseSetEnabledStatus,
  postSetEnabled,
} from "@/lib/frmControl";
import { rowSupportsSetEnabled } from "@/lib/frmBuildingPowerPolicy";
import { formatDecimalSpaces } from "@/lib/formatNumber";
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

export function ControlFavoriteGroupsBulkPanel({ isAdmin }: { isAdmin: boolean }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const prefs = useSyncExternalStore(subscribeEnergyPrefs, readEnergyControlPrefs, readEnergyControlPrefs);
  const refetchMs = useFrmRefetchMs();

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

  const factories = asFrmRowArray(facQ.data);
  const generators = asFrmRowArray(genQ.data);

  const groups = useMemo(() => {
    const fav = new Set(prefs.favoriteBuildingGroupIds);
    return prefs.favoriteBuildingGroups
      .filter((g) => fav.has(g.id))
      .map((g) => {
        const members: { id: string; row: Record<string, unknown> }[] = [];
        for (const mid of g.memberBuildingIds) {
          const row = rowForBuildingId(mid, factories, generators);
          if (row) members.push({ id: mid, row });
        }
        const controllable = members.filter((m) => rowSupportsSetEnabled(m.row)).map((m) => m.id);
        const mw = sumFactoryRowsPowerMw(members.map((m) => m.row));
        return { group: g, members, controllable, mw };
      });
  }, [prefs.favoriteBuildingGroupIds, prefs.favoriteBuildingGroups, factories, generators]);

  const bulkMut = useMutation({
    mutationFn: async ({ ids, status }: { ids: string[]; status: boolean }) => {
      for (const id of ids) {
        const data = await postSetEnabled({ ID: id, status });
        const p = parseSetEnabledStatus(data);
        cacheBuildingEnabled(id, p ?? status);
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["frm", "getFactory"] });
      void qc.invalidateQueries({ queryKey: ["frm", "getGenerators"] });
      void qc.invalidateQueries({ queryKey: ["frm", "getPower"] });
      void qc.invalidateQueries({ queryKey: ["frm", "getPowerUsage"] });
    },
  });

  if (!prefs.favoriteBuildingGroupIds.length) {
    return (
      <section className="sf-panel ">
        <div className="sf-panel-header flex flex-wrap items-center gap-2 border-b border-sf-border/50 bg-gradient-to-r from-sf-orange/10 to-transparent">
          <ItemThumb className="Build_ManufacturerMk1_C" label="" size={28} />
          <span className="min-w-0 truncate font-medium uppercase tracking-wider text-sf-cream">
            {t("control.sectionFavoriteGroups")}
          </span>
        </div>
        <p className="px-3 py-3 text-sm text-sf-muted sm:px-4">{t("control.favoriteGroupsEmpty")}</p>
      </section>
    );
  }

  return (
    <section className="sf-panel ">
      <div className="sf-panel-header flex flex-wrap items-center gap-2 border-b border-sf-border/50 bg-gradient-to-r from-sf-orange/10 to-transparent">
        <ItemThumb className="Build_ManufacturerMk1_C" label="" size={28} />
        <span className="min-w-0 truncate font-medium uppercase tracking-wider text-sf-cream">
          {t("control.sectionFavoriteGroups")}
        </span>
      </div>
      <p className="border-b border-sf-border/40 px-3 py-2 text-xs text-sf-muted sm:px-4">{t("control.favoriteGroupsHint")}</p>
      <div className="max-h-[min(50vh,480px)] space-y-3 overflow-y-auto p-3 sm:p-4">
        {facQ.isPending || genQ.isPending ?
          <p className="text-xs text-sf-muted">{t("common.loading")}</p>
        : !groups.length ?
          <p className="text-sm text-sf-muted">{t("control.favoriteGroupsEmpty")}</p>
        : groups.map(({ group, controllable, mw }) => (
            <div
              key={group.id}
              className="flex flex-col gap-2 rounded-xl border border-sf-border/60 bg-black/25 p-3 ring-1 ring-white/[0.03] sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <ItemThumb className={group.thumbClass} label="" size={40} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-sf-cream">{group.name}</p>
                  <p className="text-[0.65rem] text-sf-muted">
                    {t("dashboard.widgets.controlGroupBuildingCount", { count: group.memberBuildingIds.length })} ·{" "}
                    <span className="font-mono text-sf-orange/90">{formatDecimalSpaces(mw, 2)} MW</span>
                  </p>
                  {!controllable.length ?
                    <p className="mt-1 text-[0.65rem] text-sf-muted">{t("control.favoriteGroupsNoneControllable")}</p>
                  : null}
                </div>
              </div>
              {isAdmin && controllable.length ?
                <div className="flex shrink-0 flex-wrap gap-2">
                  <button
                    type="button"
                    className="sf-btn text-xs"
                    disabled={bulkMut.isPending}
                    onClick={() => bulkMut.mutate({ ids: controllable, status: true })}
                  >
                    {bulkMut.isPending ? t("control.favoriteGroupsBusy") : t("control.favoriteGroupsAllOn")}
                  </button>
                  <button
                    type="button"
                    className="sf-btn border-sf-danger/50 text-xs text-sf-danger hover:bg-sf-danger/10"
                    disabled={bulkMut.isPending}
                    onClick={() => bulkMut.mutate({ ids: controllable, status: false })}
                  >
                    {bulkMut.isPending ? t("control.favoriteGroupsBusy") : t("control.favoriteGroupsAllOff")}
                  </button>
                </div>
              : null}
            </div>
          ))
        }
      </div>
    </section>
  );
}
