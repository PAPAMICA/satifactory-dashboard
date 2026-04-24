/**
 * Catégories visuelles des bâtiments sur la carte (couleurs distinctes).
 * Basé sur `ClassName` UE (FRM / Satisfactory).
 */
export type FrmFactoryMapCategory = "storage" | "power" | "production";

/** Corrige les réponses FRM où `ClassName` contient un suffixe d’instance (`Build_GeneratorCoal_C_32`). */
export function normalizeFrmBuildingClassName(raw: string): string {
  const s = String(raw ?? "").trim();
  const m = s.match(/^(Build_[A-Za-z0-9]+_C)(_\d+)?$/);
  if (m?.[1]) return m[1];
  return s;
}

/** Classe un bâtiment pour la pastille / empreinte carte. */
export function factoryMapCategoryFromClassName(classNameNormalized: string): FrmFactoryMapCategory {
  const c = classNameNormalized;
  if (!c) return "production";

  if (
    /Build_(Storage|IndustrialTank|PipeStorage|CentralStorage|StackableShelf)/i.test(c) ||
    /Build_Storage/i.test(c)
  ) {
    return "storage";
  }

  if (
    /Build_Generator/i.test(c) ||
    /Build_PowerStorage/i.test(c) ||
    /Build_AlienPowerBuilding/i.test(c)
  ) {
    return "power";
  }

  return "production";
}
