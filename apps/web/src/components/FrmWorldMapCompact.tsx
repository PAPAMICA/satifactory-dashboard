import { useQuery } from "@tanstack/react-query";
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { DeckGLRef } from "@deck.gl/react";
import { ItemThumb } from "@/components/ItemThumb";
import {
  FrmWorldMapDeck,
  markerDetailForPopup,
  projectMarkerToPixel,
} from "@/components/FrmWorldMapDeck";
import { useOpenBuildingDetail } from "@/contexts/BuildingDetailModalContext";
import { useFrmMapInfrastructure } from "@/hooks/useFrmMapInfrastructure";
import { useFrmMapMarkerFilters } from "@/hooks/useFrmMapMarkerFilters";
import { useFrmRefetchMs } from "@/hooks/useFrmRefetchMs";
import { apiFetch } from "@/lib/api";
import { defaultFrmMapLayerVisibility, type FrmMapLayerVisibility } from "@/lib/frmMapOverlays";
import { frmMarkerMapPosition } from "@/lib/frmMapWorld";
import { mapInfraToggleCssRgba } from "@/lib/frmMapPalette";

export type FrmWorldMapCompactProps = {
  markers: Record<string, unknown>[];
  scrollWheelZoom?: boolean;
  className?: string;
};

/** Carte monde FRM (deck.gl) pour widget dashboard : repères + infra, barre compacte. */
export function FrmWorldMapCompact({
  markers,
  scrollWheelZoom = true,
  className = "",
}: FrmWorldMapCompactProps) {
  const { t } = useTranslation();
  const refetchMs = useFrmRefetchMs();
  const openBuildingDetail = useOpenBuildingDetail();
  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: () => apiFetch<{ isAdmin?: boolean }>("/api/me"),
    staleTime: 60_000,
  });
  const { search, setSearch, hiddenTypes, typesPresent, filtered, fitBoundsKey, toggleType, showAllTypes } =
    useFrmMapMarkerFilters(markers);
  const { overlays, overlayCountKey, isPending: infraPending } = useFrmMapInfrastructure(
    refetchMs !== false,
    refetchMs,
  );
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [layersOpen, setLayersOpen] = useState(false);
  const [layerVis, setLayerVis] = useState<FrmMapLayerVisibility>(() => defaultFrmMapLayerVisibility());
  const [selectedMarker, setSelectedMarker] = useState<Record<string, unknown> | null>(null);
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

  const selectedMarkerId = selectedMarker ? String(selectedMarker.ID ?? selectedMarker.Id ?? "") : null;
  const selectedBuildingId = selectedBuilding ? String(selectedBuilding.ID ?? selectedBuilding.Id ?? "") : null;

  const bumpProj = useCallback(() => {
    setProjTick((n) => n + 1);
  }, []);

  const onSelectMarker = useCallback((row: Record<string, unknown> | null) => {
    setSelectedMarker(row);
    if (row) setSelectedBuilding(null);
  }, []);

  const onSelectBuilding = useCallback(
    (row: Record<string, unknown> | null) => {
      setSelectedBuilding(row);
      if (row) {
        setSelectedMarker(null);
        openBuildingDetail(row, {
          showMap: false,
          showAdminControls: Boolean(me?.isAdmin),
          onClosed: () => setSelectedBuilding(null),
        });
      }
    },
    [me?.isAdmin, openBuildingDetail],
  );

  useLayoutEffect(() => {
    bumpProj();
  }, [selectedMarker, selectedBuilding, fitBoundsKey, mapAutoFitToken, bumpProj]);

  useLayoutEffect(() => {
    const el = mapWrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => bumpProj());
    ro.observe(el);
    return () => ro.disconnect();
  }, [bumpProj]);

  const selectedPos = useMemo(() => (selectedMarker ? frmMarkerMapPosition(selectedMarker) : null), [selectedMarker]);

  const popupPixel = useMemo(() => {
    if (!selectedPos) return null;
    const deck = deckRef.current?.deck;
    return projectMarkerToPixel(deck, selectedPos);
  }, [selectedPos, projTick]);

  const toggleLayer = (k: keyof FrmMapLayerVisibility) => {
    setLayerVis((v) => ({ ...v, [k]: !v[k] }));
  };

  const detail = selectedMarker ? markerDetailForPopup(selectedMarker) : null;

  return (
    <div className={`flex min-h-0 flex-1 flex-col gap-2 ${className}`}>
      <div className="flex shrink-0 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("monitoring.mapSearchPlaceholder")}
            className="min-w-[100px] flex-1 rounded border border-sf-border bg-black/30 px-2 py-1.5 text-xs text-sf-cream outline-none placeholder:text-sf-muted focus:border-sf-orange/60 sm:max-w-xs"
          />
          <button type="button" className="sf-btn shrink-0 text-xs" onClick={() => setLayersOpen((o) => !o)}>
            {t("monitoring.mapInfraLayersShort")}
          </button>
          <button type="button" className="sf-btn shrink-0 text-xs" onClick={() => setFiltersOpen((o) => !o)}>
            {t("monitoring.mapFiltersToggle")}
          </button>
          <span className="text-xs text-sf-muted">{t("monitoring.mapShownCount", { n: filtered.length, total: markers.length })}</span>
        </div>
        {layersOpen ? (
          <div className="flex flex-wrap gap-2 rounded border border-sf-border/50 bg-black/20 p-2 text-[0.65rem] text-sf-cream">
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
              <label key={key} className="flex cursor-pointer items-center gap-1.5">
                <input type="checkbox" checked={layerVis[key]} onChange={() => toggleLayer(key)} className="rounded" />
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-sm ring-1 ring-black/50"
                  style={{ backgroundColor: mapInfraToggleCssRgba(key) }}
                  aria-hidden
                />
                <span>{t(`monitoring.${labelKey}`)}</span>
              </label>
            ))}
            {infraPending ? <span className="w-full text-sf-muted">{t("monitoring.mapInfraLoading")}</span> : null}
          </div>
        ) : null}
        {filtersOpen ? (
          <div className="max-h-32 overflow-y-auto rounded border border-sf-border/50 bg-black/20 p-2">
            <div className="mb-1 flex justify-end">
              <button type="button" className="text-[0.6rem] text-sf-cyan hover:underline" onClick={showAllTypes}>
                {t("monitoring.mapResetFilters")}
              </button>
            </div>
            <ul className="grid grid-cols-2 gap-1 sm:grid-cols-3">
              {typesPresent.map((typ) => {
                const on = !hiddenTypes.has(typ);
                return (
                  <li key={typ}>
                    <button
                      type="button"
                      onClick={() => toggleType(typ)}
                      className={`w-full rounded border px-1 py-0.5 font-mono text-[0.55rem] ${
                        on ? "border-sf-border-bright bg-black/30" : "border-sf-border/40 opacity-50"
                      }`}
                    >
                      {typ.replace(/^RT_/, "")}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
      </div>
      <div ref={mapWrapRef} className="relative flex min-h-[min(32vh,240px)] min-w-0 flex-1 basis-0 flex-col ">
        <FrmWorldMapDeck
          deckRef={deckRef}
          onDeckLoad={bumpProj}
          onAfterViewStateChange={bumpProj}
          markers={filtered}
          autoFitToken={mapAutoFitToken}
          worldOverlays={overlays}
          layerVisibility={layerVis}
          scrollWheelZoom={scrollWheelZoom}
          selectedId={selectedMarkerId}
          selectedBuildingId={selectedBuildingId}
          onSelectMarker={onSelectMarker}
          onSelectBuilding={onSelectBuilding}
          className="min-h-0 flex-1"
        />
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
              onClick={() => setSelectedMarker(null)}
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
  );
}
