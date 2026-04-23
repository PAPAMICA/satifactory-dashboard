import { markerLocation } from "@/lib/mapMarkerDisplay";

/**
 * Même cadre que l’UI web FRM (BitmapLayer « map », voir FicsitRemoteMonitoring `www/`).
 * Bornes monde : [left, bottom, right, top] = [minX, minY, maxX, maxY].
 */
export const FRM_MAP_BITMAP_BOUNDS: [number, number, number, number] = [
  -324698.16796875, -375000, 425301.83203125, 375000,
];

/** Texture officielle FRM (copie servie depuis `public/map/`). */
export const FRM_MAP_IMAGE_URL = "/map/map.avif";

/** Centre du cadre carte (repère monde). */
export const FRM_MAP_DEFAULT_TARGET: [number, number, number] = [
  (FRM_MAP_BITMAP_BOUNDS[0] + FRM_MAP_BITMAP_BOUNDS[2]) / 2,
  (FRM_MAP_BITMAP_BOUNDS[1] + FRM_MAP_BITMAP_BOUNDS[3]) / 2,
  0,
];

/**
 * Position affichée sur la carte FRM : même convention que leur couche repères
 * (`getPosition: (e) => [e.location.x, -e.location.y]`).
 */
export function frmMarkerMapPosition(r: Record<string, unknown>): [number, number] | null {
  const { x, y } = markerLocation(r);
  const nx = Number(x);
  const ny = Number(y);
  if (!Number.isFinite(nx) || !Number.isFinite(ny)) return null;
  return [nx, -ny];
}
