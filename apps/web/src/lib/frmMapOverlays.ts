import {
  factoryMapCategoryFromClassName,
  normalizeFrmBuildingClassName,
  type FrmFactoryMapCategory,
} from "@/lib/frmFactoryMapCategory";
import { frmMarkerMapPosition } from "@/lib/frmMapWorld";
import { rgbaForFactoryMapCategory, rgbaForMapInfraFamily } from "@/lib/frmMapPalette";

export type FrmMapLayerVisibility = {
  buildingStorage: boolean;
  buildingPower: boolean;
  buildingProduction: boolean;
  cables: boolean;
  pipes: boolean;
  belts: boolean;
};

export const defaultFrmMapLayerVisibility = (): FrmMapLayerVisibility => ({
  buildingStorage: true,
  buildingPower: true,
  buildingProduction: true,
  cables: true,
  pipes: true,
  belts: true,
});

export type FrmMapCableSegment = {
  id: string;
  source: [number, number];
  target: [number, number];
  color: [number, number, number, number];
};

export type FrmMapPath = {
  id: string;
  path: [number, number][];
  color: [number, number, number, number];
};

export type FrmMapFactoryPoint = {
  id: string;
  position: [number, number];
  color: [number, number, number, number];
  row: Record<string, unknown>;
  category: FrmFactoryMapCategory;
};

/** Empreinte 2D d’une usine (rectangle dimensionné + rotation, comme la carte FRM). */
export type FrmMapFactoryFootprint = {
  id: string;
  /** Polygone fermé dans le repère carte [x, -y]. */
  polygon: [number, number][];
  fill: [number, number, number, number];
  line: [number, number, number, number];
  row: Record<string, unknown>;
  category: FrmFactoryMapCategory;
};

export type FrmMapOverlays = {
  cableSegments: FrmMapCableSegment[];
  pipePaths: FrmMapPath[];
  beltPaths: FrmMapPath[];
  factoryPoints: FrmMapFactoryPoint[];
  factoryFootprints: FrmMapFactoryFootprint[];
};

export const emptyFrmMapOverlays = (): FrmMapOverlays => ({
  cableSegments: [],
  pipePaths: [],
  beltPaths: [],
  factoryPoints: [],
  factoryFootprints: [],
});

type BBox = { minX: number; minY: number; maxX: number; maxY: number };

function expandBBox(b: BBox, x: number, y: number): BBox {
  return {
    minX: Math.min(b.minX, x),
    minY: Math.min(b.minY, y),
    maxX: Math.max(b.maxX, x),
    maxY: Math.max(b.maxY, y),
  };
}

