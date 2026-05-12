/**
 * GYM CENTER — Service Worker v3 (móvil / PWA).
 * - Caché solo de `/_next/static/*` (chunks hasheados) para cargas repetidas rápidas.
 * - No intercepta /api/*, /admin*, ni peticiones RSC/prefetch de Next.
 * - Navegación: si falla la red, muestra /offline.html (precacheado en install).
 */
const VERSION = "v4";
const STATIC_CACHE = `gymcenter-static-${VERSION}`;
const PRECACHE = `gymcenter-precache-${VERSION}`;
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(PRECACHE);
        await cache.add(
          new Request(OFFLINE_URL, {
            cache: "reload",
            credentials: "same-origin",
          }),
        );
      } catch {
        /* primera visita sin red: se ignora */
      }
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([STATIC_CACHE, PRECACHE]);
      const keys = await caches.keys();
      await Promise.all(
        keys.map((name) => (keep.has(name) ? Promise.resolve() : caches.delete(name))),
      );
      await self.clients.claim();
    })(),
  );
});

function mustBypass(url) {
  if (url.pathname.startsWith("/api/")) return true;
  if (url.pathname.startsWith("/admin")) return true;
  return false;
}

function isHashedNextStatic(url) {
  return url.pathname.startsWith("/_next/static/");
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (mustBypass(url)) return;

  if (req.headers.get("RSC") === "1") return;
  if (req.headers.get("Next-Router-Prefetch") === "1") return;
  if (url.searchParams.has("_rsc")) return;

  if (isHashedNextStatic(url)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(STATIC_CACHE);
        const hit = await cache.match(req, { ignoreSearch: false });
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) {
          try {
            await cache.put(req, res.clone());
          } catch {
            /* quota o respuesta no cacheable */
          }
        }
        return res;
      })(),
    );
    return;
  }

  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const net = await fetch(req);
          return net;
        } catch {
          const precache = await caches.open(PRECACHE);
          const offline = await precache.match(OFFLINE_URL, { ignoreSearch: true });
          if (offline) return offline;
          return new Response("Sin conexión", {
            status: 503,
            statusText: "Offline",
            headers: { "Content-Type": "text/plain; charset=utf-8" },
          });
        }
      })(),
    );
  }
});
