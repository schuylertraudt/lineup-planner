const CACHE_NAME = "lineup-planner-v2";
const CORE_ASSETS = ["/manifest.json", "/icon-192.png", "/icon-512.png", "/apple-touch-icon.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Next.js App Router fetches page data (RSC payloads) for client-side
// transitions using the same pathname but a `_rsc` cache-busting query param
// and a non-"navigate" request mode. A full document load (typing a URL,
// reopening the installed PWA, a hard refresh) is mode "navigate" and has no
// such param. These two are different content types for the same URL, so
// they're kept as distinct cache entries via a synthetic "__swkind" marker
// that never leaves this file.
function cacheKeyFor(url, kind) {
  const key = new URL(url.toString());
  key.searchParams.delete("_rsc");
  key.searchParams.set("__swkind", kind);
  return key.toString();
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return; // writes go through the app's own offline queue
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return; // API reads are handled by the app's sync layer

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);

      // Immutable build assets: cache-first. Next's dev server appends a
      // `?v=<timestamp>` cache-buster to these URLs that changes on every
      // recompile; production builds content-hash the path itself instead,
      // so stripping the query here is what makes dev-mode testing (and any
      // dev-server asset refresh) behave the same as a real deployment.
      if (url.pathname.startsWith("/_next/static/")) {
        const assetKey = url.origin + url.pathname;
        const cached = await cache.match(assetKey);
        if (cached) return cached;
        try {
          const res = await fetch(request);
          if (res.ok) cache.put(assetKey, res.clone());
          return res;
        } catch {
          return cached || Response.error();
        }
      }

      // Pages (both full documents and RSC transition payloads), manifest,
      // icons: network-first, falling back to whichever kind of cached
      // response matches this exact kind of request. A client-issued warm-up
      // fetch (see AppShell) marks itself as "doc" via a header so that a
      // route only ever visited through client-side navigation is still
      // available for a later hard reload / cold PWA relaunch.
      const forcedKind = request.headers.get("X-SW-Warm");
      const kind = forcedKind === "doc" ? "doc" : request.mode === "navigate" ? "doc" : "rsc";
      const key = cacheKeyFor(url, kind);
      try {
        const res = await fetch(request);
        if (res.ok) cache.put(key, res.clone());
        return res;
      } catch {
        const cached = await cache.match(key);
        if (cached) return cached;
        if (request.mode === "navigate") {
          const shell = await cache.match(cacheKeyFor(new URL("/season", url.origin), "doc"));
          if (shell) return shell;
        }
        return Response.error();
      }
    })()
  );
});
