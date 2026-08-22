// Shared notification state — manages both local notifications (page
// backgrounded) and Web Push subscriptions (app closed). Web Push requires
// VAPID keys to be configured on the API server.
const permission = ref<NotificationPermission>('default')
const pushSupported = ref(false)
const pushSubscribed = ref(false)
const pushEnabled = ref(false) // VAPID keys configured on server
let initialized = false

function init() {
  if (initialized || !import.meta.client) return
  initialized = true
  if (!('Notification' in window)) {
    permission.value = 'denied'
    return
  }
  permission.value = Notification.permission
  pushSupported.value = 'serviceWorker' in navigator && 'PushManager' in window
  // Check if push is configured on the server
  checkPushConfig()
}

async function checkPushConfig() {
  try {
    const res = await fetch('/api/push/vapid-public-key', { credentials: 'include' })
    if (res.ok) {
      const data = await res.json()
      pushEnabled.value = !!data.publicKey
    }
  } catch {
    // Server may not be reachable yet; non-fatal.
  }
}

// Convert base64 URL string to Uint8Array for PushManager.subscribe
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const output = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; ++i) {
    output[i] = raw.charCodeAt(i)
  }
  return output
}

export function useNotifications() {
  if (import.meta.client) init()

  const isSupported = computed(() => typeof Notification !== 'undefined')

  async function requestPermission(): Promise<boolean> {
    if (!import.meta.client || !('Notification' in window)) return false
    const result = await Notification.requestPermission()
    permission.value = result
    return result === 'granted'
  }

  // Show a local notification (page is open but backgrounded).
  function notify(
    title: string,
    options?: NotificationOptions & { url?: string; force?: boolean },
  ): void {
    if (!import.meta.client) return
    if (permission.value !== 'granted') return
    if (!options?.force && !document.hidden) return

    try {
      const n = new Notification(title, {
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag: options?.tag,
        body: options?.body,
        data: options?.data ?? { url: options?.url },
      })
      n.onclick = () => {
        window.focus()
        const url = (options?.url) ?? (options?.data as { url?: string } | undefined)?.url
        if (url) navigateTo(url)
        n.close()
      }
    } catch {
      // Notification construction is best-effort.
    }
  }

  // Subscribe to Web Push via the service worker's PushManager.
  async function subscribePush(): Promise<boolean> {
    if (!import.meta.client || !pushSupported.value) return false
    if (permission.value !== 'granted') {
      const granted = await requestPermission()
      if (!granted) return false
    }

    try {
      const reg = await navigator.serviceWorker.ready
      const res = await fetch('/api/push/vapid-public-key', { credentials: 'include' })
      if (!res.ok) return false
      const { publicKey } = await res.json()
      if (!publicKey) return false

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as unknown as BufferSource,
      })

      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ subscription: sub }),
      })

      pushSubscribed.value = true
      return true
    } catch {
      return false
    }
  }

  // Unsubscribe from Web Push.
  async function unsubscribePush(): Promise<boolean> {
    if (!import.meta.client) return false
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await sub.unsubscribe()
        await fetch('/api/push/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ endpoint: sub.endpoint }),
        })
      }
      pushSubscribed.value = false
      return true
    } catch {
      return false
    }
  }

  // Check existing push subscription status on mount.
  async function checkPushSubscription(): Promise<void> {
    if (!import.meta.client || !pushSupported.value) return
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      pushSubscribed.value = !!sub
    } catch {
      // Non-fatal
    }
  }

  // Send a test push notification via the server.
  async function testPush(): Promise<boolean> {
    try {
      const res = await fetch('/api/push/test', {
        method: 'POST',
        credentials: 'include',
      })
      return res.ok
    } catch {
      return false
    }
  }

  return {
    permission: readonly(permission),
    isSupported,
    pushSupported: readonly(pushSupported),
    pushSubscribed: readonly(pushSubscribed),
    pushEnabled: readonly(pushEnabled),
    requestPermission,
    notify,
    subscribePush,
    unsubscribePush,
    checkPushSubscription,
    testPush,
  }
}
