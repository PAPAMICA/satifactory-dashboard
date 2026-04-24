/**
 * Enregistre le service worker de cache des images (fichier statique `/image-cache-sw.js`).
 */
export function registerImageCacheServiceWorker(): void {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

  const base = import.meta.env.BASE_URL || "/";
  const path = `${base}image-cache-sw.js`.replace(/\/{2,}/g, "/");

  void navigator.serviceWorker
    .register(path, { scope: base })
    .then((reg) => {
      reg.addEventListener("updatefound", () => {
        const nw = reg.installing;
        if (!nw) return;
        nw.addEventListener("statechange", () => {
          if (nw.state === "installed" && navigator.serviceWorker.controller) {
            void reg.update();
          }
        });
      });
    })
    .catch(() => {
      /* pas bloquant (HTTP, scope, etc.) */
    });
}
