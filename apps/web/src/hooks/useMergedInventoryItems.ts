import { useMemo } from "react";
import { allItemCatalogClassNames } from "@/lib/itemCatalog";
import { itemDisplayName, type InventoryItemRow } from "@/lib/items";

/**
 * Inventaire complet : entrées du catalogue (y compris stock 0) + tout objet
 * renvoyé par l’API mais absent du JSON (ex. mods), avec état favori unifié.
 */
export function useMergedInventoryItems(
  apiItems: InventoryItemRow[] | undefined,
  favoriteClassNames: string[] | undefined,
  lang: string,
): InventoryItemRow[] {
  return useMemo(() => {
    const catalog = allItemCatalogClassNames(lang);
    const fromApi = new Map((apiItems ?? []).map((i) => [i.className, { ...i }]));
    const favSet = new Set<string>(favoriteClassNames ?? []);
    for (const i of apiItems ?? []) {
      if (i.favorite) favSet.add(i.className);
    }
    const seen = new Set<string>();
    const out: InventoryItemRow[] = [];
    for (const cn of catalog) {
      seen.add(cn);
      const v = fromApi.get(cn);
      out.push({
        className: cn,
        name: v?.name ?? cn,
        amount: v?.amount ?? 0,
        favorite: favSet.has(cn),
      });
    }
    for (const i of apiItems ?? []) {
      if (seen.has(i.className)) continue;
      out.push({
        ...i,
        favorite: favSet.has(i.className) || i.favorite,
      });
    }
    out.sort((a, b) => {
      if (b.amount !== a.amount) return b.amount - a.amount;
      return itemDisplayName(a, lang).localeCompare(itemDisplayName(b, lang), lang, { sensitivity: "base" });
    });
    return out;
  }, [apiItems, favoriteClassNames, lang]);
}
