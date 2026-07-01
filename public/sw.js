// Minimal offline service worker for the Nexus PWA.
// - App shell is precached so the app loads offline.
// - Navigations are network-first (fresh HTML online, cached shell offline).
// - Same-origin static assets are cache-first (Vite content-hashes them, so they're immutable).
// - Cross-origin requests (Supabase REST/Realtime, Firebase) are never intercepted.
//
// Bump VERSION to force clients onto a new cache after a deploy.
const VERSION = "nexus-v1"
const ASSET_CACHE = `${VERSION}-assets`
const SHELL = ["", "index.html", "manifest.json", "favicon.svg", "icon-192.png", "icon-512.png", "apple-touch-icon.png"]

const scopeUrl = (p) => new URL(p, self.registration.scope).toString()

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(ASSET_CACHE)
    await cache.addAll(SHELL.map(scopeUrl)).catch(() => {})
    await self.skipWaiting()
  })())
})

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys()
    await Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)))
    await self.clients.claim()
  })())
})

self.addEventListener("fetch", (event) => {
  const req = event.request
  if (req.method !== "GET") return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return  // leave Supabase/Firebase/etc. alone

  // App navigations: network-first, fall back to the cached shell when offline.
  if (req.mode === "navigate") {
    event.respondWith((async () => {
      try {
        return await fetch(req)
      } catch {
        const cache = await caches.open(ASSET_CACHE)
        return (await cache.match(scopeUrl("index.html")))
          || (await cache.match(scopeUrl("")))
          || Response.error()
      }
    })())
    return
  }

  // Same-origin static assets: stale-while-revalidate. Serve the cached copy fast, but
  // always refresh it in the background so non-content-hashed files (manifest, icons,
  // favicon, the offline shell) self-heal after a deploy without a manual cache-version bump.
  event.respondWith((async () => {
    const cache = await caches.open(ASSET_CACHE)
    const cached = await cache.match(req)
    const fetching = fetch(req)
      .then((res) => {
        if (res.ok && res.type === "basic") cache.put(req, res.clone())
        return res
      })
      .catch(() => null)
    return cached || (await fetching) || Response.error()
  })())
})
