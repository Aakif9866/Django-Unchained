// On Hold service worker. `npm run build` stamps VERSION and PRECACHE (scripts/precache.mjs) into out/sw.js.
// Install: download the whole static site in the background, so every game opens instantly and works offline.
// Fetch: hashed build files are cache-first (they never change); pages and data are stale-while-revalidate.
const VERSION = "dev";
const PRECACHE = [];
const CACHE = "onhold-" + VERSION;

self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(async (cache) => {
      // A few at a time, and one failure doesn't sink the rest.
      const queue = PRECACHE.slice();
      const worker = async () => {
        for (let url = queue.shift(); url; url = queue.shift()) await cache.add(url).catch(() => {});
      };
      await Promise.all(Array.from({ length: 6 }, worker));
    }),
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((ks) => Promise.all(ks.filter((k) => k.startsWith("onhold") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin || url.pathname === "/sw.js") return;
  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      // Next adds cache-busting query strings to its data requests; the files themselves are static.
      const cached = await cache.match(req, { ignoreSearch: true });
      // A cached response carries the cached URL. Hand back a copy with no URL, so the page (or a Web Worker,
      // whose bootstrap config rides in the query string) keeps the URL it actually asked for.
      const hit = cached && cached.url !== req.url ? new Response(cached.body, { status: cached.status, statusText: cached.statusText, headers: cached.headers }) : cached;
      if (hit && url.pathname.startsWith("/_next/static/")) return hit; // content-hashed: never stale
      const fresh = fetch(req)
        .then((res) => {
          if (res.ok && res.type === "basic") cache.put(req, res.clone());
          return res;
        })
        .catch(() => hit || Response.error());
      return hit || fresh;
    }),
  );
});
