// Kill-switch service worker.
//
// The app no longer uses offline caching. This worker exists only to replace the
// old caching worker on devices that already installed it: it takes control
// immediately, deletes every cache, unregisters itself and reloads open tabs so
// nothing is ever served from a stale cache again. It never handles fetches.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.map((n) => caches.delete(n)));
      await self.registration.unregister();
      const clients = await self.clients.matchAll({ type: "window" });
      for (const client of clients) client.navigate(client.url);
    })(),
  );
});
