/**
 * Service worker.
 *
 * The driver is in a cab, so signal comes and goes. The goal is that opening
 * the app with no bars still gets him a working rate check rather than a
 * dinosaur. Bump CACHE when any precached file changes.
 */
const CACHE = "haulmath-v1";

// The shell: everything the rate check needs to run with no network at all.
const PRECACHE = [
  "/app.css",
  "/app.js",
  "/lib/calc.js",
  "/lib/money.js",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/offline",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      // addAll is all-or-nothing; one 404 would leave the app with no cache at
      // all, so failures are tolerated per file.
      .then((cache) => Promise.allSettled(PRECACHE.map((url) => cache.add(url))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/** Pages that are safe to serve from cache when the network is gone. */
function isCacheableNavigation(url) {
  return ["/", "/calculator", "/loads", "/expenses", "/reports"].includes(url.pathname);
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only GET is ever cached. Writes go through the app's own outbox, which
  // carries an idempotency key; replaying them here would risk duplicates.
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never cache money-moving or identity pages — a stale invoice or a cached
  // logged-in page after logout would both be worse than an error.
  if (
    url.pathname.startsWith("/billing") ||
    url.pathname.startsWith("/webhook") ||
    url.pathname.startsWith("/invoices") ||
    url.pathname === "/login" ||
    url.pathname === "/signup"
  ) {
    return;
  }

  if (request.mode === "navigate") {
    // Network first: the driver should see live data whenever there is signal.
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok && isCacheableNavigation(url)) {
            const copy = response.clone();
            caches.open(CACHE).then((c) => c.put(request, copy));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          const offline = await caches.match("/offline");
          return (
            offline ??
            new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain" } })
          );
        })
    );
    return;
  }

  // Static assets: cache first, refresh in the background.
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((c) => c.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached ?? network;
    })
  );
});

/** Logging out must not leave the previous account's pages on the phone. */
self.addEventListener("message", (event) => {
  if (event.data === "clear-cache") {
    caches.keys().then((keys) => keys.forEach((k) => caches.delete(k)));
  }
});
