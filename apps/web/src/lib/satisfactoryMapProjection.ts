/**
 * Projection « faux Web Mercator » alignée sur les tuiles Satisfactory Calculator
 * (voir featheredtoast/satisfactory-monitoring MapProjections.md).
 * Coordonnées jeu = champs FRM `location.x` / `location.y` (unités internes).
 */
export function gameXYToLatLng(x: number, y: number): [number, number] | null {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  const lng = (x + 324_600) * 0.00024004 - 157.54585;
  const lat = (y + 375_000) * -0.00013951 + 92.66079;
  return [lat, lng];
}

/** Vue par défaut (monde) quand aucun repère n’est affiché. */
export const DEFAULT_MAP_CENTER: [number, number] = [40.34, -79.58];
/** Zoom minimal : les tuiles SC `EarlyAccess` n’existent pas en dessous de z≈3. */
export const SC_MAP_MIN_ZOOM = 3;
export const SC_MAP_MAX_ZOOM = 7;
export const DEFAULT_MAP_ZOOM = SC_MAP_MIN_ZOOM;

/**
 * Bornes Leaflet [[sud-ouest lat,lng], [nord-est lat,lng]].
 * MapProjections.md donne deux coins en **longitude, latitude** (ordre GIS) :
 * (-157.54585, 82.66079) et (22.45923, -21.97246).
 */
export const SC_MAP_ISLAND_IMAGE_BOUNDS: [[number, number], [number, number]] = [
  [-21.97246, -157.54585],
  [82.66079, 22.45923],
];

/** Texture 1024² (zoom faible / économie bande passante). */
export const SC_MAP_ISLAND_IMAGE_URL = "/map/island-satellite.png";
/** Texture 2048² pour zooms élevés (plus net à l’écran). Générée à partir de la même source. */
export const SC_MAP_ISLAND_IMAGE_URL_HIDPI = "/map/island-satellite-2k.png";
/** Niveau de zoom Leaflet à partir duquel charger `…-2k.png`. */
export const SC_MAP_ISLAND_HIDPI_FROM_ZOOM = 5;

export type ScMapRasterLayerId = "gameLayer" | "realisticLayer";

const SC_TILE_VERSION = "1671697795";

export function scMapTileUrl(layer: ScMapRasterLayerId): string {
  return `https://static.satisfactory-calculator.com/imgMap/${layer}/EarlyAccess/{z}/{x}/{y}.png?v=${SC_TILE_VERSION}`;
}

/** @deprecated Utiliser `scMapTileUrl("gameLayer")`. */
export const SC_MAP_TILE_URL = scMapTileUrl("gameLayer");
