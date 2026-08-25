// JheckBot Service Worker — offline shell caching + notification click handling
const CACHE_NAME = 'jheckbot-v2'
const OFFLINE_URL = '/offline.html'
const SHELL_ASSETS = [
  '/login',
  '/offline.html',
  '/manifest.json',
]

// Only cache same-origin 200 responses; don't cache redirects or opaque assets.
function shouldCache(response) {
  return response && response.ok && response.type === 'basic'
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME)
      await Promise.all(
        SHELL_ASSETS.map((url) =>
          cache
            .add(new Request(url, { cache: 'reload' }))
            .catch(() => {}),
        ),
      )
    })(),
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    })(),
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  // Don't intercept API requests — let the browser and app handle them.
  if (url.pathname.startsWith('/api/')) return

  // Navigation requests: network first, then cached shell, then offline page.
  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(
      (async () => {
        try {
          const networkResponse = await fetch(request)
          if (shouldCache(networkResponse)) {
            const cache = await caches.open(CACHE_NAME)
            await cache.put(request, networkResponse.clone())
          }
          return networkResponse
        } catch {
          const cached = await caches.match(request)
          if (cached) return cached
          const offline = await caches.match(OFFLINE_URL)
          if (offline) return offline
          return Response.error()
        }
      })(),
    )
    return
  }

  // Static assets: cache first, then network, and update the cache on success.
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME)
      const cached = await cache.match(request)
      if (cached) {
        try {
          const networkResponse = await fetch(request)
          if (shouldCache(networkResponse)) {
            await cache.put(request, networkResponse)
          }
        } catch {
          // Keep the cached response if the network is down.
        }
        return cached
      }
      try {
        const networkResponse = await fetch(request)
        if (shouldCache(networkResponse)) {
          await cache.put(request, networkResponse.clone())
        }
        return networkResponse
      } catch {
        return new Response('', { status: 404, statusText: 'Not Found' })
      }
    })(),
  )
})

// Focus or open the tab when a notification is clicked, navigating to the
// conversation URL stored in the notification's data payload.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data && event.notification.data.url
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.visibilityState !== 'hidden' || 'focus' in client) {
          if (url && 'navigate' in client) client.navigate(url)
          return client.focus()
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url || '/')
    }),
  )
})

// Handle incoming push events from the push service. Shows a notification
// with sound (silent: false is the default, so the OS plays its notification
// sound). requireInteraction keeps the notification visible until tapped.
self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { title: 'JheckBot', body: event.data ? event.data.text() : 'Task update' }
  }

  const title = data.title || 'JheckBot'
  const options = {
    body: data.body || 'Task update',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: data.tag,
    data: { url: data.url },
    requireInteraction: true,
    silent: false,
    vibrate: [200, 100, 200],
  }

  event.waitUntil(self.registration.showNotification(title, options))
})
