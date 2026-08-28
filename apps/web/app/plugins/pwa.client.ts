// Captures the beforeinstallprompt event globally so it is not missed if it
// fires before the install modal is opened. Stores the deferred prompt and
// exposes promptInstall() via the Nuxt app instance.
//
// Source: https://developer.mozilla.org/en-US/docs/Web/API/BeforeInstallPromptEvent
// Source: https://web.dev/articles/customize-install
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
      try {
        // Show the browser install prompt.
        // prompt() resolves once the prompt is shown; the actual user choice
        // is available on the userChoice promise.
        await deferredPrompt.prompt()
        const { outcome } = await deferredPrompt.userChoice
        return outcome === 'accepted'
      } catch {
        return false
      } finally {
        deferredPrompt = null
        canInstall.value = false
      }
    },
  })
})
