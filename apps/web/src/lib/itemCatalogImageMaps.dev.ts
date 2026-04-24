/** Dev : WebP si présents (après `npm run build:images`), sinon PNG. */
export const webpImageModules = import.meta.glob<string>("../img/**/*.webp", {
  eager: true,
  query: "?url",
  import: "default",
});

export const pngImageModules = import.meta.glob<string>("../img/**/*.png", {
  eager: true,
  query: "?url",
  import: "default",
});
