/* AfriMarket PWA service worker — v4
   Stratégie :
   - API calls           → network-only
   - Navigations HTML    → network-first (JAMAIS de cache pour index.html)
   - JS / CSS / chunks   → network-first (fraîcheur après deploy)
   - Images CDN externes → cache-first (immutables)
   - Autres assets       → stale-while-revalidate
*/
const CACHE_VERSION = "afrimarket-v4";
const STATIC_SHELL = [
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png",
  "/manifest.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(STATIC_SHELL))
      .catch(() => {})
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

  // ── 1. API calls — réseau uniquement, jamais de cache ──────────────────
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

  // ── 2. Navigations HTML (refresh, liens directs, QR scan) ──────────────
  // TOUJOURS network-first : index.html doit être frais après chaque deploy.
  // Si le réseau tombe, on sert l'index.html en cache comme fallback offline.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((resp) => {
          if (resp.ok) {
            // Mettre à jour le cache silencieusement
            const copy = resp.clone();
            caches.open(CACHE_VERSION).then((c) => c.put(request, copy)).catch(() => {});
          }
          return resp;
        })
        .catch(async () => {
          // Hors ligne : servir index.html depuis le cache (SPA routing)
          const cached = await caches.match("/index.html") || await caches.match("/");
          return cached || new Response("Hors ligne", { status: 503 });
        })
    );
    return;
  }

  // ── 3. JS / CSS / chunks — network-first ───────────────────────────────
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
        .catch(() =>
          caches.match(request).then((c) => c || new Response("", { status: 504 }))
        )
    );
    return;
  }

  // ── 4. Images CDN externes (S3) — cache-first, économise la bande passante
  if (url.origin !== self.location.origin) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((resp) => {
          if (resp.ok) {
            const copy = resp.clone();
            caches.open(CACHE_VERSION).then((c) => c.put(request, copy)).catch(() => {});
          }
          return resp;
        }).catch(() => new Response("", { status: 504 }));
      })
    );
    return;
  }

  // ── 5. Autres assets locaux (icons, fonts…) — stale-while-revalidate ───
  event.respondWith(
    caches.match(request).then((cached) => {
      const fetchPromise = fetch(request).then((resp) => {
        if (resp.ok) {
          const copy = resp.clone();
          caches.open(CACHE_VERSION).then((c) => c.put(request, copy)).catch(() => {});
        }
        return resp;
      }).catch(() => null);

      return cached || fetchPromise.then((r) => r || new Response("", { status: 504 }));
    })
  );
});
