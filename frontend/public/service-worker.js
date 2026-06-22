/* AfriMarket PWA service worker — v3
   Stratégie :
   - API calls          → network-only (jamais mis en cache)
   - JS / CSS / chunks  → network-first (cache de fallback seulement)
   - App shell (HTML, icons, manifest) → cache-first avec revalidation en bg
*/
const CACHE_VERSION = "afrimarket-v3";
const APP_SHELL = ["/", "/index.html", "/manifest.json", "/icons/icon-192x192.png", "/icons/icon-512x512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // ── API : toujours réseau, jamais de cache ──────────────────────────────
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(request).catch(() =>
        new Response(JSON.stringify({ detail: "Hors ligne" }), {
          status: 503,
          headers: { "Content-Type": "application/json" },
        })
      )
    );
    return;
  }

  // ── JS / CSS / chunks : network-first (fraîcheur garantie après deploy) ─
  // Un vieux chunk en cache peut casser la SPA après un redéploiement Railway.
  const isAsset =
    url.pathname.match(/\.(js|css|mjs)$/) ||
    url.pathname.startsWith("/static/");

  if (isAsset) {
    event.respondWith(
      fetch(request)
        .then((resp) => {
          if (resp.ok) {
            const copy = resp.clone();
            caches.open(CACHE_VERSION).then((c) => c.put(request, copy)).catch(() => {});
          }
          return resp;
        })
        .catch(() => caches.match(request).then((c) => c || new Response("", { status: 504 })))
    );
    return;
  }

  // ── Images S3 / CDN externes : cache-first (immutables, économise bande passante) ─
  if (url.origin !== self.location.origin) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request)
          .then((resp) => {
            if (resp.ok) {
              const copy = resp.clone();
              caches.open(CACHE_VERSION).then((c) => c.put(request, copy)).catch(() => {});
            }
            return resp;
          })
          .catch(() => new Response("", { status: 504 }));
      })
    );
    return;
  }

  // ── App shell / navigation : cache-first + revalidation en arrière-plan ──
  event.respondWith(
    caches.match(request).then((cached) => {
      const fetchPromise = fetch(request)
        .then((resp) => {
          if (resp.ok) {
            const copy = resp.clone();
            caches.open(CACHE_VERSION).then((c) => c.put(request, copy)).catch(() => {});
          }
          return resp;
        })
        .catch(() => null);

      // Retourner le cache immédiatement si disponible, revalider en bg
      if (cached) {
        fetchPromise.catch(() => {}); // revalidation non-bloquante
        return cached;
      }

      return fetchPromise.then((resp) => {
        if (resp) return resp;
        // Fallback navigation → index.html (SPA routing)
        if (request.mode === "navigate") return caches.match("/");
        return new Response("", { status: 504 });
      });
    })
  );
});
