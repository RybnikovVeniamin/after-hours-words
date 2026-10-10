// Offline support: network first so updates show up right away, cached copy when there is no connection.
const CACHE = "ahw-v1";
const CORE = ["./", "index.html", "words.json", "manifest.webmanifest", "icon-180.png", "icon-192.png", "icon-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  const isFont = url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com";
  if (!sameOrigin && !isFont) return; // e.g. Claude API calls are never cached

  e.respondWith((async () => {
    const network = fetch(req).then(res => {
      if (res && (res.ok || res.type === "opaque")) {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
      }
      return res;
    });
    const cached = await caches.match(req, { ignoreSearch: sameOrigin })
      || (req.mode === "navigate" ? await caches.match("index.html") : undefined);
    if (!cached) return network;
    // On a slow connection, fall back to the cached copy after a few seconds.
    return Promise.race([
      network.catch(() => cached),
      new Promise(resolve => setTimeout(() => resolve(cached), 3500)),
    ]);
  })());
});
