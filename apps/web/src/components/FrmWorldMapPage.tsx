import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { DeckGLRef } from "@deck.gl/react";
import { ItemThumb } from "@/components/ItemThumb";
import { IconLayers, IconSearch } from "@/components/InventoryIcons";
import {
  FrmWorldMapDeck,
  markerDetailForPopup,
  projectMarkerToPixel,
} from "@/components/FrmWorldMapDeck";
import { useFrmMapInfrastructure } from "@/hooks/useFrmMapInfrastructure";
import { useFrmMapMarkerFilters } from "@/hooks/useFrmMapMarkerFilters";
import { useFrmRefetchMs } from "@/hooks/useFrmRefetchMs";
import { useOpenBuildingDetail } from "@/contexts/BuildingDetailModalContext";
import { defaultFrmMapLayerVisibility, type FrmMapLayerVisibility } from "@/lib/frmMapOverlays";
import { mapInfraToggleCssRgba } from "@/lib/frmMapPalette";
import { frmMarkerMapPosition } from "@/lib/frmMapWorld";
import { thumbClassForMapMarker } from "@/lib/mapMarkerDisplay";

export type FrmWorldMapPageProps = {
  markers: Record<string, unknown>[];
  scrollWheelZoom?: boolean;
  className?: string;
  /** Contrôles admin sur la modale bâtiment (alimentation FRM). */
  isAdmin?: boolean;
};

