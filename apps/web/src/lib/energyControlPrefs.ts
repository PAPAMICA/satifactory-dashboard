const LS_KEY = "sf_energy_control_prefs_v1";

export type FavoriteBuildingGroup = {
  id: string;
  name: string;
  /** Classe Satisfactory pour `ItemThumb` / PNG catalogue. */
  thumbClass: string;
  memberBuildingIds: string[];
};

export type EnergyControlPrefs = {
  favoriteSwitchIds: string[];
  favoriteBuildingIds: string[];
  favoriteBuildingGroups: FavoriteBuildingGroup[];
  switchAliases: Record<string, string>;
  buildingAliases: Record<string, string>;
};

const EV = "sf-energy-prefs-changed";

/** Dernière chaîne lue dans localStorage — pour un snapshot stable avec `useSyncExternalStore`. */
let cachedLsRaw: string | null = null;
let cachedSnapshot: EnergyControlPrefs = {
  favoriteSwitchIds: [],
  favoriteBuildingIds: [],
  favoriteBuildingGroups: [],
  switchAliases: {},
  buildingAliases: {},
};

function defaultPrefs(): EnergyControlPrefs {
  return {
    favoriteSwitchIds: [],
    favoriteBuildingIds: [],
    favoriteBuildingGroups: [],
    switchAliases: {},
    buildingAliases: {},
  };
}

function parseFavoriteGroup(raw: unknown): FavoriteBuildingGroup | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = String(o.id ?? "").trim();
  const name = String(o.name ?? "").trim();
  const thumbClass = String(o.thumbClass ?? "Build_ManufacturerMk1_C").trim() || "Build_ManufacturerMk1_C";
  const memberBuildingIds = Array.isArray(o.memberBuildingIds) ? [...new Set(o.memberBuildingIds.map(String))] : [];
  if (!id || !name) return null;
  return { id, name, thumbClass, memberBuildingIds };
}

function normalizePrefs(o: Partial<EnergyControlPrefs>): EnergyControlPrefs {
  const groupsRaw = Array.isArray(o.favoriteBuildingGroups) ? o.favoriteBuildingGroups : [];
  const favoriteBuildingGroups = groupsRaw.map(parseFavoriteGroup).filter(Boolean) as FavoriteBuildingGroup[];
  return {
    favoriteSwitchIds: Array.isArray(o.favoriteSwitchIds) ? o.favoriteSwitchIds.map(String) : [],
    favoriteBuildingIds: Array.isArray(o.favoriteBuildingIds) ? o.favoriteBuildingIds.map(String) : [],
    favoriteBuildingGroups,
    switchAliases: o.switchAliases && typeof o.switchAliases === "object" ? { ...o.switchAliases } : {},
    buildingAliases: o.buildingAliases && typeof o.buildingAliases === "object" ? { ...o.buildingAliases } : {},
  };
}

export function readEnergyControlPrefs(): EnergyControlPrefs {
  try {
    const raw = localStorage.getItem(LS_KEY) ?? "";
    if (raw === cachedLsRaw) return cachedSnapshot;
    cachedLsRaw = raw;
    if (!raw) {
      cachedSnapshot = defaultPrefs();
      return cachedSnapshot;
    }
    const o = JSON.parse(raw) as Partial<EnergyControlPrefs>;
    cachedSnapshot = normalizePrefs(o);
    return cachedSnapshot;
  } catch {
    cachedSnapshot = defaultPrefs();
    return cachedSnapshot;
  }
}

function writePrefs(p: EnergyControlPrefs): void {
  const frozen: EnergyControlPrefs = {
    favoriteSwitchIds: [...p.favoriteSwitchIds],
    favoriteBuildingIds: [...p.favoriteBuildingIds],
    favoriteBuildingGroups: p.favoriteBuildingGroups.map((g) => ({
      ...g,
      memberBuildingIds: [...g.memberBuildingIds],
    })),
    switchAliases: { ...p.switchAliases },
    buildingAliases: { ...p.buildingAliases },
  };
  try {
    const raw = JSON.stringify(frozen);
    localStorage.setItem(LS_KEY, raw);
    cachedLsRaw = raw;
    cachedSnapshot = frozen;
    window.dispatchEvent(new Event(EV));
  } catch {
    /* ignore */
  }
}

