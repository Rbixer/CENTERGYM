/* Encuesta Gym — SW mínimo para PWA. Sin listener `fetch`: evita que el SW
   proxee peticiones y cuelgue el panel /api/admin (cookies y POST).
   v2: limpia caches heredadas de versiones antiguas del SW. */
self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map((name) => caches.delete(name)));
      } catch {
        /* sin API caches o sin permiso */
      }
      await self.clients.claim();
    })(),
  );
});
