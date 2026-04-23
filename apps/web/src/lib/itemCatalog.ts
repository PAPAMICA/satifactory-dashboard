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

/** URLs Vite pour chaque PNG sous `src/img/` (récursif ; clé = nom de fichier sans extension). */
const imageModules = import.meta.glob<string>("../img/**/*.png", {
  eager: true,
  query: "?url",
  import: "default",
});

const imageUrlByClassName = new Map<string, string>();

for (const path of Object.keys(imageModules)) {
  const file = path.split("/").pop() ?? "";
  const className = file.replace(/\.png$/i, "");
  if (className) {
    imageUrlByClassName.set(className, imageModules[path] as string);
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

export function itemImageUrl(className: string): string | undefined {
  return imageUrlByClassName.get(className);
}
