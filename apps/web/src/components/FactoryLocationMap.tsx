import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { FrmWorldMapDeck } from "@/components/FrmWorldMapDeck";
import { ItemThumb } from "@/components/ItemThumb";
import { frmMarkerMapPosition } from "@/lib/frmMapWorld";
import { colorSlotToCss, markerLocation, thumbClassForMapMarker } from "@/lib/mapMarkerDisplay";

/**
 * Carte d’une usine (modal production) : même système que la page Carte FRM (deck.gl + `map.avif`).
 */
export function FactoryLocationMap({
  row,
  title,
  className = "",
  fillParent,
}: {
  row: Record<string, unknown>;
  title: string;
  className?: string;
  /** Remplit le conteneur parent (ex. carré à droite de la modale). */
  fillParent?: boolean;
}) {
  const { t } = useTranslation();

  const mapRow = useMemo(() => {
    const id = String(row.ID ?? row.Id ?? "factory-loc");
    return { ...row, ID: id, Name: title };
  }, [row, title]);

  const pos = useMemo(() => frmMarkerMapPosition(mapRow), [mapRow]);

  const containerClass = fillParent
    ? `relative flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden rounded border border-sf-border/50 ${className}`
    : `relative overflow-hidden rounded border border-sf-border/50 ${className}`;

  const mapWrapClass = fillParent
    ? "relative flex min-h-[220px] flex-1 basis-0 flex-col overflow-hidden"
    : "relative flex h-[min(40vh,320px)] min-h-[220px] flex-col overflow-hidden";

  if (!pos) {
    return (
      <div
        className={`flex min-h-[200px] items-center justify-center rounded border border-sf-border/50 bg-black/20 text-sm text-sf-muted ${className}`}
      >
        {t("monitoring.productionNoLocation")}
      </div>
    );
  }

  const color = colorSlotToCss(row.ColorSlot ?? row.colorSlot) ?? "#f59e0b";
  const { x, y, z } = markerLocation(row);
  const thumb = thumbClassForMapMarker(row);
  const fitKey = String(mapRow.ID ?? "loc");

  return (
    <div className={containerClass}>
      <div className={mapWrapClass}>
        <FrmWorldMapDeck
          markers={[mapRow]}
          autoFitToken={fitKey}
          selectedId={null}
          onSelectMarker={() => {}}
          scrollWheelZoom
          className={fillParent ? "min-h-0 flex-1" : "min-h-[200px] flex-1"}
        />
      </div>
      <div className="pointer-events-none absolute bottom-2 left-2 right-2 flex items-end justify-start">
        <div className="pointer-events-auto max-w-[min(100%,280px)] rounded border border-sf-border-bright bg-[#1a1814]/95 p-2 shadow-md backdrop-blur-sm">
          <div className="flex gap-2">
            <ItemThumb className={thumb} label="" size={32} />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold leading-tight text-sf-cream">{title}</p>
              <p className="mt-0.5 font-mono text-[0.6rem] text-sf-muted">
                {Number.isFinite(Number(x)) ? Math.round(Number(x)) : "—"},{" "}
                {Number.isFinite(Number(y)) ? Math.round(Number(y)) : "—"},{" "}
                {Number.isFinite(Number(z)) ? Math.round(Number(z)) : "—"}
              </p>
              <span className="mt-1 inline-block h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
