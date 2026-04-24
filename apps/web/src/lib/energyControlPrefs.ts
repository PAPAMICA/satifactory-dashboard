const LS_KEY = "sf_energy_control_prefs_v1";

export type EnergyControlPrefs = {
  favoriteSwitchIds: string[];
  favoriteBuildingIds: string[];
  switchAliases: Record<string, string>;
  buildingAliases: Record<string, string>;
};

const EV = "sf-energy-prefs-changed";

/** Dernière chaîne lue dans localStorage — pour un snapshot stable avec `useSyncExternalStore`. */
let cachedLsRaw: string | null = null;
let cachedSnapshot: EnergyControlPrefs = {
  favoriteSwitchIds: [],
  favoriteBuildingIds: [],
  switchAliases: {},
  buildingAliases: {},
};

function defaultPrefs(): EnergyControlPrefs {
  return {
    favoriteSwitchIds: [],
    favoriteBuildingIds: [],
    switchAliases: {},
    buildingAliases: {},
  };
}

function normalizePrefs(o: Partial<EnergyControlPrefs>): EnergyControlPrefs {
  return {
    favoriteSwitchIds: Array.isArray(o.favoriteSwitchIds) ? o.favoriteSwitchIds.map(String) : [],
    favoriteBuildingIds: Array.isArray(o.favoriteBuildingIds) ? o.favoriteBuildingIds.map(String) : [],
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

export function displayNameForSwitch(id: string, frmName: string): string {
  const a = readEnergyControlPrefs().switchAliases[id]?.trim();
  return a || frmName || id;
}

export function displayNameForBuilding(id: string, frmName: string): string {
  const a = readEnergyControlPrefs().buildingAliases[id]?.trim();
  return a || frmName || id;
}
