import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import { FrmIndustrialLever } from "@/components/FrmIndustrialLever";
import { ItemThumb } from "@/components/ItemThumb";
import { useOpenBuildingDetail } from "@/contexts/BuildingDetailModalContext";
import { useFrmRefetchMs } from "@/hooks/useFrmRefetchMs";
import { apiFetch } from "@/lib/api";
import {
  displayNameForBuilding,
  displayNameForSwitch,
  readEnergyControlPrefs,
  subscribeEnergyPrefs,
  toggleFavoriteBuilding,
  toggleFavoriteSwitch,
} from "@/lib/energyControlPrefs";
import { asFrmRowArray } from "@/lib/frmRows";
import { frmGetUrl } from "@/lib/frmApi";
import {
  cacheBuildingEnabled,
  parseSetEnabledStatus,
  postSetEnabled,
  postSetSwitches,
  readCachedBuildingEnabled,
  switchRowId,
  switchRowIsOn,
} from "@/lib/frmControl";
import { frmgClassLabel } from "@/lib/dashboardFrmgDisplay";
import { factoryBuildingClassForThumb } from "@/lib/productionFrm";
import { normalizeBuildClassName } from "@/lib/monitoringFrm";

type Props = {
  editMode: boolean;
};

type Card =
  | { kind: "switch"; id: string; row: Record<string, unknown> }
  | { kind: "building"; id: string; row: Record<string, unknown> };