export function FrmWorldMapPage({
  markers,
  scrollWheelZoom = true,
  className = "",
  isAdmin = false,
}: FrmWorldMapPageProps) {
  const { t } = useTranslation();
  const openBuildingDetail = useOpenBuildingDetail();
  const refetchMs = useFrmRefetchMs();
  const {
    search,
    setSearch,
    hiddenTypes,
    typesPresent,
    filtered,
    fitBoundsKey,
    toggleType,
    showAllTypes,
  } = useFrmMapMarkerFilters(markers);
  const { overlays, overlayCountKey, isPending: infraPending, isError: infraError } = useFrmMapInfrastructure(
    refetchMs !== false,
    refetchMs,
  );
  const [layerVis, setLayerVis] = useState<FrmMapLayerVisibility>(() => defaultFrmMapLayerVisibility());
  const [selected, setSelected] = useState<Record<string, unknown> | null>(null);
  const [selectedBuilding, setSelectedBuilding] = useState<Record<string, unknown> | null>(null);
  const [projTick, setProjTick] = useState(0);
  const deckRef = useRef<DeckGLRef | null>(null);
  const mapWrapRef = useRef<HTMLDivElement>(null);

  const layerVisKey = useMemo(
    () =>
      `${layerVis.buildingStorage ? 1 : 0}${layerVis.buildingPower ? 1 : 0}${layerVis.buildingProduction ? 1 : 0}${layerVis.cables ? 1 : 0}${layerVis.pipes ? 1 : 0}${layerVis.belts ? 1 : 0}`,
    [layerVis],
  );

  const mapAutoFitToken = useMemo(
    () => `${fitBoundsKey}|${overlayCountKey}|${layerVisKey}`,
    [fitBoundsKey, overlayCountKey, layerVisKey],
  );

  const selectedId = selected ? String(selected.ID ?? selected.Id ?? "") : null;
  const selectedBuildingId = selectedBuilding ? String(selectedBuilding.ID ?? selectedBuilding.Id ?? "") : null;

  const onSelectMarker = useCallback((row: Record<string, unknown> | null) => {
    setSelected(row);
    if (row) setSelectedBuilding(null);
  }, []);

  const onSelectBuilding = useCallback(
    (row: Record<string, unknown> | null) => {
      setSelectedBuilding(row);
      if (row) {
        setSelected(null);
        openBuildingDetail(row, {
          showMap: false,
          showAdminControls: isAdmin,
          onClosed: () => setSelectedBuilding(null),
        });
      }
    },
    [isAdmin, openBuildingDetail],
  );

  const bumpProj = useCallback(() => {
    setProjTick((n) => n + 1);
  }, []);

  useLayoutEffect(() => {
    bumpProj();
  }, [selected, selectedBuilding, fitBoundsKey, mapAutoFitToken, bumpProj]);

  useLayoutEffect(() => {
    const el = mapWrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => bumpProj());
    ro.observe(el);
    return () => ro.disconnect();
  }, [bumpProj]);

  const selectedPos = useMemo(() => (selected ? frmMarkerMapPosition(selected) : null), [selected]);

  const popupPixel = useMemo(() => {
    if (!selectedPos) return null;
    const deck = deckRef.current?.deck;
    return projectMarkerToPixel(deck, selectedPos);
  }, [selectedPos, projTick]);

  const toggleLayer = (k: keyof FrmMapLayerVisibility) => {
    setLayerVis((v) => ({ ...v, [k]: !v[k] }));
  };

  const infraLayerEntries = [
    ["buildingStorage", "mapLegendStorage"],
    ["buildingPower", "mapLegendPower"],
    ["buildingProduction", "mapLegendProduction"],
    ["cables", "mapLayerCables"],
    ["pipes", "mapLayerPipes"],
    ["belts", "mapLayerBelts"],
  ] as const;

  const detail = selected ? markerDetailForPopup(selected) : null;

  return (
    <div className={`flex min-h-0 flex-1 flex-col gap-3 lg:flex-row lg:gap-4 ${className}`}>
      <aside className="order-2 flex max-h-[min(44vh,440px)] w-full shrink-0 flex-col gap-3.5 overflow-y-auto rounded-lg border border-sf-border/70 bg-gradient-to-b from-[#232018]/95 via-[#181610] to-[#100e0c] p-3 shadow-[inset_0_1px_0_rgba(255,200,120,0.07)] ring-1 ring-black/50 sm:p-3.5 lg:order-1 lg:max-h-none lg:w-[min(100%,20.5rem)] lg:shrink-0 xl:w-[22rem]">
        <header className="border-b border-sf-border/50 pb-3">
          <p className="sf-display text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-sf-orange">
            {t("monitoring.mapSidebarTitle")}
          </p>
          <div className="mt-2.5">
            <span
              className="inline-flex items-baseline gap-1 rounded-md border border-sf-cyan/30 bg-sf-cyan/[0.07] px-2.5 py-1 font-mono text-[0.7rem] tabular-nums text-sf-cyan"
              title={t("monitoring.mapShownCount", { n: filtered.length, total: markers.length })}
            >
              <span>{filtered.length}</span>
              <span className="text-sf-muted/90">/</span>
              <span className="text-sf-muted">{markers.length}</span>
            </span>
          </div>
        </header>

        <div>
          <label className="mb-1.5 flex items-center gap-1.5 text-[0.62rem] font-medium uppercase tracking-wider text-sf-muted" htmlFor="frm-map-search">
            <IconSearch className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
            {t("monitoring.mapMarkersPanelTitle")}
          </label>
          <div className="sf-input flex min-h-10 w-full items-center gap-2 !py-0 !pl-2.5 !pr-2">
            <IconSearch className="h-4 w-4 shrink-0 text-sf-muted" aria-hidden />
            <input
              id="frm-map-search"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("monitoring.mapSearchPlaceholder")}
              className="min-h-10 min-w-0 flex-1 border-0 bg-transparent py-2 text-sm text-sf-text outline-none placeholder:text-sf-muted"
              autoComplete="off"
            />
          </div>
        </div>

        <section className="rounded-lg border border-sf-border/55 bg-black/25 p-2.5 ring-1 ring-white/[0.03]">
          <div className="mb-2 flex items-center gap-2 border-b border-sf-border/40 pb-2">
            <IconLayers className="h-4 w-4 shrink-0 text-sf-orange/90" aria-hidden />
            <h3 className="sf-display min-w-0 flex-1 text-[0.68rem] font-semibold uppercase tracking-wider text-sf-cream">
              {t("monitoring.mapInfraLayersTitle")}
            </h3>
          </div>
          <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {infraLayerEntries.map(([key, labelKey]) => {
              const on = layerVis[key];
              return (
                <li key={key}>
                  <button
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleLayer(key)}
                    className={
                      "flex w-full min-w-0 items-center gap-2 rounded-md border px-2 py-1.5 text-left text-xs transition-all " +
                      (on ?
                        "border-sf-orange/45 bg-sf-orange/[0.1] text-sf-cream shadow-[inset_0_0_0_1px_rgba(255,154,26,0.12)]"
                      : "border-sf-border/45 bg-black/20 text-sf-muted opacity-[0.82] hover:border-sf-border-bright/60 hover:opacity-100")
                    }
                  >
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-sm ring-1 ring-black/60"
                      style={{ backgroundColor: mapInfraToggleCssRgba(key) }}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1 leading-snug">{t(`monitoring.${labelKey}`)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          {infraPending ? <p className="mt-2 text-[0.62rem] text-sf-muted">{t("monitoring.mapInfraLoading")}</p> : null}
          {infraError ? <p className="mt-2 text-[0.62rem] text-sf-orange">{t("monitoring.mapInfraError")}</p> : null}
        </section>

        <section className="rounded-lg border border-sf-border/55 bg-black/25 p-2.5 ring-1 ring-white/[0.03]">
          <div className="mb-2 flex items-center justify-between gap-2 border-b border-sf-border/40 pb-2">
            <h3 className="sf-display text-[0.68rem] font-semibold uppercase tracking-wider text-sf-cream">
              {t("monitoring.mapMarkerTypes")}
            </h3>
            <button
              type="button"
              disabled={hiddenTypes.size === 0}
              className="shrink-0 rounded border border-sf-border/70 bg-black/35 px-2 py-1 text-[0.62rem] font-medium uppercase tracking-wide text-sf-cyan transition-colors enabled:hover:border-sf-cyan/50 enabled:hover:bg-sf-cyan/10 disabled:cursor-not-allowed disabled:opacity-35"
              onClick={showAllTypes}
            >
              {t("monitoring.mapResetFilters")}
            </button>
          </div>
          <div className="max-h-[min(11rem,32vh)] overflow-y-auto pr-0.5 sm:max-h-52">
            <ul className="flex flex-wrap gap-1.5">
              {typesPresent.map((typ) => {
                const thumb = thumbClassForMapMarker({ MapMarkerType: typ });
                const on = !hiddenTypes.has(typ);
                const short = typ.replace(/^RT_/, "");
                return (
                  <li key={typ}>
                    <button
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggleType(typ)}
                      className={
                        "inline-flex max-w-full items-center gap-1.5 rounded-full border px-1.5 py-1 pl-1 text-left transition-all " +
                        (on ?
                          "border-sf-orange/50 bg-sf-orange/[0.12] text-sf-cream shadow-[0_0_0_1px_rgba(255,154,26,0.12)]"
                        : "border-sf-border/50 bg-black/35 text-sf-muted opacity-60 hover:opacity-95")
                      }
                    >
                      <ItemThumb className={thumb} label="" size={24} />
                      <span className="max-w-[9.5rem] truncate font-mono text-[0.58rem] leading-tight" title={typ}>
                        {short}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
      </aside>
      <div className="order-1 flex min-h-[min(50vh,520px)] min-w-0 flex-1 basis-0 flex-col lg:order-2">
        <div
          ref={mapWrapRef}
          className="relative flex min-h-[280px] flex-1 basis-0 flex-col overflow-hidden rounded-lg border border-sf-border/60 bg-[#0a0908] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)] sm:min-h-[min(52vh,640px)]"
        >
          <FrmWorldMapDeck
            deckRef={deckRef}
            onDeckLoad={bumpProj}
            onAfterViewStateChange={bumpProj}
            markers={filtered}
            autoFitToken={mapAutoFitToken}
            worldOverlays={overlays}
            layerVisibility={layerVis}
            scrollWheelZoom={scrollWheelZoom}
            selectedId={selectedId}
            selectedBuildingId={selectedBuildingId}
            onSelectMarker={onSelectMarker}
            onSelectBuilding={onSelectBuilding}
            className="min-h-0 flex-1"
          />
          {!markers.length ? (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/40 text-sm text-sf-cream">
              {t("monitoring.empty")}
            </div>
          ) : null}
          {detail && popupPixel ? (
            <div
              className="pointer-events-auto absolute z-10 max-w-[min(260px,calc(100%-16px))] rounded border border-sf-border-bright bg-[#1a1814] p-3 shadow-lg"
              style={(() => {
                const cw = mapWrapRef.current?.clientWidth ?? 400;
                const panel = Math.min(260, cw - 16);
                const left = Math.max(8, Math.min(popupPixel[0] + 10, cw - panel - 8));
                return {
                  left,
                  top: Math.max(8, popupPixel[1] - 8),
                  transform: "translateY(-100%)",
                };
              })()}
            >
              <button
                type="button"
                className="absolute right-1 top-1 rounded px-1.5 text-xs text-sf-muted hover:bg-white/10 hover:text-sf-cream"
                onClick={() => setSelected(null)}
                aria-label={t("monitoring.mapDetailDismiss")}
              >
                ×
              </button>
              <div className="flex gap-2 pr-5">
                <ItemThumb className={detail.thumb} label="" size={40} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold leading-tight text-sf-cream">{detail.nm}</p>
                  <p className="mt-0.5 font-mono text-[0.65rem] text-sf-muted">{detail.typ}</p>
                  <p className="mt-1 font-mono text-[0.65rem] text-sf-muted">
                    {Number.isFinite(Number(detail.x)) ? Math.round(Number(detail.x)) : "—"},{" "}
                    {Number.isFinite(Number(detail.y)) ? Math.round(Number(detail.y)) : "—"},{" "}
                    {Number.isFinite(Number(detail.z)) ? Math.round(Number(detail.z)) : "—"}
                  </p>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
