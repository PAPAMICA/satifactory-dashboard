import { BitmapLayer, LineLayer, PathLayer, PolygonLayer, ScatterplotLayer } from "@deck.gl/layers";
import { COORDINATE_SYSTEM, OrthographicView, type ViewStateChangeParameters } from "@deck.gl/core";
import DeckGL, { type DeckGLRef } from "@deck.gl/react";
import { useCallback, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import { useTranslation } from "react-i18next";
import type { FrmFactoryMapCategory } from "@/lib/frmFactoryMapCategory";
import { markerLocation, thumbClassForMapMarker } from "@/lib/mapMarkerDisplay";
import { markerFillFromFrmRow } from "@/lib/frmMapPalette";
import {
  bboxUnion,
  defaultFrmMapLayerVisibility,
  overlayWorldBBox,
  type FrmMapLayerVisibility,
  type FrmMapCableSegment,
  type FrmMapFactoryFootprint,
  type FrmMapFactoryPoint,
  type FrmMapOverlays,
  type FrmMapPath,
} from "@/lib/frmMapOverlays";
import {
  FRM_MAP_BITMAP_BOUNDS,
  FRM_MAP_DEFAULT_TARGET,
  FRM_MAP_IMAGE_URL,
  frmMarkerMapPosition,
} from "@/lib/frmMapWorld";

const VIEW_ID = "frm-map";

type PlotDatum = {
  id: string;
  row: Record<string, unknown>;
  position: [number, number];
  fill: [number, number, number, number];
  name: string;
  typ: string;
};

function filterBuildingLayer<T extends { category: FrmFactoryMapCategory }>(
  data: T[],
  vis: FrmMapLayerVisibility,
): T[] {
  return data.filter((d) => {
    if (d.category === "storage") return vis.buildingStorage;
    if (d.category === "power") return vis.buildingPower;
    return vis.buildingProduction;
  });
}

function isPlotDatum(o: unknown): o is PlotDatum {
  return Boolean(o && typeof o === "object" && "typ" in o && "row" in o);
}

function isMapBuildingPick(o: unknown): o is FrmMapFactoryFootprint | FrmMapFactoryPoint {
  return Boolean(
    o &&
      typeof o === "object" &&
      "row" in o &&
      "category" in o &&
      ("polygon" in o || ("position" in o && "color" in o)),
  );
}

type BBox = { minX: number; minY: number; maxX: number; maxY: number };

function bboxFromMarkers(markers: Record<string, unknown>[]): BBox | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const r of markers) {
    const p = frmMarkerMapPosition(r);
    if (!p) continue;
    const [mx, my] = p;
    minX = Math.min(minX, mx);
    minY = Math.min(minY, my);
    maxX = Math.max(maxX, mx);
    maxY = Math.max(maxY, my);
  }
  if (!Number.isFinite(minX)) return null;
  return { minX, minY, maxX, maxY };
}

function padBBox(b: BBox, pad: number): BBox {
  const dx = (b.maxX - b.minX) * pad;
  const dy = (b.maxY - b.minY) * pad;
  return {
    minX: b.minX - dx,
    minY: b.minY - dy,
    maxX: b.maxX + dx,
    maxY: b.maxY + dy,
  };
}

function ensureMinSpan(b: BBox, minSpan: number): BBox {
  let w = b.maxX - b.minX;
  let h = b.maxY - b.minY;
  if (w >= minSpan && h >= minSpan) return b;
  const cx = (b.minX + b.maxX) / 2;
  const cy = (b.minY + b.maxY) / 2;
  w = Math.max(w, minSpan);
  h = Math.max(h, minSpan);
  return {
    minX: cx - w / 2,
    maxX: cx + w / 2,
    minY: cy - h / 2,
    maxY: cy + h / 2,
  };
}

function viewStateForBbox(width: number, height: number, b: BBox) {
  const bb = ensureMinSpan(padBBox(b, 0.08), 12_000);
  const bw = Math.max(bb.maxX - bb.minX, 1);
  const bh = Math.max(bb.maxY - bb.minY, 1);
  const zoom = Math.log2(Math.min((width * 0.92) / bw, (height * 0.92) / bh));
  const z = Math.min(6, Math.max(-14, zoom));
  return {
    [VIEW_ID]: {
      target: [(bb.minX + bb.maxX) / 2, (bb.minY + bb.maxY) / 2, 0] as [number, number, number],
      zoom: z,
      minZoom: -14,
      maxZoom: 8,
    },
  };
}

