/** Classe Satisfactory pour `ItemThumb` (FRM `ClassName` / `className`). */
export function rowThumbClass(r: Record<string, unknown>, fallback: string): string {
  const c = String(r.ClassName ?? r.className ?? "").trim();
  return c || fallback;
}

export function powerMWFromUsageRow(r: Record<string, unknown>): number {
  const pi = r.PowerInfo as Record<string, unknown> | undefined;
  const raw = pi?.PowerConsumed ?? pi?.powerConsumed ?? r.PowerConsumed;
  return Number(raw) || 0;
}

export function sumCircuitField(
  rows: Record<string, unknown>[],
  key: "PowerProduction" | "PowerConsumed" | "PowerCapacity",
): number {
  return rows.reduce((a, r) => a + (Number(r[key]) || 0), 0);
}

export function circuitFuseCount(rows: Record<string, unknown>[]): number {
  return rows.reduce((a, r) => a + (r.FuseTriggered === true ? 1 : 0), 0);
}

export function aggregateCountByClass(rows: Record<string, unknown>[]): { className: string; n: number }[] {
  const m = new Map<string, number>();
  for (const r of rows) {
    const c = String(r.ClassName ?? r.className ?? "—").trim() || "—";
    m.set(c, (m.get(c) ?? 0) + 1);
  }
  return [...m.entries()]
    .map(([className, n]) => ({ className, n }))
    .sort((a, b) => b.n - a.n);
}

/** Équivalences FRM : même bâtiment logique / même libellé d’affichage. */
const BUILD_CLASS_CANONICAL: Record<string, string> = {
  /** Centrale à biomasse intégrée → même famille que le brûleur à biomasse. */
  Build_GeneratorIntegratedBiomass_C: "Build_GeneratorBiomass_Automated_C",
};

/** Retire les suffixes d’instance FRM (`_32`, etc.) pour regrouper par type de bâtiment. */
export function normalizeBuildClassName(className: string): string {
  let s = className.trim();
  if (!s) return "—";
  for (;;) {
    const next = s.replace(/_\d+$/, "");
    if (next === s) break;
    s = next;
  }
  if (!s) return "—";
  return BUILD_CLASS_CANONICAL[s] ?? s;
}

/** Puissance produite actuellement (MW) pour une ligne `getGenerators`. */
export function generatorMwLive(r: Record<string, unknown>): number {
  const a = Number(r.RegulatedDemandProd ?? r.regulatedDemandProd);
  if (Number.isFinite(a) && a >= 0) return a;
  const b = Number(r.PowerProductionPotential ?? r.powerProductionPotential);
  if (Number.isFinite(b) && b >= 0) return b;
  const c = Number(r.BaseProd ?? r.baseProd);
  return Number.isFinite(c) && c >= 0 ? c : 0;
}

export type PowerByBuildTypeRow = { className: string; count: number; mw: number };

/** Regroupe par type de bâtiment (ClassName normalisé) et somme les MW. */
export function aggregatePowerMwByBuildType(
  rows: Record<string, unknown>[],
  getMw: (r: Record<string, unknown>) => number,
): PowerByBuildTypeRow[] {
  const m = new Map<string, { count: number; mw: number }>();
  for (const r of rows) {
    const raw = String(r.ClassName ?? r.className ?? "").trim();
    const key = normalizeBuildClassName(raw || "—");
    const mw = getMw(r);
    const cur = m.get(key) ?? { count: 0, mw: 0 };
    m.set(key, { count: cur.count + 1, mw: cur.mw + mw });
  }
  return [...m.entries()]
    .map(([className, v]) => ({ className, count: v.count, mw: v.mw }))
    .sort((a, b) => b.mw - a.mw);
}
