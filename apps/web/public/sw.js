// JheckBot Service Worker — offline shell caching + notification click handling
const CACHE_NAME = 'jheckbot-v1'
const STATIC_ASSETS = ['/', '/login', '/manifest.json']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)).catch(() => {}),
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))),
    ),
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  // Don't cache API requests
  if (url.pathname.startsWith('/api/')) return

  // Network-first for navigation, cache fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy))
          return res
        })
        .catch(() => caches.match(request).then((r) => r || caches.match('/'))),
    )
    return
  }

  // Cache-first for static assets
  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request)),
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