export function FrmDashboardControlWidget({ editMode }: Props) {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const openBuildingDetail = useOpenBuildingDetail();
  const prefs = useSyncExternalStore(subscribeEnergyPrefs, readEnergyControlPrefs, readEnergyControlPrefs);
  const refetchMs = useFrmRefetchMs();

  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: () => apiFetch<{ isAdmin?: boolean }>("/api/me"),
    staleTime: 60_000,
  });

  const swQ = useQuery({
    queryKey: ["frm", "getSwitches"],
    queryFn: () => apiFetch<unknown>(frmGetUrl("getSwitches")),
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
  const switches = asFrmRowArray(swQ.data);
  const factories = asFrmRowArray(facQ.data);
  const generators = asFrmRowArray(genQ.data);

  const cards: Card[] = useMemo(() => {
    const out: Card[] = [];
    for (const id of prefs.favoriteSwitchIds) {
      const row = switches.find((s) => switchRowId(s) === id);
      if (row) out.push({ kind: "switch", id, row });
    }
    for (const id of prefs.favoriteBuildingIds) {
      const fac = factories.find((r) => String(r.ID ?? r.Id ?? "") === id);
      if (fac) {
        out.push({ kind: "building", id, row: fac });
        continue;
      }
      const gen = generators.find((r) => String(r.ID ?? r.Id ?? r.id ?? "") === id);
      if (gen) out.push({ kind: "building", id, row: gen });
    }
    return out;
  }, [prefs.favoriteSwitchIds, prefs.favoriteBuildingIds, switches, factories, generators]);

  const swMut = useMutation({
    mutationFn: (p: { id: string; status: boolean }) => postSetSwitches({ ID: p.id, status: p.status }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["frm", "getSwitches"] });
      void qc.invalidateQueries({ queryKey: ["frm", "getPower"] });
    },
  });
  const enMut = useMutation({
    mutationFn: (p: { id: string; status: boolean }) => postSetEnabled({ ID: p.id, status: p.status }),
    onSuccess: (data, vars) => {
      const p = parseSetEnabledStatus(data);
      cacheBuildingEnabled(vars.id, p ?? vars.status);
      void qc.invalidateQueries({ queryKey: ["frm", "getFactory"] });
      void qc.invalidateQueries({ queryKey: ["frm", "getGenerators"] });
    },
  });

  if (!cards.length) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 p-4 text-center">
        <p className="text-xs text-sf-muted">{t("dashboard.widgets.controlEmptyFavorites")}</p>
        <p className="text-[0.65rem] text-sf-muted/80">{t("dashboard.widgets.controlEmptyFavoritesHint")}</p>
      </div>
    );
  }

  return (
    <ul className="flex h-full min-h-0 flex-col gap-2.5 overflow-y-auto p-2 sm:gap-3 sm:p-3">
      {cards.map((c) => {
        const id = c.id;
        if (c.kind === "switch") {
          const r = c.row;
          const cls = String(r.ClassName ?? r.className ?? "Build_PowerSwitch_C").trim();
          const frmName = String(r.Name ?? r.name ?? "").trim() || id;
          const title = displayNameForSwitch(id, frmName);
          const on = switchRowIsOn(r);
          const busy = swMut.isPending && swMut.variables?.id === id;
          const typeLbl = frmgClassLabel(cls, i18n.language);
          return (
            <li
              key={`sw-${id}`}
              className="flex flex-col gap-2 rounded-xl border border-sf-border/70 bg-gradient-to-b from-black/35 to-[#0f0e0c] p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] ring-1 ring-black/30 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:p-3"
            >
              <button
                type="button"
                className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg border border-transparent text-left transition-colors hover:border-sf-orange/25 hover:bg-white/[0.03]"
                onClick={() => openBuildingDetail(r, { showMap: false, showAdminControls: Boolean(me?.isAdmin) })}
              >
                <ItemThumb className={cls} label="" size={40} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-sf-cream">{title}</p>
                  <p className="truncate font-mono text-[0.55rem] text-sf-muted">{typeLbl}</p>
                </div>
              </button>
              <div className="flex shrink-0 items-center justify-between gap-2 sm:flex-col sm:items-end">
                <FrmIndustrialLever compact on={on} busy={busy} onToggle={() => swMut.mutate({ id, status: !on })} />
                {editMode ?
                  <button
                    type="button"
                    className="text-[0.6rem] uppercase tracking-wider text-sf-danger hover:underline"
                    onClick={() => toggleFavoriteSwitch(id)}
                  >
                    {t("dashboard.widgets.controlUnfavorite")}
                  </button>
                : null}
              </div>
            </li>
          );
        }
        const r = c.row;
        const raw = String(r.ClassName ?? r.className ?? "").trim();
        const norm = raw ? normalizeBuildClassName(raw) : "—";
        const img = norm !== "—" ? norm : factoryBuildingClassForThumb(r);
        const frmName = String(r.Name ?? r.name ?? "").trim() || id;
        const title = displayNameForBuilding(id, frmName);
        const on = readCachedBuildingEnabled(id) ?? true;
        const busy = enMut.isPending && enMut.variables?.id === id;
        const typeLbl = frmgClassLabel(img, i18n.language);
        return (
          <li
            key={`b-${id}`}
            className="flex flex-col gap-2 rounded-xl border border-sf-border/70 bg-gradient-to-b from-black/35 to-[#0f0e0c] p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] ring-1 ring-black/30 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:p-3"
          >
            <button
              type="button"
              className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg border border-transparent text-left transition-colors hover:border-sf-orange/25 hover:bg-white/[0.03]"
              onClick={() => openBuildingDetail(r, { showMap: true, showAdminControls: Boolean(me?.isAdmin) })}
            >
              <ItemThumb className={img} label="" size={40} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-sf-cream">{title}</p>
                <p className="truncate font-mono text-[0.55rem] text-sf-muted">{typeLbl}</p>
              </div>
            </button>
            <div className="flex shrink-0 items-center justify-between gap-2 sm:flex-col sm:items-end">
              <FrmIndustrialLever compact on={on} busy={busy} onToggle={() => enMut.mutate({ id, status: !on })} />
              {editMode ?
                <button
                  type="button"
                  className="text-[0.6rem] uppercase tracking-wider text-sf-danger hover:underline"
                  onClick={() => toggleFavoriteBuilding(id)}
                >
                  {t("dashboard.widgets.controlUnfavorite")}
                </button>
              : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
