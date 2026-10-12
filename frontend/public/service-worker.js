/* AfriMarket PWA service worker — v5
   Stratégie définitive pour production :
   - API (/api/)         → network-only, jamais de cache
   - Navigation HTML     → network-first avec timeout 4s, fallback index.html offline
   - JS/CSS/chunks       → network-first, cache de secours
   - Images CDN (S3)     → cache-first, réseau en fallback
   - Autres assets       → stale-while-revalidate
*/
const CACHE = "afrimarket-green-direct-rc3-v12";
const OFFLINE_PAGE = "/index.html";

// Assets à précacher au premier install
const PRECACHE = [
  "/",
  "/index.html",
  "/manifest.json",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png",
];

// ── Install ──────────────────────────────────────────────────────────────────
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(PRECACHE))
      .catch(() => {}) // ne pas bloquer l'install si un asset manque
  );
  self.skipWaiting();
});

// ── Activate — purger les anciens caches ─────────────────────────────────────
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k.startsWith("afrimarket-") && k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── Helpers ──────────────────────────────────────────────────────────────────
function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), ms)),
  ]);
}

// ── Fetch ────────────────────────────────────────────────────────────────────
self.addEventListener("fetch", (e) => {
  const { request } = e;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // 1. API — réseau pur, jamais de cache
  if (url.pathname === "/api" || url.pathname.startsWith("/api/") || request.headers.has("Authorization")) {
    e.respondWith(
      fetch(request).catch(() =>
        new Response(JSON.stringify({ detail: "Hors ligne" }), {
          status: 503,
          headers: { "Content-Type": "application/json" },
        })
      )
    );
    return;
  }

  // 2. Navigation HTML (refresh, lien direct, scan QR, deep link)
  //    → network-first avec timeout 5s
  //    → si réseau ok : mettre index.html en cache et servir
  //    → si réseau KO ou timeout : servir index.html depuis cache (offline)
  if (request.mode === "navigate") {
    e.respondWith(
      withTimeout(fetch(request), 5000)
        .then((resp) => {
          if (resp.ok) {
            // Toujours mettre à jour le cache de index.html
            const copy = resp.clone();
            caches.open(CACHE).then((c) => {
              c.put(OFFLINE_PAGE, copy.clone());
              c.put(request, copy);
            }).catch(() => {});
          }
          return resp;
        })
        .catch(async () => {
          // Hors ligne ou timeout → SPA fallback
          const cached =
            (await caches.match(OFFLINE_PAGE)) ||
            (await caches.match("/"));
          return (
            cached ||
            new Response(
              "<html><body>Hors ligne — relancez l'application</body></html>",
              { status: 503, headers: { "Content-Type": "text/html" } }
            )
          );
        })
    );
    return;
  }

  // 3. JS / CSS / chunks — network-first, cache de secours
  const isAsset =
    url.pathname.match(/\.(js|css|mjs)$/) ||
    url.pathname.startsWith("/static/");

  if (isAsset) {
    e.respondWith(
      fetch(request)
        .then((resp) => {
          if (resp.ok) {
            const copy = resp.clone();
            caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {});
          }
          return resp;
        })
        .catch(() =>
          caches.match(request).then((c) => c || new Response("", { status: 504 }))
        )
    );
    return;
  }

  // 4. Only explicitly public image/font origins may enter the public cache.
  if (url.origin !== self.location.origin) {
    if (!["images.unsplash.com", "fonts.googleapis.com", "fonts.gstatic.com"].includes(url.hostname)) return;
    e.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request)
          .then((resp) => {
            if (resp.ok) {
              const copy = resp.clone();
              caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {});
            }
            return resp;
          })
          .catch(() => new Response("", { status: 504 }));
      })
    );
    return;
  }

  // 5. Autres assets locaux (icons, fonts…) — stale-while-revalidate
  e.respondWith(
    caches.match(request).then((cached) => {
      const fetchPromise = fetch(request)
        .then((resp) => {
          if (resp.ok) {
            const copy = resp.clone();
            caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {});
          }
          return resp;
        })
        .catch(() => null);

      return cached || fetchPromise.then((r) => r || new Response("", { status: 504 }));
    })
  );
});
