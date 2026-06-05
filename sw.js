// Service worker for the static app shell. This makes the app installable and
// load instantly offline. It does NOT make emulation work offline: the WASM
// cores are loaded cross-origin from the EmulatorJS CDN and are deliberately
// not intercepted here.

const CACHE = "bgb-shell-v3";
const SHELL = [
  "./",
  "index.html",
  "style.css",
  "app.js",
  "cheats.json",
  "manifest.json",
  "fonts/inter.woff2",
  "icon-192.png",
  "icon-512.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

// Stale-while-revalidate for our own same-origin GETs: serve the cached copy
// instantly, but always refetch in the background and update the cache so app
// updates reach returning visitors (cache-first never did). Cross-origin
// requests (e.g. the CDN cores) go straight to the network untouched.
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    caches.open(CACHE).then((cache) =>
      cache.match(req).then((cached) => {
        const network = fetch(req)
          .then((res) => {
            if (res && res.status === 200) cache.put(req, res.clone());
            return res;
          })
          .catch(() => cached);
        return cached || network;
      })
    )
  );
});
