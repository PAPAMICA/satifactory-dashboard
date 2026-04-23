import { frmMarkerMapPosition } from "@/lib/frmMapWorld";
import { rgbaForMapInfraFamily } from "@/lib/frmMapPalette";

export type FrmMapLayerVisibility = {
  factories: boolean;
  cables: boolean;
  pipes: boolean;
  belts: boolean;
};

export const defaultFrmMapLayerVisibility = (): FrmMapLayerVisibility => ({
  factories: true,
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
};

/** Empreinte 2D d’une usine (rectangle dimensionné + rotation, comme la carte FRM). */
export type FrmMapFactoryFootprint = {
  id: string;
  /** Polygone fermé dans le repère carte [x, -y]. */
  polygon: [number, number][];
  fill: [number, number, number, number];
  line: [number, number, number, number];
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
    const x = Number(o.x);
    const y = Number(o.y);
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
  const minX = Number(min.x);
  const minY = Number(min.y);
  const maxX = Number(max.x);
  const maxY = Number(max.y);
  if (![minX, minY, maxX, maxY].every(Number.isFinite)) return null;
  if (maxX <= minX || maxY <= minY) return null;
  return { minX, minY, maxX, maxY };
}

function readLocationWorld(row: Record<string, unknown>): { x: number; y: number; rotation: number } | null {
  const loc = (row.location ?? row.Location) as Record<string, unknown> | undefined;
  if (!loc) return null;
  const x = Number(loc.x);
  const y = Number(loc.y);
  const rotation = Number(loc.rotation ?? loc.Rotation ?? 0);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x, y, rotation: Number.isFinite(rotation) ? rotation : 0 };
}

/**
 * Rectangle orienté : centre monde (x,y), demi-tailles depuis la bbox, rotation FRM (0–360°, 0=Nord).
 * Coins dans le repère carte deck : [worldX, -worldY].
 */
function factoryFootprintPolygon(
  cx: number,
  cy: number,
  halfWx: number,
  halfWy: number,
  rotationDeg: number,
): [number, number][] {
  const corners: [number, number][] = [
    [-halfWx, -halfWy],
    [halfWx, -halfWy],
    [halfWx, halfWy],
    [-halfWx, halfWy],
  ];
  // Unreal / Satisfactory : yaw positif autour de Z+ ; en projection XY cela correspond à une rotation horaire
  // vue du dessus pour aligner les bâtiments avec la carte FRM.
  const rad = (-rotationDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const out: [number, number][] = [];
  for (const [dx, dy] of corners) {
    const wx = cx + dx * cos - dy * sin;
    const wy = cy + dx * sin + dy * cos;
    out.push([wx, -wy]);
  }
  return out;
}

function endpointsToPath(
  a: Record<string, unknown> | undefined,
  b: Record<string, unknown> | undefined,
): [number, number][] | null {
  if (!a || !b) return null;
  const x0 = Number(a.x);
  const y0 = Number(a.y);
  const x1 = Number(b.x);
  const y1 = Number(b.y);
  if (!Number.isFinite(x0) || !Number.isFinite(y0) || !Number.isFinite(x1) || !Number.isFinite(y1)) return null;
  return [
    [x0, -y0],
    [x1, -y1],
  ];
}

export function buildFrmMapOverlays(input: {
  factories: Record<string, unknown>[] | undefined;
  cables: Record<string, unknown>[] | undefined;
  pipes: Record<string, unknown>[] | undefined;
  belts: Record<string, unknown>[] | undefined;
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

  for (let i = 0; i < (input.factories ?? []).length; i++) {
    const row = input.factories![i]!;
    const pos = frmMarkerMapPosition(row);
    if (!pos) continue;
    const id = String(row.ID ?? row.Id ?? `fab-${i}`);
    const col = rgbaForMapInfraFamily("factory");
    const line: [number, number, number, number] = [18, 16, 14, 255];
    const bbox2 = readBoundingBox2d(row);
    const loc = readLocationWorld(row);
    if (bbox2 && loc) {
      const halfWx = (bbox2.maxX - bbox2.minX) / 2;
      const halfWy = (bbox2.maxY - bbox2.minY) / 2;
      const poly = factoryFootprintPolygon(loc.x, loc.y, halfWx, halfWy, loc.rotation);
      factoryFootprints.push({ id, polygon: poly, fill: col, line });
    } else {
      factoryPoints.push({ id, position: pos, color: col });
    }
  }

  return { cableSegments, pipePaths, beltPaths, factoryPoints, factoryFootprints };
}

export function overlayWorldBBox(o: FrmMapOverlays, vis: FrmMapLayerVisibility): BBox | null {
  let b: BBox | null = null;
  const bump = (x: number, y: number) => {
    b = b ? expandBBox(b, x, y) : { minX: x, minY: y, maxX: x, maxY: y };
  };

  if (vis.factories) {
    for (const fp of o.factoryFootprints) {
      for (const [x, y] of fp.polygon) bump(x, y);
    }
    for (const p of o.factoryPoints) bump(p.position[0], p.position[1]);
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
