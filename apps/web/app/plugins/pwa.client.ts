// Captures the beforeinstallprompt event globally so it is not missed if it
// fires before the settings page is visited. Stores the deferred prompt and
// exposes promptInstall() via the Nuxt app instance.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export default defineNuxtPlugin((nuxtApp) => {
  let deferredPrompt: BeforeInstallPromptEvent | null = null
  const canInstall = useState<boolean>('pwa:canInstall', () => false)

  function onBeforeInstallPrompt(e: Event) {
    e.preventDefault()
    deferredPrompt = e as BeforeInstallPromptEvent
    canInstall.value = true
  }

  function onAppInstalled() {
    canInstall.value = false
    deferredPrompt = null
  }

  window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
  window.addEventListener('appinstalled', onAppInstalled)

  nuxtApp.provide('pwaPrompt', {
    async promptInstall(): Promise<boolean> {
      if (!deferredPrompt) return false
      deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      deferredPrompt = null
      canInstall.value = false
      return outcome === 'accepted'
    },
  })
})
