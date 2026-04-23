import { itemLabel } from "@/lib/itemCatalog";

/** Libellé localisé pour une classe Satisfactory (bâtiment / objet), sinon la classe brute. */
export function frmgClassLabel(className: string | undefined, lang: string): string {
  const c = String(className ?? "").trim();
  if (!c || c === "—") return "—";
  return itemLabel(c, lang) ?? c;
}
