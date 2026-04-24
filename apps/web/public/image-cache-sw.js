/**
 * Cache navigateur (Cache API) pour les images same-origin (vignettes items / PNG Vite).
 * Stratégie : cache-first, puis réseau et mise en cache des réponses ok.
 * Incrémenter CACHE_NAME après changement majeur du jeu d’images si besoin de purge.
 */
const CACHE_NAME = "ficsit-item-images-v1";

function isSameOrigin(url) {
  try {
    return new URL(url).origin === self.location.origin;
  } catch {
    return false;
  }
}

function shouldCacheImageRequest(request) {
  if (request.method !== "GET") return false;
  if (!isSameOrigin(request.url)) return false;
  if (request.destination === "image") return true;
  const path = new URL(request.url).pathname.toLowerCase();
  return /\.(png|webp|jpe?g|gif|svg|avif|ico)(\?|$)/.test(path);
}

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k.startsWith("ficsit-item-images-") && k !== CACHE_NAME).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (!shouldCacheImageRequest(req)) return;

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const hit = await cache.match(req);
      if (hit) return hit;

      try {
        const res = await fetch(req);
        if (res && res.ok && res.type === "basic") {
          await cache.put(req, res.clone());
        }
        return res;
      } catch {
        return (await cache.match(req)) || Response.error();
      }
    }),
  );
});
