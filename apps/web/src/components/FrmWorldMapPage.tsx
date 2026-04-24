import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { DeckGLRef } from "@deck.gl/react";
import { ItemThumb } from "@/components/ItemThumb";
import {
  FrmWorldMapDeck,
  markerDetailForPopup,
  projectMarkerToPixel,
} from "@/components/FrmWorldMapDeck";
import { useFrmMapInfrastructure } from "@/hooks/useFrmMapInfrastructure";
import { useFrmMapMarkerFilters } from "@/hooks/useFrmMapMarkerFilters";
import { useFrmRefetchMs } from "@/hooks/useFrmRefetchMs";
import { ProductionBuildingModal } from "@/components/ProductionBuildingModal";
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

  const onSelectBuilding = useCallback((row: Record<string, unknown> | null) => {
    setSelectedBuilding(row);
    if (row) setSelected(null);
  }, []);

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

  const markerTypePicker = (
    <div className="rounded border border-sf-border/60 bg-black/20 p-2">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[0.65rem] uppercase tracking-wider text-sf-muted">{t("monitoring.mapMarkerTypes")}</span>
        <button type="button" className="text-[0.65rem] text-sf-cyan hover:underline" onClick={showAllTypes}>
          {t("monitoring.mapResetFilters")}
        </button>
      </div>
      <div className="max-h-36 overflow-y-auto sm:max-h-52">
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {typesPresent.map((typ) => {
            const thumb = thumbClassForMapMarker({ MapMarkerType: typ });
            const on = !hiddenTypes.has(typ);
            return (
              <li key={typ}>
                <button
                  type="button"
                  onClick={() => toggleType(typ)}
                  className={`flex w-full flex-col items-center gap-1 rounded border p-2 text-center transition-colors ${
                    on ? "border-sf-border-bright bg-black/30" : "border-sf-border/40 opacity-50"
                  }`}
                >
                  <ItemThumb className={thumb} label="" size={32} />
                  <span className="font-mono text-[0.6rem] leading-tight text-sf-cream">{typ.replace(/^RT_/, "")}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );

  const infraLayerToggles = (
    <div className="space-y-2 rounded border border-sf-border/60 bg-black/20 p-2">
      <p className="text-[0.65rem] uppercase tracking-wider text-sf-muted">{t("monitoring.mapInfraLayersTitle")}</p>
      <ul className="flex flex-col gap-1.5 text-xs text-sf-cream">
        {(
          [
            ["buildingStorage", "mapLegendStorage"],
            ["buildingPower", "mapLegendPower"],
            ["buildingProduction", "mapLegendProduction"],
            ["cables", "mapLayerCables"],
            ["pipes", "mapLayerPipes"],
            ["belts", "mapLayerBelts"],
          ] as const
        ).map(([key, labelKey]) => (
          <li key={key}>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={layerVis[key]}
                onChange={() => toggleLayer(key)}
                className="rounded border-sf-border"
              />
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-sm ring-1 ring-black/50"
                style={{ backgroundColor: mapInfraToggleCssRgba(key) }}
                aria-hidden
              />
              <span>{t(`monitoring.${labelKey}`)}</span>
            </label>
          </li>
        ))}
      </ul>
      {infraPending ? <p className="text-[0.65rem] text-sf-muted">{t("monitoring.mapInfraLoading")}</p> : null}
      {infraError ? <p className="text-[0.65rem] text-sf-orange">{t("monitoring.mapInfraError")}</p> : null}
    </div>
  );

  const detail = selected ? markerDetailForPopup(selected) : null;

  return (
    <div className={`flex min-h-0 flex-1 flex-col gap-3 lg:flex-row ${className}`}>
      <aside className="order-2 flex max-h-[min(42vh,420px)] w-full shrink-0 flex-col gap-4 overflow-y-auto rounded border border-sf-border/60 bg-black/25 p-3 lg:order-1 lg:max-h-none lg:w-64 lg:shrink-0">
        <p className="text-[0.65rem] leading-snug text-sf-muted">{t("monitoring.mapFrmDeckHint")}</p>
        {infraLayerToggles}
        <div className="space-y-2">
          <p className="text-[0.65rem] uppercase tracking-wider text-sf-muted">{t("monitoring.mapMarkersPanelTitle")}</p>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("monitoring.mapSearchPlaceholder")}
            className="w-full rounded border border-sf-border bg-black/30 px-2 py-1.5 text-xs text-sf-cream outline-none placeholder:text-sf-muted focus:border-sf-orange/60"
          />
        </div>
        {markerTypePicker}
        <p className="text-xs text-sf-muted">{t("monitoring.mapShownCount", { n: filtered.length, total: markers.length })}</p>
      </aside>
      <div className="order-1 flex min-h-[min(48vh,480px)] min-w-0 flex-1 basis-0 flex-col gap-2 lg:order-2">
        <div
          ref={mapWrapRef}
          className="relative flex min-h-[280px] flex-1 basis-0 flex-col overflow-hidden rounded border border-sf-border/50 sm:min-h-[min(48vh,600px)]"
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
      {selectedBuilding ?
        <ProductionBuildingModal
          row={selectedBuilding}
          onClose={() => setSelectedBuilding(null)}
          showMap={false}
          showAdminControls={isAdmin}
        />
      : null}
    </div>
  );
}