export function subscribeEnergyPrefs(cb: () => void): () => void {
  const fn = () => cb();
  window.addEventListener(EV, fn);
  return () => window.removeEventListener(EV, fn);
}

export function toggleFavoriteSwitch(id: string): void {
  const p = readEnergyControlPrefs();
  const set = new Set(p.favoriteSwitchIds);
  if (set.has(id)) set.delete(id);
  else set.add(id);
  writePrefs({ ...p, favoriteSwitchIds: [...set] });
}

export function toggleFavoriteBuilding(id: string): void {
  const p = readEnergyControlPrefs();
  const set = new Set(p.favoriteBuildingIds);
  if (set.has(id)) set.delete(id);
  else set.add(id);
  writePrefs({ ...p, favoriteBuildingIds: [...set] });
}

export function setSwitchAlias(id: string, alias: string): void {
  const p = readEnergyControlPrefs();
  const next = { ...p.switchAliases };
  const t = alias.trim();
  if (!t) delete next[id];
  else next[id] = t;
  writePrefs({ ...p, switchAliases: next });
}

export function setBuildingAlias(id: string, alias: string): void {
  const p = readEnergyControlPrefs();
  const next = { ...p.buildingAliases };
  const t = alias.trim();
  if (!t) delete next[id];
  else next[id] = t;
  writePrefs({ ...p, buildingAliases: next });
}

export function isFavoriteSwitch(id: string): boolean {
  return readEnergyControlPrefs().favoriteSwitchIds.includes(id);
}

export function isFavoriteBuilding(id: string): boolean {
  return readEnergyControlPrefs().favoriteBuildingIds.includes(id);
}

function newGroupId(): string {
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  } catch {
    /* ignore */
  }
  return `g_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Crée ou met à jour un groupe ; retire les membres des autres groupes pour éviter les doublons.
 */
export function upsertFavoriteBuildingGroup(group: FavoriteBuildingGroup): void {
  const p = readEnergyControlPrefs();
  const mem = new Set(group.memberBuildingIds);
  const others = p.favoriteBuildingGroups
    .filter((x) => x.id !== group.id)
    .map((x) => ({
      ...x,
      memberBuildingIds: x.memberBuildingIds.filter((id) => !mem.has(id)),
    }));
  const g: FavoriteBuildingGroup = {
    ...group,
    name: group.name.trim(),
    thumbClass: group.thumbClass.trim() || "Build_ManufacturerMk1_C",
    memberBuildingIds: [...new Set(group.memberBuildingIds.map(String))],
  };
  writePrefs({ ...p, favoriteBuildingGroups: [...others, g] });
}

export function createFavoriteBuildingGroup(partial: {
  name: string;
  thumbClass: string;
  memberBuildingIds: string[];
}): FavoriteBuildingGroup {
  const g: FavoriteBuildingGroup = {
    id: newGroupId(),
    name: partial.name.trim(),
    thumbClass: partial.thumbClass.trim() || "Build_ManufacturerMk1_C",
    memberBuildingIds: [...new Set(partial.memberBuildingIds.map(String))],
  };
  upsertFavoriteBuildingGroup(g);
  return g;
}

export function removeFavoriteBuildingGroup(id: string): void {
  const p = readEnergyControlPrefs();
  writePrefs({ ...p, favoriteBuildingGroups: p.favoriteBuildingGroups.filter((g) => g.id !== id) });
}

/** IDs de bâtiments déjà présents dans un groupe favori (pour éviter les doublons dans le widget). */
export function buildingIdsInFavoriteGroups(): Set<string> {
  const s = new Set<string>();
  for (const g of readEnergyControlPrefs().favoriteBuildingGroups) {
    for (const id of g.memberBuildingIds) s.add(id);
  }
  return s;
}

export function displayNameForSwitch(id: string, frmName: string): string {
  const a = readEnergyControlPrefs().switchAliases[id]?.trim();
  return a || frmName || id;
}

export function displayNameForBuilding(id: string, frmName: string): string {
  const a = readEnergyControlPrefs().buildingAliases[id]?.trim();
  return a || frmName || id;
}
