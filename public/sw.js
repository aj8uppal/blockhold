/* Blockhold service worker.
   Navigations are NETWORK-FIRST (with cached fallback) so new deployments are
   picked up immediately; hashed immutable assets are cache-first. */
const CACHE = 'blockhold-v3'

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(['./', './manifest.webmanifest'])).then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ).then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return

  if (req.mode === 'navigate') {
    // fresh shell when online; cached shell offline
    event.respondWith(
      fetch(req).then((res) => {
        if (res.ok) {
          const clone = res.clone()
          caches.open(CACHE).then((cache) => cache.put('./', clone))
        }
        return res
      }).catch(() => caches.match('./')),
    )
    return
  }

  /*
    Two kinds of asset, and they cannot share a strategy.

    Anything under /assets/ is content-hashed by the build: its URL changes
    whenever its bytes do, so cache-first is always correct and a hit never
    needs revalidating.

    Everything else in public/ - the map art, the icons, the OG image, the
    manifest - is NOT hashed. Cache-first held those forever: replacing a
    portrait or an icon would never reach anyone who had already visited,
    because the URL it lived at was identical. Those get stale-while-revalidate
    instead: instant from cache, and quietly replaced for next time.
  */
  const hashed = new URL(req.url).pathname.includes('/assets/')

  if (hashed) {
    event.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (res.ok) {
          const clone = res.clone()
          caches.open(CACHE).then((cache) => cache.put(req, clone))
        }
        return res
      })),
    )
    return
  }

  event.respondWith(
    caches.match(req).then((hit) => {
      const fresh = fetch(req).then((res) => {
        if (res.ok) {
          const clone = res.clone()
          caches.open(CACHE).then((cache) => cache.put(req, clone))
        }
        return res
      }).catch(() => hit)
      return hit || fresh
    }),
  )
})
