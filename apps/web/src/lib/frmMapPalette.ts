import {
  factoryMapCategoryFromClassName,
  normalizeFrmBuildingClassName,
} from "@/lib/frmFactoryMapCategory";
import { colorSlotToCss } from "@/lib/mapMarkerDisplay";

/** Couleurs distinctes par type de repère carte FRM. */
const MAP_MARKER_TYPE_RGBA: Record<string, [number, number, number, number]> = {
  RT_Default: [156, 163, 175, 255],
  RT_Beacon: [52, 211, 153, 255],
  RT_Crate: [251, 191, 36, 255],
  RT_Hub: [96, 165, 250, 255],
  RT_Ping: [244, 114, 182, 255],
  RT_Player: [167, 139, 250, 255],
  RT_RadarTower: [56, 189, 248, 255],
  RT_Resource: [74, 222, 128, 255],
  RT_SpaceElevator: [248, 113, 113, 255],
  RT_StartingPod: [45, 212, 191, 255],
  RT_Train: [253, 186, 116, 255],
  RT_TrainStation: [253, 164, 175, 255],
  RT_Vehicle: [192, 132, 252, 255],
  RT_VehicleDockingStation: [147, 197, 253, 255],
  RT_DronePort: [125, 211, 252, 255],
  RT_Drone: [216, 180, 254, 255],
  RT_MapMarker: [250, 204, 21, 255],
  RT_Stamp: [163, 230, 53, 255],
  RT_Portal: [34, 211, 238, 255],
  RT_DeathCrate: [248, 113, 113, 255],
  RT_DismantleCrate: [251, 146, 60, 255],
};

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Couleurs carte « Réseau & logistique » : une teinte **fixe** par calque
 * (câbles / tuyaux / convoyeurs / usines), bien séparées visuellement.
 * Le ColorSlot FRM n’est pas utilisé pour ces tracés : il reprend souvent le même gris.
 */
const MAP_ENTITY_FAMILY_RGBA: Record<"cable" | "pipe" | "belt" | "factory", [number, number, number, number]> = {
  /** Lignes électriques — jaune / ambre électrique */
  cable: [253, 224, 71, 248],
  /** Tuyaux — bleu */
  pipe: [59, 130, 246, 248],
  /** Convoyeurs — vert émeraude (loin du jaune des câbles) */
  belt: [52, 211, 153, 248],
  /** Usines — orange */
  factory: [249, 115, 22, 240],
};

/** Couleur opaque affichée sur la carte pour un type d’infra (sans variation par ClassName). */
export function rgbaForMapInfraFamily(family: keyof typeof MAP_ENTITY_FAMILY_RGBA): [number, number, number, number] {
  const c = MAP_ENTITY_FAMILY_RGBA[family];
  return [c[0]!, c[1]!, c[2]!, c[3]!];
}

const FACTORY_MAP_CATEGORY_RGBA: Record<FrmFactoryMapCategory, [number, number, number, number]> = {
  /** Stockage : ambre (proche caisses / conteneurs) */
  storage: [251, 191, 36, 242],
  /** Production d’énergie : vert électrique */
  power: [52, 211, 153, 242],
  /** Autres bâtiments (production, extracteurs, etc.) : orange usine */
  production: [249, 115, 22, 240],
};

export function rgbaForFactoryMapCategory(cat: FrmFactoryMapCategory): [number, number, number, number] {
  const c = FACTORY_MAP_CATEGORY_RGBA[cat];
  return [c[0]!, c[1]!, c[2]!, c[3]!];
}

/** Légende / cases à cocher alignées sur les empreintes bâtiments. */
export function factoryMapCategoryCssRgba(cat: FrmFactoryMapCategory): string {
  const [r, g, b, a] = rgbaForFactoryMapCategory(cat);
  return `rgba(${r}, ${g}, ${b}, ${a / 255})`;
}

/** Valeur CSS `rgba(...)` alignée sur la couche carte (légendes / cases à cocher). */
export function mapInfraFamilyCssRgba(family: keyof typeof MAP_ENTITY_FAMILY_RGBA): string {
  const [r, g, b, a] = rgbaForMapInfraFamily(family);
  return `rgba(${r}, ${g}, ${b}, ${a / 255})`;
}

export type FrmMapInfraToggleKey =
  | "buildingStorage"
  | "buildingPower"
  | "buildingProduction"
  | "cables"
  | "pipes"
  | "belts";

const TOGGLE_TO_FAMILY: Record<"cables" | "pipes" | "belts", keyof typeof MAP_ENTITY_FAMILY_RGBA> = {
  cables: "cable",
  pipes: "pipe",
  belts: "belt",
};

/** Couleur CSS pour une case calque carte (bâtiments par catégorie, câbles, …). */
export function mapInfraToggleCssRgba(key: FrmMapInfraToggleKey): string {
  if (key === "buildingStorage") return factoryMapCategoryCssRgba("storage");
  if (key === "buildingPower") return factoryMapCategoryCssRgba("power");
  if (key === "buildingProduction") return factoryMapCategoryCssRgba("production");
  return mapInfraFamilyCssRgba(TOGGLE_TO_FAMILY[key]);
}

/**
 * Couleur d’une entité linéaire / machine : base lisible par **famille** (comme FRM),
 * légère variation selon `ClassName` pour distinguer deux lignes du même type.
 */
export function rgbaForMapEntity(
  className: string,
  family: "cable" | "pipe" | "belt" | "factory",
): [number, number, number, number] {
  const base = MAP_ENTITY_FAMILY_RGBA[family];
  const spread = (hashString(className || "x") % 5) - 2;
  return [
    Math.min(255, Math.max(0, base[0]! + spread * 8)),
    Math.min(255, Math.max(0, base[1]! + spread * 6)),
    Math.min(255, Math.max(0, base[2]! + spread * 6)),
    base[3]!,
  ];
}

/** Gris FRM par défaut des repères : on utilise la couleur du type à la place. */
function isNeutralFrmSwatch(hex: string): boolean {
  const x = hex.replace("#", "").slice(0, 6).toLowerCase();
  return x === "666667" || x === "999999" || x === "aaaaaa" || x === "cccccc";
}

function cssHexToRgba255(hex: string): [number, number, number, number] {
  const s = hex.replace("#", "").trim();
  const r = parseInt(s.slice(0, 2), 16);
  const g = parseInt(s.slice(2, 4), 16);
  const b = parseInt(s.slice(4, 6), 16);
  return [r, g, b, 255];
}

/** Pastille repère : ColorSlot utile sinon couleur du `MapMarkerType`, sinon teinte machine (`ClassName`). */
export function markerFillFromFrmRow(row: Record<string, unknown>): [number, number, number, number] {
  const slotCss = colorSlotToCss(row.ColorSlot ?? row.colorSlot);
  if (slotCss && !isNeutralFrmSwatch(slotCss)) return cssHexToRgba255(slotCss);
  const typ = String(row.MapMarkerType ?? row.mapMarkerType ?? "");
  if (typ && typ !== "RT_Default") return MAP_MARKER_TYPE_RGBA[typ] ?? MAP_MARKER_TYPE_RGBA.RT_Default;
  const cn = String(row.ClassName ?? row.className ?? "").trim();
  if (cn) {
    const cat = factoryMapCategoryFromClassName(normalizeFrmBuildingClassName(cn));
    return rgbaForFactoryMapCategory(cat);
  }
  return MAP_MARKER_TYPE_RGBA.RT_Default;
}