const defaultViewState = () => ({
  [VIEW_ID]: {
    target: [...FRM_MAP_DEFAULT_TARGET] as [number, number, number],
    zoom: -10,
    minZoom: -14,
    maxZoom: 8,
  },
});

export type FrmWorldMapDeckProps = {
  markers: Record<string, unknown>[];
  /** Quand ce jeton change, recadrage automatique (filtres, nombre d’entités infra, calques). Pas à chaque refetch. */
  autoFitToken: string;
  scrollWheelZoom?: boolean;
  className?: string;
  selectedId: string | null;
  onSelectMarker: (row: Record<string, unknown> | null) => void;
  /** Sélection empreinte / point bâtiment (carte monde). */
  selectedBuildingId?: string | null;
  onSelectBuilding?: (row: Record<string, unknown> | null) => void;
  deckRef?: RefObject<DeckGLRef | null>;
  onAfterViewStateChange?: () => void;
  onDeckLoad?: () => void;
  worldOverlays?: FrmMapOverlays | null;
  layerVisibility?: Partial<FrmMapLayerVisibility>;
};

export function FrmWorldMapDeck({
  markers,
  autoFitToken,
  scrollWheelZoom = true,
  className = "",
  selectedId,
  onSelectMarker,
  selectedBuildingId = null,
  onSelectBuilding,
  deckRef,
  onAfterViewStateChange,
  onDeckLoad,
  worldOverlays,
  layerVisibility: layerVisibilityProp,
}: FrmWorldMapDeckProps) {
  const { t } = useTranslation();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [viewState, setViewState] = useState(() => defaultViewState());
  const [deckSize, setDeckSize] = useState({ w: 0, h: 0 });

  const vis = useMemo(
    () => ({ ...defaultFrmMapLayerVisibility(), ...layerVisibilityProp }),
    [layerVisibilityProp],
  );

  const markersRef = useRef(markers);
  markersRef.current = markers;
  const overlaysRef = useRef(worldOverlays);
  overlaysRef.current = worldOverlays;
  const visRef = useRef(vis);
  visRef.current = vis;
  const lastAutoFitTokenRef = useRef<string | null>(null);
  const userAdjustedViewRef = useRef(false);
  const programmaticViewRef = useRef(false);
  const prevDeckSizeRef = useRef({ w: 0, h: 0 });

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      const w = Math.floor(r.width);
      const h = Math.floor(r.height);
      if (w > 0 && h > 0) {
        setDeckSize((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
      }
    };
    measure();
    const a = requestAnimationFrame(() => measure());
    const ro = new ResizeObserver(() => measure());
    ro.observe(el);
    return () => {
      cancelAnimationFrame(a);
      ro.disconnect();
    };
  }, []);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const w = Math.floor(el.getBoundingClientRect().width);
    const h = Math.floor(el.getBoundingClientRect().height);
    if (w < 4 || h < 4) return;

    const tokenChanged = lastAutoFitTokenRef.current !== autoFitToken;
    const deckBecameReady = prevDeckSizeRef.current.w < 4 && w >= 4;
    prevDeckSizeRef.current = { w, h };

    if (tokenChanged) {
      lastAutoFitTokenRef.current = autoFitToken;
      userAdjustedViewRef.current = false;
    }
    if (!tokenChanged && !deckBecameReady && userAdjustedViewRef.current) return;

    const mk = markersRef.current;
    const ov = overlaysRef.current;
    const v = visRef.current;
    let bb = bboxFromMarkers(mk);
    if (ov) {
      const ob = overlayWorldBBox(ov, v);
      bb = bboxUnion(bb, ob);
    }
    programmaticViewRef.current = true;
    setViewState(bb ? viewStateForBbox(w, h, bb) : defaultViewState());
    requestAnimationFrame(() => {
      programmaticViewRef.current = false;
    });
  }, [autoFitToken, deckSize.w, deckSize.h]);

  const view = useMemo(
    () =>
      new OrthographicView({
        id: VIEW_ID,
        flipY: false,
        controller: {
          dragRotate: false,
          scrollZoom: scrollWheelZoom,
        },
      }),
    [scrollWheelZoom],
  );

  const plotData: PlotDatum[] = useMemo(() => {
    const out: PlotDatum[] = [];
    for (let i = 0; i < markers.length; i++) {
      const row = markers[i]!;
      const pos = frmMarkerMapPosition(row);
      if (!pos) continue;
      const fill = markerFillFromFrmRow(row);
      const id = String(row.ID ?? row.Id ?? `i${i}`);
      out.push({
        id,
        row,
        position: pos,
        fill,
        name: String(row.Name ?? row.name ?? "—"),
        typ: String(row.MapMarkerType ?? row.mapMarkerType ?? row.ClassName ?? row.className ?? "—"),
      });
    }
    return out;
  }, [markers]);

  const layers = useMemo(() => {
    const o = worldOverlays;
    const beltData = vis.belts && o?.beltPaths.length ? o.beltPaths : [];
    const pipeData = vis.pipes && o?.pipePaths.length ? o.pipePaths : [];
    const cableData = vis.cables && o?.cableSegments.length ? o.cableSegments : [];
    const facFootSrc = o?.factoryFootprints.length ? o.factoryFootprints : [];
    const facPointSrc = o?.factoryPoints.length ? o.factoryPoints : [];
    const facFootData = filterBuildingLayer(facFootSrc, vis);
    const facData = filterBuildingLayer(facPointSrc, vis);

    const ls = [
      new BitmapLayer({
        id: "frm-map-base",
        image: FRM_MAP_IMAGE_URL,
        bounds: FRM_MAP_BITMAP_BOUNDS,
        coordinateSystem: COORDINATE_SYSTEM.CARTESIAN,
      }),
    ];

    if (pipeData.length) {
      ls.push(
        new PathLayer<FrmMapPath>({
          id: "frm-pipes",
          data: pipeData,
          coordinateSystem: COORDINATE_SYSTEM.CARTESIAN,
          pickable: false,
          widthUnits: "pixels",
          getPath: (d) => d.path,
          getColor: (d) => d.color,
          getWidth: 5,
          capRounded: true,
          jointRounded: true,
        }),
      );
    }
    if (beltData.length) {
      ls.push(
        new PathLayer<FrmMapPath>({
          id: "frm-belts",
          data: beltData,
          coordinateSystem: COORDINATE_SYSTEM.CARTESIAN,
          pickable: false,
          widthUnits: "pixels",
          getPath: (d) => d.path,
          getColor: (d) => d.color,
          getWidth: 2.5,
          capRounded: true,
          jointRounded: true,
        }),
      );
    }
    if (cableData.length) {
      ls.push(
        new LineLayer<FrmMapCableSegment>({
          id: "frm-cables",
          data: cableData,
          coordinateSystem: COORDINATE_SYSTEM.CARTESIAN,
          pickable: false,
          getSourcePosition: (d) => d.source,
          getTargetPosition: (d) => d.target,
          getColor: (d) => d.color,
          getWidth: 1.25,
          widthUnits: "pixels",
        }),
      );
    }
    if (facFootData.length) {
      ls.push(
        new PolygonLayer<FrmMapFactoryFootprint>({
          id: "frm-factory-footprints",
          data: facFootData,
          coordinateSystem: COORDINATE_SYSTEM.CARTESIAN,
          pickable: Boolean(onSelectBuilding),
          filled: true,
          extruded: false,
          stroked: true,
          lineWidthUnits: "pixels",
          getPolygon: (d) => d.polygon,
          getFillColor: (d) => d.fill,
          getLineColor: (d) => d.line,
          getLineWidth: (d) => (d.id === selectedBuildingId ? 2.5 : 1),
          updateTriggers: { getLineWidth: [selectedBuildingId] },
        }),
      );
    }
    if (facData.length) {
      ls.push(
        new ScatterplotLayer<FrmMapFactoryPoint>({
          id: "frm-factories",
          data: facData,
          coordinateSystem: COORDINATE_SYSTEM.CARTESIAN,
          pickable: Boolean(onSelectBuilding),
          radiusUnits: "pixels",
          getPosition: (d) => d.position,
          getRadius: (d) => (d.id === selectedBuildingId ? 7 : 4),
          getFillColor: (d) => d.color,
          stroked: false,
          updateTriggers: { getRadius: [selectedBuildingId] },
        }),
      );
    }

    ls.push(
      new ScatterplotLayer<PlotDatum>({
        id: "frm-markers",
        data: plotData,
        coordinateSystem: COORDINATE_SYSTEM.CARTESIAN,
        pickable: true,
        radiusUnits: "pixels",
        getPosition: (d) => d.position,
        getRadius: (d) => (d.id === selectedId ? 11 : 7),
        getFillColor: (d) => d.fill,
        getLineColor: [26, 24, 20, 255],
        getLineWidth: (d) => (d.id === selectedId ? 3 : 1),
        lineWidthUnits: "pixels",
        stroked: true,
        filled: true,
      }),
    );

    return ls;
  }, [plotData, selectedId, selectedBuildingId, worldOverlays, vis, onSelectBuilding]);

  const onViewStateChange = useCallback(
    (params: ViewStateChangeParameters<Record<string, unknown>>) => {
      const { viewState: vs, interactionState: i } = params;
      if (!programmaticViewRef.current) {
        if (i.isDragging || i.isPanning || i.isZooming) userAdjustedViewRef.current = true;
      }
      setViewState(vs as typeof viewState);
      onAfterViewStateChange?.();
    },
    [onAfterViewStateChange],
  );

  const onClick = useCallback(
    (info: { object?: unknown }) => {
      const o = info.object;
      if (isPlotDatum(o)) {
        onSelectMarker(o.row);
        onSelectBuilding?.(null);
        return;
      }
      if (isMapBuildingPick(o)) {
        onSelectBuilding?.(o.row);
        onSelectMarker(null);
        return;
      }
      onSelectMarker(null);
      onSelectBuilding?.(null);
    },
    [onSelectMarker, onSelectBuilding],
  );

  const handleDeckLoad = useCallback(() => {
    onDeckLoad?.();
  }, [onDeckLoad]);

  const deckReady = deckSize.w >= 4 && deckSize.h >= 4;

  return (
    <div
      ref={wrapRef}
      className={`relative min-h-[200px] h-full w-full min-w-0 flex-1  bg-[#0a0c10] ${className}`}
    >
      {deckReady ? (
        <DeckGL
          ref={deckRef}
          width={deckSize.w}
          height={deckSize.h}
          views={view}
          viewState={viewState}
          onViewStateChange={onViewStateChange}
          onLoad={handleDeckLoad}
          controller
          layers={layers}
          onClick={onClick}
          getTooltip={({ object }) => {
            const o = object;
            if (isPlotDatum(o)) {
              return { text: `${o.name}\n${o.typ.replace(/^RT_/, "")}` };
            }
            if (isMapBuildingPick(o)) {
              const r = o.row;
              const nm = String(r.Name ?? r.name ?? "—");
              const cn = String(r.ClassName ?? r.className ?? "").trim();
              return { text: cn ? `${nm}\n${cn}` : nm };
            }
            return null;
          }}
          style={{ position: "absolute", left: 0, top: 0, background: "#0a0c10" }}
        />
      ) : (
        <div className="flex h-[min(100%,320px)] min-h-[200px] w-full items-center justify-center text-xs text-sf-muted">
          {t("common.loading")}
        </div>
      )}
    </div>
  );
}

export function projectMarkerToPixel(
  deck: { getViewports: () => { project: (p: number[]) => number[] }[] } | null | undefined,
  position: [number, number],
): [number, number] | null {
  if (!deck) return null;
  const vp = deck.getViewports()[0];
  if (!vp) return null;
  const xy = vp.project([position[0], position[1], 0]);
  if (!xy || xy.length < 2 || !Number.isFinite(xy[0]) || !Number.isFinite(xy[1])) return null;
  return [xy[0], xy[1]];
}

export function markerDetailForPopup(r: Record<string, unknown>) {
  const { x, y, z } = markerLocation(r);
  const thumb = thumbClassForMapMarker(r);
  const nm = String(r.Name ?? r.name ?? "—");
  const typ = String(r.MapMarkerType ?? r.mapMarkerType ?? r.ClassName ?? r.className ?? "—");
  return { x, y, z, thumb, nm, typ };
}
