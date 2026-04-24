import { useQuery } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import { ItemThumb } from "@/components/ItemThumb";
import { useOpenBuildingDetail } from "@/contexts/BuildingDetailModalContext";
import { useFrmRefetchMs } from "@/hooks/useFrmRefetchMs";
import { apiFetch } from "@/lib/api";
import {
  displayNameForBuilding,
  displayNameForSwitch,
  isFavoriteBuilding,
  isFavoriteSwitch,
  readEnergyControlPrefs,
  setBuildingAlias,
  setSwitchAlias,
  subscribeEnergyPrefs,
  toggleFavoriteBuilding,
  toggleFavoriteSwitch,
} from "@/lib/energyControlPrefs";
import { asFrmRowArray } from "@/lib/frmRows";
import { frmGetUrl } from "@/lib/frmApi";
import { switchRowId } from "@/lib/frmControl";
import { frmgClassLabel } from "@/lib/dashboardFrmgDisplay";
import { factoryBuildingClassForThumb } from "@/lib/productionFrm";

function StarBtn({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      title={label}
      className={
        "flex size-9 shrink-0 items-center justify-center rounded-lg border text-lg leading-none transition-colors " +
        (on ? "border-sf-orange/60 bg-sf-orange/15 text-sf-orange" : "border-sf-border/50 bg-black/25 text-sf-muted hover:text-sf-cream")
      }
    >
      {on ? "★" : "☆"}
    </button>
  );
}

export function PowerEnergyFavoritesPanel() {
  const { t, i18n } = useTranslation();
  const refetchMs = useFrmRefetchMs();
  const prefs = useSyncExternalStore(subscribeEnergyPrefs, readEnergyControlPrefs, readEnergyControlPrefs);
  const openBuildingDetail = useOpenBuildingDetail();

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

  const switches = asFrmRowArray(swQ.data);
  const factories = asFrmRowArray(facQ.data);

  return (
    <section className="sf-panel min-w-0 overflow-hidden">
      <div className="sf-panel-header flex flex-wrap items-center gap-2 border-b border-sf-border/40 bg-gradient-to-r from-sf-orange/10 to-transparent">
        <ItemThumb className="Build_PriorityPowerSwitch_C" label="" size={28} />
        <span className="font-medium uppercase tracking-wider text-sf-cream">{t("monitoring.powerFavoritesTitle")}</span>
      </div>
      <div className="grid gap-4 p-3 sm:grid-cols-2 sm:p-4">
        <div className="min-w-0">
          <h3 className="mb-2 text-[0.65rem] font-semibold uppercase tracking-wider text-sf-muted">
            {t("monitoring.powerFavoritesSwitches")}
          </h3>
          {swQ.isPending ?
            <p className="text-xs text-sf-muted">{t("common.loading")}</p>
          : !switches.length ?
            <p className="text-xs text-sf-muted">{t("monitoring.empty")}</p>
          : (
            <ul className="max-h-[min(40vh,360px)] space-y-2 overflow-y-auto pr-1">
              {switches.map((r, i) => {
                const id = switchRowId(r);
                if (!id) return null;
                const cls = String(r.ClassName ?? r.className ?? "Build_PowerSwitch_C").trim();
                const nm = String(r.Name ?? r.name ?? "").trim() || id;
                const fav = isFavoriteSwitch(id);
                const alias = prefs.switchAliases[id] ?? "";
                return (
                  <li
                    key={`${id}-${i}`}
                    className="flex flex-wrap items-center gap-2 rounded-lg border border-sf-border/50 bg-black/20 p-2"
                  >
                    <StarBtn
                      on={fav}
                      onClick={() => toggleFavoriteSwitch(id)}
                      label={fav ? t("monitoring.powerFavRemove") : t("monitoring.powerFavAdd")}
                    />
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 items-center gap-2 text-left"
                      onClick={() => openBuildingDetail(r, { showMap: false, showAdminControls: Boolean(me?.isAdmin) })}
                    >
                      <ItemThumb className={cls} label="" size={32} />
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium text-sf-cream">{displayNameForSwitch(id, nm)}</p>
                        <p className="truncate font-mono text-[0.55rem] text-sf-muted">{frmgClassLabel(cls, i18n.language)}</p>
                      </div>
                    </button>
                    <input
                      defaultValue={alias}
                      placeholder={t("monitoring.powerAliasPlaceholder")}
                      onBlur={(e) => setSwitchAlias(id, e.target.value)}
                      className="sf-input min-h-8 min-w-[7rem] flex-1 text-[0.65rem] sm:max-w-[10rem]"
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="min-w-0">
          <h3 className="mb-2 text-[0.65rem] font-semibold uppercase tracking-wider text-sf-muted">
            {t("monitoring.powerFavoritesBuildings")}
          </h3>
          {facQ.isPending ?
            <p className="text-xs text-sf-muted">{t("common.loading")}</p>
          : !factories.length ?
            <p className="text-xs text-sf-muted">{t("monitoring.empty")}</p>
          : (
            <ul className="max-h-[min(40vh,360px)] space-y-2 overflow-y-auto pr-1">
              {factories.slice(0, 120).map((r, i) => {
                const id = String(r.ID ?? r.Id ?? "").trim();
                if (!id) return null;
                const thumb = factoryBuildingClassForThumb(r);
                const nm = String(r.Name ?? r.name ?? "").trim() || id;
                const fav = isFavoriteBuilding(id);
                const alias = prefs.buildingAliases[id] ?? "";
                return (
                  <li
                    key={`${id}-${i}`}
                    className="flex flex-wrap items-center gap-2 rounded-lg border border-sf-border/50 bg-black/20 p-2"
                  >
                    <StarBtn
                      on={fav}
                      onClick={() => toggleFavoriteBuilding(id)}
                      label={fav ? t("monitoring.powerFavRemove") : t("monitoring.powerFavAdd")}
                    />
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 items-center gap-2 text-left"
                      onClick={() => openBuildingDetail(r, { showMap: true, showAdminControls: Boolean(me?.isAdmin) })}
                    >
                      <ItemThumb className={thumb} label="" size={32} />
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium text-sf-cream">{displayNameForBuilding(id, nm)}</p>
                        <p className="truncate font-mono text-[0.55rem] text-sf-muted">
                          {frmgClassLabel(thumb, i18n.language)}
                        </p>
                      </div>
                    </button>
                    <input
                      defaultValue={alias}
                      placeholder={t("monitoring.powerAliasPlaceholder")}
                      onBlur={(e) => setBuildingAlias(id, e.target.value)}
                      className="sf-input min-h-8 min-w-[7rem] flex-1 text-[0.65rem] sm:max-w-[10rem]"
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
