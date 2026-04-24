import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import { FrmAssetClassPicker } from "@/components/FrmAssetClassPicker";
import { ItemThumb } from "@/components/ItemThumb";
import { useOpenBuildingDetail } from "@/contexts/BuildingDetailModalContext";
import { useFrmRefetchMs } from "@/hooks/useFrmRefetchMs";
import {
  createFavoriteBuildingGroup,
  readEnergyControlPrefs,
  removeFavoriteBuildingGroup,
  setBuildingAlias,
  setSwitchAlias,
  subscribeEnergyPrefs,
  toggleFavoriteBuilding,
  toggleFavoriteSwitch,
  upsertFavoriteBuildingGroup,
  type FavoriteBuildingGroup,
} from "@/lib/energyControlPrefs";
import { asFrmRowArray } from "@/lib/frmRows";
import { frmGetUrl } from "@/lib/frmApi";
import { switchRowId } from "@/lib/frmControl";
import { frmgClassLabel } from "@/lib/dashboardFrmgDisplay";
import { factoryBuildingClassForThumb } from "@/lib/productionFrm";
import { normalizeBuildClassName } from "@/lib/monitoringFrm";

type Draft = {
  id?: string;
  name: string;
  thumbClass: string;
  memberIds: string[];
};

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

type Props = {
  open: boolean;
  onClose: () => void;
  isAdmin: boolean;
};

