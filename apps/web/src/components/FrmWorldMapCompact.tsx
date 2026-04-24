import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { FrmWorldMapDeck } from "@/components/FrmWorldMapDeck";
import { useFrmMapInfrastructure } from "@/hooks/useFrmMapInfrastructure";
import { useFrmMapMarkerFilters } from "@/hooks/useFrmMapMarkerFilters";
import { useFrmRefetchMs } from "@/hooks/useFrmRefetchMs";
import { defaultFrmMapLayerVisibility, type FrmMapLayerVisibility } from "@/lib/frmMapOverlays";
import { factoryMapCategoryCssRgba, mapInfraToggleCssRgba } from "@/lib/frmMapPalette";

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
  const { search, setSearch, hiddenTypes, typesPresent, filtered, fitBoundsKey, toggleType, showAllTypes } =
    useFrmMapMarkerFilters(markers);
  const { overlays, overlayCountKey, isPending: infraPending } = useFrmMapInfrastructure(
    refetchMs !== false,
    refetchMs,
  );
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [layersOpen, setLayersOpen] = useState(false);
  const [layerVis, setLayerVis] = useState<FrmMapLayerVisibility>(() => defaultFrmMapLayerVisibility());

  const layerVisKey = useMemo(
    () => `${layerVis.factories ? 1 : 0}${layerVis.cables ? 1 : 0}${layerVis.pipes ? 1 : 0}${layerVis.belts ? 1 : 0}`,
    [layerVis],
  );

  const mapAutoFitToken = useMemo(
    () => `${fitBoundsKey}|${overlayCountKey}|${layerVisKey}`,
    [fitBoundsKey, overlayCountKey, layerVisKey],
  );

  const toggleLayer = (k: keyof FrmMapLayerVisibility) => {
    setLayerVis((v) => ({ ...v, [k]: !v[k] }));
  };

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
                ["factories", "mapLayerFactories"],
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
            <div className="w-full border-t border-sf-border/40 pt-2">
              <span className="text-sf-muted">{t("monitoring.mapBuildingColorsTitle")}:</span>{" "}
              {(
                [
                  ["storage", "mapLegendStorage"],
                  ["power", "mapLegendPower"],
                  ["production", "mapLegendProduction"],
                ] as const
              ).map(([cat, labelKey], i) => (
                <span key={cat} className="inline-flex items-center gap-0.5">
                  {i > 0 ? <span className="text-sf-muted"> · </span> : null}
                  <span
                    className="inline-block h-2 w-2 shrink-0 rounded-sm align-middle ring-1 ring-black/50"
                    style={{ backgroundColor: factoryMapCategoryCssRgba(cat) }}
                    aria-hidden
                  />
                  <span className="text-sf-muted">{t(`monitoring.${labelKey}`)}</span>
                </span>
              ))}
            </div>
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
      <div className="relative flex min-h-[min(32vh,240px)] min-w-0 flex-1 basis-0 flex-col overflow-hidden">
        <FrmWorldMapDeck
          markers={filtered}
          autoFitToken={mapAutoFitToken}
          worldOverlays={overlays}
          layerVisibility={layerVis}
          scrollWheelZoom={scrollWheelZoom}
          selectedId={null}
          onSelectMarker={() => {}}
          className="min-h-0 flex-1"
        />
      </div>
    </div>
  );
}
