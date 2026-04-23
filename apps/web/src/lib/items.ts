import { itemLabel } from "./itemCatalog";

export type InventoryItemRow = {
  className: string;
  name: string;
  amount: number;
  favorite: boolean;
};

/** Libellé affiché : traduction locale si présente, sinon nom renvoyé par FRM. */
export function itemDisplayName(row: InventoryItemRow, lang: string): string {
  return itemLabel(row.className, lang) ?? row.name;
}
