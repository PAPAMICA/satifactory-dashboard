import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import { FrmAssetClassPicker } from "@/components/FrmAssetClassPicker";
import { ItemThumb } from "@/components/ItemThumb";
import { useOpenBuildingDetail } from "@/contexts/BuildingDetailModalContext";
import { useFrmRefetchMs } from "@/hooks/useFrmRefetchMs";
import { apiFetch } from "@/lib/api";
import {
  createFavoriteBuildingGroup,
  readEnergyControlPrefs,
  removeFavoriteBuildingGroup,
  setBuildingAlias,
  setSwitchAlias,
  subscribeEnergyPrefs,
  toggleFavoriteBuilding,
  toggleFavoriteBuildingGroup,
  toggleFavoriteSwitch,
  upsertFavoriteBuildingGroup,
  type FavoriteBuildingGroup,
} from "@/lib/energyControlPrefs";
import { asFrmRowArray } from "@/lib/frmRows";
import { frmGetUrl } from "@/lib/frmApi";
import { switchRowId } from "@/lib/frmControl";
import { frmgClassLabel } from "@/lib/dashboardFrmgDisplay";
import { factoryBuildingClassForThumb, frmBuildingRowSearchBlob } from "@/lib/productionFrm";
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
        "flex size-8 shrink-0 items-center justify-center rounded-lg border text-[0.95rem] leading-none transition-all " +
        (on ?
          "border-sf-orange/55 bg-sf-orange/12 text-sf-orange shadow-[0_0_14px_rgba(251,146,60,0.12)]"
        : "border-sf-border/45 bg-black/35 text-sf-muted hover:border-sf-border/70 hover:bg-white/[0.04] hover:text-sf-cream")
      }
    >
      {on ? "★" : "☆"}
    </button>
  );
}

