import { pngImageModules, webpImageModules } from "virtual:item-catalog-image-maps";

/** Fusion déterministe de tous les JSON `traductions/<lang>/*.json`. */
function mergeTranslationModules(
  modules: Record<string, Record<string, string>>
): Record<string, string> {
  const out: Record<string, string> = {};
  const paths = Object.keys(modules).sort();
  for (const path of paths) {
    Object.assign(out, modules[path]);
  }
  return out;
}

const enModules = import.meta.glob<Record<string, string>>("../traductions/en/*.json", {
  eager: true,
  import: "default",
});
const frModules = import.meta.glob<Record<string, string>>("../traductions/fr/*.json", {
  eager: true,
  import: "default",
});

const labelsByLang = {
  en: mergeTranslationModules(enModules),
  fr: mergeTranslationModules(frModules),
};

const imageUrlByClassName = new Map<string, string>();

function classNameFromImagePath(filePath: string, ext: "webp" | "png"): string | null {
  const file = filePath.split("/").pop() ?? "";
  const base = ext === "webp" ? file.replace(/\.webp$/i, "") : file.replace(/\.png$/i, "");
  return base || null;
}

for (const p of Object.keys(webpImageModules)) {
  const cn = classNameFromImagePath(p, "webp");
  if (cn) imageUrlByClassName.set(cn, webpImageModules[p] as string);
}
for (const p of Object.keys(pngImageModules)) {
  const cn = classNameFromImagePath(p, "png");
  if (cn && !imageUrlByClassName.has(cn)) {
    imageUrlByClassName.set(cn, pngImageModules[p] as string);
  }
}

export function itemLabel(className: string, lang: string): string | undefined {
  const l = lang.toLowerCase().startsWith("fr") ? labelsByLang.fr : labelsByLang.en;
  return l[className];
}

/** Toutes les classes d’objets connues du catalogue (union FR/EN), triées par libellé pour la langue courante. */
export function allItemCatalogClassNames(lang: string): string[] {
  const useFr = lang.toLowerCase().startsWith("fr");
  const primary = useFr ? labelsByLang.fr : labelsByLang.en;
  const secondary = useFr ? labelsByLang.en : labelsByLang.fr;
  const loc = useFr ? "fr" : "en";
  const keys = new Set<string>([...Object.keys(primary), ...Object.keys(secondary)]);
  return [...keys].sort((a, b) => {
    const la = primary[a] ?? secondary[a] ?? a;
    const lb = primary[b] ?? secondary[b] ?? b;
    return la.localeCompare(lb, loc, { sensitivity: "base" });
  });
}

/** Fiche item sur Satisfactory Calculator (wiki), selon la langue UI. */
export function wikiItemDetailUrl(className: string, lang: string): string {
  const seg = lang.toLowerCase().startsWith("fr") ? "fr" : "en";
  return `https://satisfactory-calculator.com/${seg}/items/detail/id/${encodeURIComponent(className)}`;
}

/** Mods / classes sans vignette fiable : forcer le repli (ex. mascotte FICSIT dans `ItemThumb`). */
function forceNoCatalogImage(className: string): boolean {
  const c = className.trim();
  if (!c) return false;
  /** Blocs AWS / intégrations : assets souvent absents ou non alignés sur le jeu de base. */
  if (/^Build_AWS/i.test(c)) return true;
  return false;
}

export function itemImageUrl(className: string): string | undefined {
  if (forceNoCatalogImage(className)) return undefined;
  return imageUrlByClassName.get(className);
}

/** Filtre les classes du catalogue pour un champ de recherche (libellés FR/EN + classe brute). */
export function filterCatalogClassNames(lang: string, query: string, limit = 500): string[] {
  const all = allItemCatalogClassNames(lang);
  const q = query.trim().toLowerCase();
  if (!q) return all.slice(0, limit);
  const useFr = lang.toLowerCase().startsWith("fr");
  const lo = useFr ? labelsByLang.fr : labelsByLang.en;
  const lx = useFr ? labelsByLang.en : labelsByLang.fr;
  const out: string[] = [];
  for (const c of all) {
    if (out.length >= limit) break;
    const blob = [lo[c], lx[c], c].filter(Boolean).join(" ").toLowerCase();
    if (blob.includes(q)) out.push(c);
  }
  return out;
}
