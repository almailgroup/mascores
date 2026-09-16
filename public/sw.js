// Service worker for MansourAlmailScores.
//
// Deliberately conservative: it only ever handles same-origin GET requests that
// fall into one of two buckets — page navigations, and Vite's content-hashed
// static assets. Everything else (Supabase queries, server functions, auth
// callbacks, any non-GET) is left completely untouched: we never call
// respondWith(), so those requests go straight to the network as if no service
// worker existed. Live scores must never be served from a cache.
//
// Bump CACHE_VERSION to invalidate every cache on the next deploy.
const CACHE_VERSION = "v1";
const STATIC_CACHE = `mas-static-${CACHE_VERSION}`;
const ASSET_CACHE = `mas-assets-${CACHE_VERSION}`;
const OFFLINE_URL = "/offline.html";

const PRECACHE = [OFFLINE_URL, "/icon-192.png", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      // Individual failures must not abort the install, or a single 404 leaves
      // the app with no offline page at all.
      .then((cache) => Promise.allSettled(PRECACHE.map((url) => cache.add(url))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  const keep = new Set([STATIC_CACHE, ASSET_CACHE]);
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((n) => !keep.has(n)).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

// Lets the page trigger an immediate update instead of waiting for all tabs to close.
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

/** Content-hashed build output — immutable, so safe to serve cache-first. */
function isHashedAsset(url) {
  return url.pathname.startsWith("/assets/");
}

/** Precached app chrome that rarely changes. */
function isPrecachedStatic(url) {
  return PRECACHE.includes(url.pathname) || url.pathname === "/apple-touch-icon.png";
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Never interfere with writes, cross-origin traffic (Supabase), or range requests.
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (request.headers.has("range")) return;

  // Navigations: always go to the network so scores are live. Fall back to the
  // offline page only when the network genuinely fails.
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL, { ignoreSearch: true })));
    return;
  }

  if (isHashedAsset(url)) {
    event.respondWith(cacheFirst(request, ASSET_CACHE));
    return;
  }

  if (isPrecachedStatic(url)) {
    event.respondWith(staleWhileRevalidate(request, STATIC_CACHE));
    return;
  }

  // Anything else — server functions, API calls, data routes — is left alone.
});

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(cacheName);
    cache.put(request, response.clone());
  }
  return response;
}

async function staleWhileRevalidate(request, cacheName) {
  const cached = await caches.match(request);
  const network = fetch(request)
    .then(async (response) => {
      if (response.ok) {
        const cache = await caches.open(cacheName);
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => cached);
  return cached || network;
}
