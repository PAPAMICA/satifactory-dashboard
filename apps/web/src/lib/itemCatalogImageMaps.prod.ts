/** Build production : uniquement WebP (générés au prebuild) — pas de PNG dans le bundle. */
export const webpImageModules = import.meta.glob<string>("../img/**/*.webp", {
  eager: true,
  query: "?url",
  import: "default",
});

export const pngImageModules = {} as Record<string, string>;
