import { frmgClassLabel } from "@/lib/dashboardFrmgDisplay";
import { normalizeBuildClassName } from "@/lib/monitoringFrm";

export type ProductionLine = {
  Name?: string;
  name?: string;
  ClassName?: string;
  className?: string;
  Amount?: string | number;
  CurrentProd?: number;
  currentProd?: number;
  MaxProd?: number;
  maxProd?: number;
  ProdPercent?: number;
  CurrentConsumed?: number;
  currentConsumed?: number;
  MaxConsumed?: number;
  maxConsumed?: number;
  ConsPercent?: number;
};

function asLineArray(raw: unknown): ProductionLine[] {
  if (!Array.isArray(raw)) return [];
  return raw as ProductionLine[];
}

export function factoryProductionLines(r: Record<string, unknown>): ProductionLine[] {
  return asLineArray(r.production ?? r.Production);
}

export function factoryIngredientLines(r: Record<string, unknown>): ProductionLine[] {
  return asLineArray(r.ingredients ?? r.Ingredients);
}

export function factoryPowerInfo(r: Record<string, unknown>): Record<string, unknown> | undefined {
  const pi = r.PowerInfo as Record<string, unknown> | undefined;
  return pi && typeof pi === "object" ? pi : undefined;
}

export function factoryManuSpeedPct(r: Record<string, unknown>): number {
  return Number(r.ManuSpeed ?? r.manuSpeed) || 0;
}

export function factoryPowerShards(r: Record<string, unknown>): number {
  return Math.round(Number(r.PowerShards ?? r.powerShards) || 0);
}

export function factorySomersloops(r: Record<string, unknown>): number {
  return Math.round(Number(r.Somersloops ?? r.somersloops) || 0);
}

/** Boost FRM : vitesses > 100 % ou slugs / somersloops. */
export function factoryIsBoosted(r: Record<string, unknown>): boolean {
  if (factoryManuSpeedPct(r) > 100.01) return true;
  if (factoryPowerShards(r) > 0) return true;
  if (factorySomersloops(r) > 0) return true;
  return false;
}

export function factoryTotalCurrentProdPerMin(r: Record<string, unknown>): number {
  return factoryProductionLines(r).reduce((a, p) => a + (Number(p.CurrentProd) || 0), 0);
}

export function factoryTotalCurrentConsumePerMin(r: Record<string, unknown>): number {
  return factoryIngredientLines(r).reduce((a, p) => a + (Number(p.CurrentConsumed) || 0), 0);
}

export function factoryPowerConsumedMw(r: Record<string, unknown>): number {
  const pi = factoryPowerInfo(r);
  return Number(pi?.PowerConsumed ?? pi?.powerConsumed) || 0;
}

/** Somme des conso MW FRM pour une liste de lignes usine / générateur. */
export function sumFactoryRowsPowerMw(rows: Record<string, unknown>[]): number {
  let s = 0;
  for (const r of rows) s += factoryPowerConsumedMw(r);
  return s;
}

export function factoryPowerMaxMw(r: Record<string, unknown>): number {
  const pi = factoryPowerInfo(r);
  return Number(pi?.MaxPowerConsumed ?? pi?.maxPowerConsumed) || 0;
}

/** `true` si l’usine est raccordée à un réseau électrique FRM. */
export function factoryHasPowerConnection(r: Record<string, unknown>): boolean {
  const pi = factoryPowerInfo(r);
  if (!pi) return false;
  const g = Number(pi.CircuitGroupID ?? pi.circuitGroupID);
  const c = Number(pi.CircuitID ?? pi.circuitId ?? pi.CircuitID);
  if (Number.isFinite(g) && g >= 0) return true;
  if (Number.isFinite(c) && c >= 0) return true;
  return false;
}

export function factoryCircuitGroupId(r: Record<string, unknown>): number | null {
  const pi = factoryPowerInfo(r);
  if (!pi) return null;
  const g = Number(pi.CircuitGroupID ?? pi.circuitGroupID);
  return Number.isFinite(g) ? g : null;
}