export function ControlFavoritesSettingsModal({ open, onClose, isAdmin }: Props) {
  const { t, i18n } = useTranslation();
  const refetchMs = useFrmRefetchMs();
  const prefs = useSyncExternalStore(subscribeEnergyPrefs, readEnergyControlPrefs, readEnergyControlPrefs);
  const openBuildingDetail = useOpenBuildingDetail();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [showAssetPicker, setShowAssetPicker] = useState(false);

  const swQ = useQuery({
    queryKey: ["frm", "getSwitches"],
    queryFn: () => apiFetch<unknown>(frmGetUrl("getSwitches")),
    refetchInterval: refetchMs,
    enabled: open,
  });
  const facQ = useQuery({
    queryKey: ["frm", "getFactory"],
    queryFn: () => apiFetch<unknown>(frmGetUrl("getFactory")),
    refetchInterval: refetchMs,
    enabled: open,
  });
  const genQ = useQuery({
    queryKey: ["frm", "getGenerators"],
    queryFn: () => apiFetch<unknown>(frmGetUrl("getGenerators")),
    refetchInterval: refetchMs,
    enabled: open,
  });

  const switches = asFrmRowArray(swQ.data);
  const factories = asFrmRowArray(facQ.data);
  const generators = asFrmRowArray(genQ.data);

  const buildingRows = useMemo(() => {
    const lang = i18n.language;
    const rows: { id: string; row: Record<string, unknown> }[] = [];
    for (const r of factories) {
      const id = String(r.ID ?? r.Id ?? "").trim();
      if (id) rows.push({ id, row: r });
    }
    for (const r of generators) {
      const id = String(r.ID ?? r.Id ?? r.id ?? "").trim();
      if (id) rows.push({ id, row: r });
    }
    rows.sort((a, b) => {
      const ta = frmgClassLabel(factoryBuildingClassForThumb(a.row), lang);
      const tb = frmgClassLabel(factoryBuildingClassForThumb(b.row), lang);
      return ta.localeCompare(tb, lang, { sensitivity: "base" });
    });
    return rows;
  }, [factories, generators, i18n.language]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const startNewDraft = useCallback(() => {
    setDraft({
      name: "",
      thumbClass: "Build_ManufacturerMk1_C",
      memberIds: [],
    });
    setShowAssetPicker(false);
  }, []);

  const startEditDraft = useCallback((g: FavoriteBuildingGroup) => {
    setDraft({
      id: g.id,
      name: g.name,
      thumbClass: g.thumbClass,
      memberIds: [...g.memberBuildingIds],
    });
    setShowAssetPicker(false);
  }, []);

  const saveDraft = useCallback(() => {
    if (!draft || !draft.name.trim()) return;
    if (draft.id) {
      upsertFavoriteBuildingGroup({
        id: draft.id,
        name: draft.name.trim(),
        thumbClass: draft.thumbClass,
        memberBuildingIds: draft.memberIds,
      });
    } else {
      createFavoriteBuildingGroup({
        name: draft.name.trim(),
        thumbClass: draft.thumbClass,
        memberBuildingIds: draft.memberIds,
      });
    }
    setDraft(null);
    setShowAssetPicker(false);
  }, [draft]);

  const toggleMember = useCallback((id: string) => {
    setDraft((d) => {
      if (!d) return d;
      const set = new Set(d.memberIds);
      if (set.has(id)) set.delete(id);
      else set.add(id);
      return { ...d, memberIds: [...set] };
    });
  }, []);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center bg-black/75 p-0 sm:items-center sm:p-4"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal
        aria-labelledby="control-fav-settings-title"
        className="flex max-h-[min(92dvh,880px)] w-full max-w-3xl flex-col overflow-hidden rounded-t-xl border border-sf-border/80 bg-[#14120f] shadow-2xl sm:rounded-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-sf-border/60 px-4 py-3">
          <h2 id="control-fav-settings-title" className="sf-display text-sm font-semibold uppercase tracking-wider text-sf-cream sm:text-base">
            {t("control.favoritesSettingsTitle")}
          </h2>
          <button type="button" className="sf-btn shrink-0 text-xs" onClick={onClose}>
            {t("monitoring.productionClose")}
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <div className="space-y-8">
            <section>
              <h3 className="mb-2 text-[0.65rem] font-semibold uppercase tracking-wider text-sf-muted">
                {t("monitoring.powerFavoritesSwitches")}
              </h3>
              {swQ.isPending ?
                <p className="text-xs text-sf-muted">{t("common.loading")}</p>
              : !switches.length ?
                <p className="text-xs text-sf-muted">{t("monitoring.empty")}</p>
              : (
                <ul className="max-h-56 space-y-2 overflow-y-auto pr-1">
                  {switches.map((r, i) => {
                    const id = switchRowId(r);
                    if (!id) return null;
                    const cls = String(r.ClassName ?? r.className ?? "Build_PowerSwitch_C").trim();
                    const fav = prefs.favoriteSwitchIds.includes(id);
                    const alias = prefs.switchAliases[id] ?? "";
                    const switchLabel = alias.trim() || frmgClassLabel(cls, i18n.language);
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
                          onClick={() => openBuildingDetail(r, { showMap: false, showAdminControls: isAdmin })}
                        >
                          <ItemThumb className={cls} label="" size={32} />
                          <span className="truncate text-xs font-medium text-sf-cream">{switchLabel}</span>
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
            </section>

            <section>
              <h3 className="mb-2 text-[0.65rem] font-semibold uppercase tracking-wider text-sf-muted">
                {t("control.favoritesIndividualBuildings")}
              </h3>
              {facQ.isPending || genQ.isPending ?
                <p className="text-xs text-sf-muted">{t("common.loading")}</p>
              : !buildingRows.length ?
                <p className="text-xs text-sf-muted">{t("monitoring.empty")}</p>
              : (
                <ul className="max-h-56 space-y-2 overflow-y-auto pr-1">
                  {buildingRows.map(({ id, row }) => {
                    const thumb = factoryBuildingClassForThumb(row);
                    const fav = prefs.favoriteBuildingIds.includes(id);
                    const alias = prefs.buildingAliases[id] ?? "";
                    const buildingLabel = alias.trim() || frmgClassLabel(thumb, i18n.language);
                    return (
                      <li key={id} className="flex flex-wrap items-center gap-2 rounded-lg border border-sf-border/50 bg-black/20 p-2">
                        <StarBtn
                          on={fav}
                          onClick={() => toggleFavoriteBuilding(id)}
                          label={fav ? t("monitoring.powerFavRemove") : t("monitoring.powerFavAdd")}
                        />
                        <button
                          type="button"
                          className="flex min-w-0 flex-1 items-center gap-2 text-left"
                          onClick={() => openBuildingDetail(row, { showMap: true, showAdminControls: isAdmin })}
                        >
                          <ItemThumb className={thumb} label="" size={32} />
                          <span className="truncate text-xs font-medium text-sf-cream">{buildingLabel}</span>
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
            </section>

            <section>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-[0.65rem] font-semibold uppercase tracking-wider text-sf-muted">
                  {t("control.favoritesBuildingGroups")}
                </h3>
                <button type="button" className="sf-btn text-xs" onClick={startNewDraft} disabled={draft !== null}>
                  {t("control.favoritesGroupNew")}
                </button>
              </div>

              {prefs.favoriteBuildingGroups.length ?
                <ul className="mb-4 space-y-2">
                  {prefs.favoriteBuildingGroups.map((g) => (
                    <li
                      key={g.id}
                      className="flex flex-wrap items-center gap-2 rounded-lg border border-sf-orange/25 bg-black/25 p-2"
                    >
                      <ItemThumb className={g.thumbClass} label="" size={36} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-sf-cream">{g.name}</p>
                        <p className="text-[0.6rem] text-sf-muted">
                          {g.memberBuildingIds.length} {t("control.favoritesGroupMembersCount")}
                        </p>
                      </div>
                      <button type="button" className="sf-btn shrink-0 text-xs" onClick={() => startEditDraft(g)}>
                        {t("control.favoritesGroupEdit")}
                      </button>
                      <button
                        type="button"
                        className="shrink-0 text-xs text-sf-danger hover:underline"
                        onClick={() => removeFavoriteBuildingGroup(g.id)}
                      >
                        {t("control.favoritesGroupDelete")}
                      </button>
                    </li>
                  ))}
                </ul>
              : (
                <p className="mb-4 text-xs text-sf-muted">{t("control.favoritesNoGroupsYet")}</p>
              )}

              {draft ?
                <div className="rounded-xl border border-sf-border/70 bg-black/30 p-3 ring-1 ring-white/[0.04]">
                  <p className="mb-2 text-xs font-medium text-sf-cream">
                    {draft.id ? t("control.favoritesGroupEditTitle") : t("control.favoritesGroupCreateTitle")}
                  </p>
                  <div className="space-y-3">
                    <label className="block text-[0.65rem] text-sf-muted">
                      {t("control.favoritesGroupName")}
                      <input
                        type="text"
                        value={draft.name}
                        onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                        className="sf-input mt-1 min-h-9 w-full text-sm"
                        placeholder={t("control.favoritesGroupNamePlaceholder")}
                      />
                    </label>
                    <div>
                      <p className="text-[0.65rem] text-sf-muted">{t("control.favoritesGroupImage")}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <ItemThumb className={draft.thumbClass} label="" size={44} />
                        <button type="button" className="sf-btn text-xs" onClick={() => setShowAssetPicker((s) => !s)}>
                          {showAssetPicker ? t("control.favoritesGroupImageHide") : t("control.favoritesGroupImagePick")}
                        </button>
                      </div>
                      {showAssetPicker ?
                        <div className="mt-2">
                          <FrmAssetClassPicker value={draft.thumbClass} onChange={(c) => setDraft({ ...draft, thumbClass: c })} />
                        </div>
                      : null}
                    </div>
                    <div>
                      <p className="mb-1 text-[0.65rem] text-sf-muted">{t("control.favoritesGroupMembers")}</p>
                      <div className="max-h-40 overflow-y-auto rounded border border-sf-border/40 bg-black/20 p-2">
                        <ul className="space-y-1">
                          {buildingRows.map(({ id, row }) => {
                            const thumb = factoryBuildingClassForThumb(row);
                            const raw = String(row.ClassName ?? row.className ?? "").trim();
                            const norm = raw ? normalizeBuildClassName(raw) : "—";
                            const img = norm !== "—" ? norm : thumb;
                            const on = draft.memberIds.includes(id);
                            return (
                              <li key={`m-${id}`}>
                                <label className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 hover:bg-white/[0.04]">
                                  <input type="checkbox" checked={on} onChange={() => toggleMember(id)} className="rounded" />
                                  <ItemThumb className={img} label="" size={24} />
                                  <span className="truncate text-xs text-sf-cream">{frmgClassLabel(img, i18n.language)}</span>
                                </label>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 pt-1">
                      <button type="button" className="sf-btn text-xs" onClick={saveDraft} disabled={!draft.name.trim()}>
                        {t("control.favoritesGroupSave")}
                      </button>
                      <button
                        type="button"
                        className="rounded border border-sf-border/60 px-3 py-1.5 text-xs text-sf-muted hover:border-sf-orange/40"
                        onClick={() => {
                          setDraft(null);
                          setShowAssetPicker(false);
                        }}
                      >
                        {t("control.favoritesGroupCancel")}
                      </button>
                    </div>
                  </div>
                </div>
              : null}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
