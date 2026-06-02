// Service worker for the static app shell. This makes the app installable and
// load instantly offline. It does NOT make emulation work offline: the WASM
// cores are loaded cross-origin from the EmulatorJS CDN and are deliberately
// not intercepted here.

const CACHE = "bgb-shell-v1";
const SHELL = [
  "./",
  "index.html",
  "style.css",
  "app.js",
  "cheats.json",
  "manifest.json",
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

// Cache-first for our own same-origin GETs; everything else (e.g. the CDN
// cores) goes straight to the network untouched.
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
      return res;
    }).catch(() => caches.match("./")))
  );
});