function SettingsSection({
  thumbClass,
  title,
  action,
  children,
  sectionClassName,
  bodyClassName,
}: {
  thumbClass: string;
  title: string;
  action?: ReactNode;
  children: ReactNode;
  /** Classes additionnelles sur `<section>` (ex. `flex-1 min-h-0` pour remplir une colonne). */
  sectionClassName?: string;
  /** Classes additionnelles sur le conteneur du corps (ex. `flex min-h-0 flex-1 flex-col`). */
  bodyClassName?: string;
}) {
  return (
    <section
      className={
        " rounded-2xl border border-sf-border/40 bg-gradient-to-b from-[#161411] to-[#0c0b09] shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_12px_40px_rgba(0,0,0,0.35)] ring-1 ring-black/50 " +
        (sectionClassName ?? "")
      }
    >
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-sf-border/35 bg-black/25 px-3 py-2.5 sm:gap-3 sm:px-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex shrink-0 rounded-lg border border-sf-border/35 bg-black/40 p-1 ring-1 ring-white/[0.04]">
            <ItemThumb className={thumbClass} label="" size={26} />
          </div>
          <h3 className="truncate text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-sf-cream">{title}</h3>
        </div>
        {action ? <div className="flex shrink-0 items-center">{action}</div> : null}
      </header>
      <div className={"p-3 sm:p-4 " + (bodyClassName ?? "")}>{children}</div>
    </section>
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
  const [memberSearch, setMemberSearch] = useState("");
  const [individualSearch, setIndividualSearch] = useState("");

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

  const filteredMemberRows = useMemo(() => {
    const q = memberSearch.trim().toLowerCase();
    const lang = i18n.language;
    if (!q) return buildingRows;
    return buildingRows.filter(({ row }) => frmBuildingRowSearchBlob(row, lang).includes(q));
  }, [buildingRows, memberSearch, i18n.language]);

  const filteredIndividualRows = useMemo(() => {
    const q = individualSearch.trim().toLowerCase();
    const lang = i18n.language;
    if (!q) return buildingRows;
    return buildingRows.filter(({ row }) => frmBuildingRowSearchBlob(row, lang).includes(q));
  }, [buildingRows, individualSearch, i18n.language]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const startNewDraft = useCallback(() => {
    setMemberSearch("");
    setDraft({
      name: "",
      thumbClass: "Build_ManufacturerMk1_C",
      memberIds: [],
    });
    setShowAssetPicker(false);
  }, []);

  const startEditDraft = useCallback((g: FavoriteBuildingGroup) => {
    setMemberSearch("");
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
    setMemberSearch("");
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

  const listSpaced = "space-y-1.5 overscroll-contain pr-1";

  return (
    <div className="fixed inset-0 z-[120] flex flex-col">
      <button
        type="button"
        className="absolute inset-0 bg-black/80 backdrop-blur-[2px] transition-opacity"
        aria-label={t("monitoring.productionClose")}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal
        aria-labelledby="control-fav-settings-title"
        className="relative z-10 flex h-[100dvh] max-h-[100dvh] w-full flex-col  border-0 bg-[#100e0c] pt-[env(safe-area-inset-top,0px)] shadow-[0_0_0_1px_rgba(61,53,40,0.35)]"
      >
        <header className="flex shrink-0 flex-col gap-3 border-b border-sf-border/45 bg-gradient-to-r from-sf-orange/[0.08] via-transparent to-sf-cyan/[0.05] px-4 py-3 sm:flex-row sm:items-start sm:justify-between sm:px-6 sm:py-4">
          <div className="min-w-0 flex-1">
            <h2
              id="control-fav-settings-title"
              className="sf-display text-base font-semibold uppercase tracking-[0.14em] text-sf-orange sm:text-lg"
            >
              {t("control.favoritesSettingsTitle")}
            </h2>
            <p className="mt-2 max-w-2xl text-[0.7rem] leading-relaxed text-sf-muted sm:text-xs">{t("control.powerFavoritesHint")}</p>
          </div>
          <button type="button" className="sf-btn shrink-0 self-start sm:self-auto" onClick={onClose}>
            {t("monitoring.productionClose")}
          </button>
        </header>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain bg-[radial-gradient(ellipse_120%_80%_at_50%_-20%,rgba(251,146,60,0.06),transparent_50%)] px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))] sm:px-6 lg:grid lg:h-full lg:min-h-0 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)] lg:gap-8 lg: lg:py-5">
          <div className="flex min-h-0 min-w-0 flex-col gap-6 lg:h-full lg:min-h-0 lg: lg:pr-1">
              <SettingsSection thumbClass="Build_PriorityPowerSwitch_C" title={t("monitoring.powerFavoritesSwitches")}>
                {swQ.isPending ?
                  <p className="py-6 text-center text-xs text-sf-muted">{t("common.loading")}</p>
                : !switches.length ?
                  <p className="py-6 text-center text-xs text-sf-muted">{t("monitoring.empty")}</p>
                : (
                  <ul className={`${listSpaced} lg:max-h-[min(32dvh,300px)] lg:overflow-y-auto`}>
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
                          className="grid grid-cols-[auto_1fr] items-center gap-2 rounded-xl border border-sf-border/30 bg-black/25 p-2.5 transition-colors hover:border-sf-orange/25 hover:bg-black/35 sm:grid-cols-[auto_minmax(0,1fr)_minmax(0,11rem)] sm:gap-3"
                        >
                          <StarBtn
                            on={fav}
                            onClick={() => toggleFavoriteSwitch(id)}
                            label={fav ? t("monitoring.powerFavRemove") : t("monitoring.powerFavAdd")}
                          />
                          <button
                            type="button"
                            className="flex min-w-0 items-center gap-2.5 text-left"
                            onClick={() => openBuildingDetail(r, { showMap: false, showAdminControls: isAdmin })}
                          >
                            <ItemThumb className={cls} label="" size={30} />
                            <span className="truncate text-xs font-medium text-sf-cream">{switchLabel}</span>
                          </button>
                          <input
                            defaultValue={alias}
                            placeholder={t("monitoring.powerAliasPlaceholder")}
                            onBlur={(e) => setSwitchAlias(id, e.target.value)}
                            className="sf-input col-span-2 min-h-9 w-full text-xs sm:col-span-1 sm:col-auto"
                          />
                        </li>
                      );
                    })}
                  </ul>
                )}
              </SettingsSection>

              <SettingsSection
                thumbClass="Build_ManufacturerMk1_C"
                title={t("control.favoritesIndividualBuildings")}
                sectionClassName="min-h-0 lg:flex lg:min-h-0 lg:flex-1 lg:flex-col"
                bodyClassName="flex min-h-0 flex-col lg:flex-1 lg:min-h-0"
              >
                {facQ.isPending || genQ.isPending ?
                  <p className="py-6 text-center text-xs text-sf-muted">{t("common.loading")}</p>
                : !buildingRows.length ?
                  <p className="py-6 text-center text-xs text-sf-muted">{t("monitoring.empty")}</p>
                : (
                  <>
                    <input
                      type="search"
                      value={individualSearch}
                      onChange={(e) => setIndividualSearch(e.target.value)}
                      placeholder={t("control.favoritesIndividualSearch")}
                      className="sf-input mb-2 min-h-9 w-full shrink-0 text-xs"
                      aria-label={t("control.favoritesIndividualSearch")}
                    />
                    {filteredIndividualRows.length ?
                      <ul className={`${listSpaced} min-h-0 lg:flex-1 lg:overflow-y-auto`}>
                        {filteredIndividualRows.map(({ id, row }) => {
                          const thumb = factoryBuildingClassForThumb(row);
                          const fav = prefs.favoriteBuildingIds.includes(id);
                          const alias = prefs.buildingAliases[id] ?? "";
                          const buildingLabel = alias.trim() || frmgClassLabel(thumb, i18n.language);
                          return (
                            <li
                              key={id}
                              className="grid grid-cols-[auto_1fr] items-center gap-2 rounded-xl border border-sf-border/30 bg-black/25 p-2.5 transition-colors hover:border-sf-orange/25 hover:bg-black/35 sm:grid-cols-[auto_minmax(0,1fr)_minmax(0,11rem)] sm:gap-3"
                            >
                              <StarBtn
                                on={fav}
                                onClick={() => toggleFavoriteBuilding(id)}
                                label={fav ? t("monitoring.powerFavRemove") : t("monitoring.powerFavAdd")}
                              />
                              <button
                                type="button"
                                className="flex min-w-0 items-center gap-2.5 text-left"
                                onClick={() => openBuildingDetail(row, { showMap: true, showAdminControls: isAdmin })}
                              >
                                <ItemThumb className={thumb} label="" size={30} />
                                <span className="truncate text-xs font-medium text-sf-cream">{buildingLabel}</span>
                              </button>
                              <input
                                defaultValue={alias}
                                placeholder={t("monitoring.powerAliasPlaceholder")}
                                onBlur={(e) => setBuildingAlias(id, e.target.value)}
                                className="sf-input col-span-2 min-h-9 w-full text-xs sm:col-span-1 sm:col-auto"
                              />
                            </li>
                          );
                        })}
                      </ul>
                    : individualSearch.trim() ?
                      <p className="py-8 text-center text-xs text-sf-muted">{t("monitoring.empty")}</p>
                    : null}
                  </>
                )}
              </SettingsSection>
          </div>

          <SettingsSection
              thumbClass="Build_MinerMk2_C"
              title={t("control.favoritesBuildingGroups")}
              sectionClassName="min-h-0 lg:flex lg:h-full lg:min-h-0 lg:flex-col"
              bodyClassName="flex min-h-0 flex-col lg:min-h-0 lg:flex-1 lg:"
              action={
                <button type="button" className="sf-btn text-xs" onClick={startNewDraft} disabled={draft !== null}>
                  {t("control.favoritesGroupNew")}
                </button>
              }
            >
              <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain lg:min-h-0">
              {!prefs.favoriteBuildingGroups.length ?
                <p className="rounded-lg border border-dashed border-sf-border/50 bg-black/20 px-4 py-8 text-center text-xs leading-relaxed text-sf-muted">
                  {t("control.favoritesNoGroupsYet")}
                </p>
              : (
                <ul className="mb-4 shrink-0 space-y-2">
                  {prefs.favoriteBuildingGroups.map((g) => {
                    const groupFav = prefs.favoriteBuildingGroupIds.includes(g.id);
                    return (
                      <li
                        key={g.id}
                        className="flex flex-wrap items-center gap-2 rounded-xl border border-sf-border/35 border-l-[3px] border-l-sf-orange/50 bg-gradient-to-r from-sf-orange/[0.04] to-black/20 p-2.5 pl-3 transition-colors hover:border-sf-border/50 hover:from-sf-orange/[0.07] sm:flex-nowrap sm:items-center sm:gap-3"
                      >
                        <StarBtn
                          on={groupFav}
                          onClick={() => toggleFavoriteBuildingGroup(g.id)}
                          label={groupFav ? t("monitoring.powerFavRemove") : t("monitoring.powerFavAdd")}
                        />
                        <div className="flex min-w-0 flex-1 items-center gap-2.5">
                          <ItemThumb className={g.thumbClass} label="" size={34} />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-sf-cream">{g.name}</p>
                            <p className="text-[0.65rem] text-sf-muted">
                              {g.memberBuildingIds.length} {t("control.favoritesGroupMembersCount")}
                            </p>
                          </div>
                        </div>
                        <div className="ml-auto flex shrink-0 flex-wrap items-center gap-2">
                          <button type="button" className="sf-btn text-xs" onClick={() => startEditDraft(g)}>
                            {t("control.favoritesGroupEdit")}
                          </button>
                          <button
                            type="button"
                            className="rounded-lg border border-sf-danger/35 px-2.5 py-1.5 text-[0.65rem] font-medium uppercase tracking-wider text-sf-danger transition-colors hover:border-sf-danger/60 hover:bg-sf-danger/10"
                            onClick={() => removeFavoriteBuildingGroup(g.id)}
                          >
                            {t("control.favoritesGroupDelete")}
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}

              {draft ?
                <div className="mt-2 min-h-0 flex-1  rounded-2xl border border-sf-orange/35 bg-gradient-to-b from-sf-orange/[0.09] via-[#12100e] to-[#0a0908] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] ring-1 ring-sf-orange/15 lg:flex lg:min-h-0 lg:flex-col">
                  <div className="border-b border-sf-orange/25 bg-sf-orange/[0.06] px-4 py-3">
                    <p className="text-sm font-semibold text-sf-cream">
                      {draft.id ? t("control.favoritesGroupEditTitle") : t("control.favoritesGroupCreateTitle")}
                    </p>
                    <p className="mt-1 text-[0.65rem] text-sf-muted">
                      {draft.memberIds.length} {t("control.favoritesGroupMembersCount")} · {t("control.favoritesGroupMembers")}
                    </p>
                  </div>
                  <div className="flex min-h-0 flex-1 flex-col gap-4  p-4 lg:min-h-0">
                    <label className="block shrink-0">
                      <span className="mb-1.5 block text-[0.65rem] font-medium uppercase tracking-wider text-sf-muted">
                        {t("control.favoritesGroupName")}
                      </span>
                      <input
                        type="text"
                        value={draft.name}
                        onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                        className="sf-input min-h-10 w-full text-sm"
                        placeholder={t("control.favoritesGroupNamePlaceholder")}
                      />
                    </label>
                    <div className="shrink-0">
                      <p className="mb-2 text-[0.65rem] font-medium uppercase tracking-wider text-sf-muted">
                        {t("control.favoritesGroupImage")}
                      </p>
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="rounded-xl border border-sf-border/40 bg-black/35 p-2 ring-1 ring-white/[0.04]">
                          <ItemThumb className={draft.thumbClass} label="" size={44} />
                        </div>
                        <button type="button" className="sf-btn text-xs" onClick={() => setShowAssetPicker((s) => !s)}>
                          {showAssetPicker ? t("control.favoritesGroupImageHide") : t("control.favoritesGroupImagePick")}
                        </button>
                      </div>
                      {showAssetPicker ?
                        <div className="mt-3 rounded-xl border border-sf-border/40 bg-black/30 p-2">
                          <FrmAssetClassPicker value={draft.thumbClass} onChange={(c) => setDraft({ ...draft, thumbClass: c })} />
                        </div>
                      : null}
                    </div>
                    <div className="flex min-h-0 min-w-0 flex-1 flex-col ">
                      <p className="mb-2 shrink-0 text-[0.65rem] font-medium uppercase tracking-wider text-sf-muted">
                        {t("control.favoritesGroupMembers")}
                      </p>
                      <input
                        type="search"
                        value={memberSearch}
                        onChange={(e) => setMemberSearch(e.target.value)}
                        placeholder={t("control.favoritesGroupMembersSearch")}
                        className="sf-input mb-2 min-h-9 w-full shrink-0 text-xs"
                      />
                      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-xl border border-sf-border/35 bg-black/30 p-2 ring-1 ring-inset ring-black/40">
                        {!filteredMemberRows.length ?
                          <p className="py-8 text-center text-xs text-sf-muted">{t("monitoring.empty")}</p>
                        : (
                          <ul className="space-y-0.5">
                            {filteredMemberRows.map(({ id, row }) => {
                              const thumb = factoryBuildingClassForThumb(row);
                              const raw = String(row.ClassName ?? row.className ?? "").trim();
                              const norm = raw ? normalizeBuildClassName(raw) : "—";
                              const img = norm !== "—" ? norm : thumb;
                              const on = draft.memberIds.includes(id);
                              const displayName = frmgClassLabel(img, i18n.language);
                              return (
                                <li key={`m-${id}`}>
                                  <div className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-white/[0.05]">
                                    <input
                                      type="checkbox"
                                      checked={on}
                                      onChange={() => toggleMember(id)}
                                      className="size-3.5 shrink-0 cursor-pointer rounded border-sf-border/60 bg-black/40 text-sf-orange focus:ring-2 focus:ring-sf-orange/40"
                                      aria-label={displayName}
                                    />
                                    <ItemThumb className={img} label="" size={24} />
                                    <button
                                      type="button"
                                      className="min-w-0 flex-1 truncate text-left text-xs font-medium text-sf-cream hover:text-sf-orange"
                                      onClick={() =>
                                        openBuildingDetail(row, { showMap: true, showAdminControls: isAdmin })
                                      }
                                    >
                                      {displayName}
                                    </button>
                                  </div>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2 border-t border-sf-border/30 pt-4">
                      <button type="button" className="sf-btn text-sm" onClick={saveDraft} disabled={!draft.name.trim()}>
                        {t("control.favoritesGroupSave")}
                      </button>
                      <button
                        type="button"
                        className="rounded-lg border border-sf-border/55 bg-black/25 px-4 py-2 text-sm text-sf-muted transition-colors hover:border-sf-orange/35 hover:bg-white/[0.04] hover:text-sf-cream"
                        onClick={() => {
                          setDraft(null);
                          setMemberSearch("");
                          setShowAssetPicker(false);
                        }}
                      >
                        {t("control.favoritesGroupCancel")}
                      </button>
                    </div>
                  </div>
                </div>
              : null}
              </div>
          </SettingsSection>
        </div>
      </div>
    </div>
  );
}