export function factoryCircuitId(r: Record<string, unknown>): number | null {
  const pi = factoryPowerInfo(r);
  if (!pi) return null;
  const c = Number(pi.CircuitID ?? pi.circuitId);
  return Number.isFinite(c) ? c : null;
}

export function factoryBuildingClassForThumb(r: Record<string, unknown>): string {
  const raw = String(r.ClassName ?? r.className ?? "").trim();
  if (!raw) return "Build_ManufacturerMk1_C";
  const n = normalizeBuildClassName(raw);
  return n !== "—" ? n : raw;
}

/** Productivité globale FRM (0–100), sinon moyenne des `ProdPercent` des sorties. */
export function factoryProductivityPct(r: Record<string, unknown>): number {
  const raw = Number(r.Productivity ?? r.productivity);
  if (Number.isFinite(raw)) return Math.max(0, Math.min(100, raw));
  const lines = factoryProductionLines(r);
  let sum = 0;
  let n = 0;
  for (const line of lines) {
    const pct = Number(line.ProdPercent ?? line.prodPercent);
    if (Number.isFinite(pct)) {
      sum += pct;
      n += 1;
    }
  }
  return n ? Math.max(0, Math.min(100, sum / n)) : 0;
}

export type FactoryStatusBucket = "producing" | "paused" | "standby" | "not_configured";

export function factoryStatusBucket(r: Record<string, unknown>): FactoryStatusBucket {
  const configured = Boolean(r.IsConfigured ?? r.isConfigured);
  const producing = Boolean(r.IsProducing ?? r.isProducing);
  const paused = Boolean(r.IsPaused ?? r.isPaused);
  if (!configured) return "not_configured";
  if (paused) return "paused";
  if (producing) return "producing";
  return "standby";
}

function appendLineSearchParts(parts: string[], lines: ProductionLine[], lang: string, altLang: string) {
  for (const line of lines) {
    const c = String(line.ClassName ?? line.className ?? "").trim();
    if (!c) continue;
    parts.push(c, frmgClassLabel(c, lang), frmgClassLabel(c, altLang));
    const nm = String(line.Name ?? line.name ?? "").trim();
    if (nm) parts.push(nm);
  }
}

/**
 * Chaîne de recherche (minuscules) pour un bâtiment FRM : nom instance, type(s),
 * recettes sorties / ingrédients (classes + libellés), complément générateur si présent.
 */
export function frmBuildingRowSearchBlob(r: Record<string, unknown>, lang: string): string {
  const parts: string[] = [];
  parts.push(String(r.Name ?? r.name ?? ""));
  const thumb = factoryBuildingClassForThumb(r);
  const altLang = lang.toLowerCase().startsWith("fr") ? "en" : "fr";
  parts.push(thumb, frmgClassLabel(thumb, lang), frmgClassLabel(thumb, altLang));
  const raw = String(r.ClassName ?? r.className ?? "").trim();
  parts.push(raw);
  if (raw) {
    const n = normalizeBuildClassName(raw);
    if (n && n !== "—") parts.push(n, frmgClassLabel(n, lang), frmgClassLabel(n, altLang));
  }
  appendLineSearchParts(parts, factoryProductionLines(r), lang, altLang);
  appendLineSearchParts(parts, factoryIngredientLines(r), lang, altLang);
  const supplement = (r.Supplement ?? r.supplement) as Record<string, unknown> | undefined;
  if (supplement && typeof supplement === "object") {
    parts.push(String(supplement.Name ?? supplement.name ?? ""));
    const sc = String(supplement.ClassName ?? supplement.className ?? "").trim();
    if (sc) parts.push(sc, frmgClassLabel(sc, lang), frmgClassLabel(sc, altLang));
  }
  return parts
    .filter((s) => s.length > 0)
    .join(" ")
    .toLowerCase();
}