/** Extrait une couleur primaire FRM (chaîne ou objet ColorSlot). */
export function frmPrimaryHex(colorSlot: unknown): string | null {
  if (colorSlot == null) return null;
  if (typeof colorSlot === "string") {
    const t = colorSlot.replace(/^#/, "").trim();
    if (/^[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/i.test(t)) return `#${t.slice(0, 6)}`;
    return null;
  }
  if (typeof colorSlot === "object") {
    const o = colorSlot as Record<string, unknown>;
    const p = o.PrimaryColor ?? o.primaryColor;
    if (typeof p === "string") return frmPrimaryHex(p);
  }
  return null;
}

function splineToPath(spline: unknown): [number, number][] | null {
  if (!Array.isArray(spline) || spline.length < 2) return null;
  const out: [number, number][] = [];
  for (const pt of spline) {
    if (!pt || typeof pt !== "object") continue;
    const o = pt as Record<string, unknown>;
    const x = Number(o.x ?? o.X);
    const y = Number(o.y ?? o.Y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    out.push([x, -y]);
  }
  return out.length >= 2 ? out : null;
}

function readBoundingBox2d(row: Record<string, unknown>): { minX: number; minY: number; maxX: number; maxY: number } | null {
  const bb = row.BoundingBox ?? row.boundingBox;
  if (!bb || typeof bb !== "object") return null;
  const o = bb as Record<string, unknown>;
  const min = (o.min ?? o.Min) as Record<string, unknown> | undefined;
  const max = (o.max ?? o.Max) as Record<string, unknown> | undefined;
  if (!min || !max) return null;
  const minX = Number(min.x ?? min.X);
  const minY = Number(min.y ?? min.Y);
  const maxX = Number(max.x ?? max.X);
  const maxY = Number(max.y ?? max.Y);
  if (![minX, minY, maxX, maxY].every(Number.isFinite)) return null;
  if (maxX <= minX || maxY <= minY) return null;
  return { minX, minY, maxX, maxY };
}

/**
 * Bbox monde FRM (axes monde) → rectangle sur la carte `[x, −y]` (sans rotation locale).
 * Aligné sur la grille Satisfactory / minimap ; évite les dérives d’orientation du pivot + yaw.
 */
function footprintPolygonWorldAabbToMap(bbox2: { minX: number; minY: number; maxX: number; maxY: number }): [number, number][] {
  return [
    [bbox2.minX, -bbox2.minY],
    [bbox2.maxX, -bbox2.minY],
    [bbox2.maxX, -bbox2.maxY],
    [bbox2.minX, -bbox2.maxY],
  ];
}

function endpointsToPath(
  a: Record<string, unknown> | undefined,
  b: Record<string, unknown> | undefined,
): [number, number][] | null {
  if (!a || !b) return null;
  const x0 = Number(a.x ?? a.X);
  const y0 = Number(a.y ?? a.Y);
  const x1 = Number(b.x ?? b.X);
  const y1 = Number(b.y ?? b.Y);
  if (!Number.isFinite(x0) || !Number.isFinite(y0) || !Number.isFinite(x1) || !Number.isFinite(y1)) return null;
  return [
    [x0, -y0],
    [x1, -y1],
  ];
}

function addBuildingFootprintOrPoint(
  row: Record<string, unknown>,
  category: FrmFactoryMapCategory,
  seenKeys: Set<string>,
  factoryPoints: FrmMapFactoryPoint[],
  factoryFootprints: FrmMapFactoryFootprint[],
  seq: number,
): void {
  const pos = frmMarkerMapPosition(row);
  if (!pos) return;
  const idRaw = String(row.ID ?? row.Id ?? "").trim();
  const dedupeKey = idRaw || `pos:${Math.round(pos[0])}:${Math.round(pos[1])}`;
  if (seenKeys.has(dedupeKey)) return;
  seenKeys.add(dedupeKey);

  const displayId = idRaw || `b-${category}-${seq}`;
  const fill = rgbaForFactoryMapCategory(category);
  const line: [number, number, number, number] = [18, 16, 14, 255];
  const bbox2 = readBoundingBox2d(row);
  if (bbox2) {
    const poly = footprintPolygonWorldAabbToMap(bbox2);
    factoryFootprints.push({ id: displayId, polygon: poly, fill, line, row, category });
  } else {
    factoryPoints.push({ id: displayId, position: pos, color: fill, row, category });
  }
}

export function buildFrmMapOverlays(input: {
  factories: Record<string, unknown>[] | undefined;
  cables: Record<string, unknown>[] | undefined;
  pipes: Record<string, unknown>[] | undefined;
  belts: Record<string, unknown>[] | undefined;
  /** Stockage dédié (souvent absent de `getFactory`). */
  storage?: Record<string, unknown>[] | undefined;
  /** Générateurs (FRM : liste séparée). */
  generators?: Record<string, unknown>[] | undefined;
  /** Pompes pipeline. */
  pumps?: Record<string, unknown>[] | undefined;
  /** Mineurs / extracteurs. */
  extractors?: Record<string, unknown>[] | undefined;
  /** HUB, ascenseur spatial, tours radio, sink bâtiment, etc. */
  specialBuildings?: Record<string, unknown>[] | undefined;
}): FrmMapOverlays {
  const cableSegments: FrmMapCableSegment[] = [];
  const pipePaths: FrmMapPath[] = [];
  const beltPaths: FrmMapPath[] = [];
  const factoryPoints: FrmMapFactoryPoint[] = [];
  const factoryFootprints: FrmMapFactoryFootprint[] = [];

  for (const row of input.cables ?? []) {
    const id = String(row.ID ?? row.Id ?? "");
    const a = (row.location0 ?? row.Location0) as Record<string, unknown> | undefined;
    const b = (row.location1 ?? row.Location1) as Record<string, unknown> | undefined;
    const path = endpointsToPath(a, b);
    if (!path) continue;
    const col = rgbaForMapInfraFamily("cable");
    cableSegments.push({
      id: id || `cable-${cableSegments.length}`,
      source: path[0]!,
      target: path[1]!,
      color: col,
    });
  }

  for (const row of input.pipes ?? []) {
    const id = String(row.ID ?? row.Id ?? "");
    const spline = row.SplineData ?? row.splineData;
    let path = splineToPath(spline);
    if (!path) {
      const a = (row.location0 ?? row.Location0) as Record<string, unknown> | undefined;
      const b = (row.location1 ?? row.Location1) as Record<string, unknown> | undefined;
      path = endpointsToPath(a, b);
    }
    if (!path) continue;
    const col = rgbaForMapInfraFamily("pipe");
    pipePaths.push({ id: id || `pipe-${pipePaths.length}`, path, color: col });
  }

  for (const row of input.belts ?? []) {
    const id = String(row.ID ?? row.Id ?? "");
    const spline = row.SplineData ?? row.splineData;
    let path = splineToPath(spline);
    if (!path) {
      const a = (row.location0 ?? row.Location0) as Record<string, unknown> | undefined;
      const b = (row.location1 ?? row.Location1) as Record<string, unknown> | undefined;
      path = endpointsToPath(a, b);
    }
    if (!path) continue;
    const col = rgbaForMapInfraFamily("belt");
    beltPaths.push({ id: id || `belt-${beltPaths.length}`, path, color: col });
  }

  const seenBuildingKeys = new Set<string>();
  let seq = 0;

  for (let i = 0; i < (input.factories ?? []).length; i++) {
    const row = input.factories![i]!;
    const cn = normalizeFrmBuildingClassName(String(row.ClassName ?? row.className ?? ""));
    const category = factoryMapCategoryFromClassName(cn);
    addBuildingFootprintOrPoint(row, category, seenBuildingKeys, factoryPoints, factoryFootprints, seq++);
  }

  for (let i = 0; i < (input.storage ?? []).length; i++) {
    addBuildingFootprintOrPoint(
      input.storage![i]!,
      "storage",
      seenBuildingKeys,
      factoryPoints,
      factoryFootprints,
      seq++,
    );
  }

  for (let i = 0; i < (input.generators ?? []).length; i++) {
    addBuildingFootprintOrPoint(
      input.generators![i]!,
      "power",
      seenBuildingKeys,
      factoryPoints,
      factoryFootprints,
      seq++,
    );
  }

  for (let i = 0; i < (input.pumps ?? []).length; i++) {
    const row = input.pumps![i]!;
    const cn = normalizeFrmBuildingClassName(String(row.ClassName ?? row.className ?? ""));
    addBuildingFootprintOrPoint(
      row,
      factoryMapCategoryFromClassName(cn),
      seenBuildingKeys,
      factoryPoints,
      factoryFootprints,
      seq++,
    );
  }

  for (let i = 0; i < (input.extractors ?? []).length; i++) {
    const row = input.extractors![i]!;
    const cn = normalizeFrmBuildingClassName(String(row.ClassName ?? row.className ?? ""));
    addBuildingFootprintOrPoint(
      row,
      factoryMapCategoryFromClassName(cn),
      seenBuildingKeys,
      factoryPoints,
      factoryFootprints,
      seq++,
    );
  }

  for (let i = 0; i < (input.specialBuildings ?? []).length; i++) {
    const row = input.specialBuildings![i]!;
    const cn = normalizeFrmBuildingClassName(String(row.ClassName ?? row.className ?? ""));
    addBuildingFootprintOrPoint(
      row,
      factoryMapCategoryFromClassName(cn),
      seenBuildingKeys,
      factoryPoints,
      factoryFootprints,
      seq++,
    );
  }

  return { cableSegments, pipePaths, beltPaths, factoryPoints, factoryFootprints };
}

export function overlayWorldBBox(o: FrmMapOverlays, vis: FrmMapLayerVisibility): BBox | null {
  let b: BBox | null = null;
  const bump = (x: number, y: number) => {
    b = b ? expandBBox(b, x, y) : { minX: x, minY: y, maxX: x, maxY: y };
  };

  const buildingCatVisible = (cat: FrmFactoryMapCategory): boolean => {
    if (cat === "storage") return vis.buildingStorage;
    if (cat === "power") return vis.buildingPower;
    return vis.buildingProduction;
  };
  for (const fp of o.factoryFootprints) {
    if (!buildingCatVisible(fp.category)) continue;
    for (const [x, y] of fp.polygon) bump(x, y);
  }
  for (const p of o.factoryPoints) {
    if (!buildingCatVisible(p.category)) continue;
    bump(p.position[0], p.position[1]);
  }
  if (vis.cables) {
    for (const s of o.cableSegments) {
      bump(s.source[0], s.source[1]);
      bump(s.target[0], s.target[1]);
    }
  }
  if (vis.pipes) {
    for (const p of o.pipePaths) {
      for (const [x, y] of p.path) bump(x, y);
    }
  }
  if (vis.belts) {
    for (const p of o.beltPaths) {
      for (const [x, y] of p.path) bump(x, y);
    }
  }
  return b;
}

export function bboxUnion(a: BBox | null, b: BBox | null): BBox | null {
  if (!a) return b;
  if (!b) return a;
  return {
    minX: Math.min(a.minX, b.minX),
    minY: Math.min(a.minY, b.minY),
    maxX: Math.max(a.maxX, b.maxX),
    maxY: Math.max(a.maxY, b.maxY),
  };
}
