// PWA install state. The beforeinstallprompt event is captured globally by
// plugins/pwa.client.ts so it is not missed if it fires before the settings
// page is visited. This composable reads from that shared state.
export function usePWA() {
  const canInstall = useState<boolean>('pwa:canInstall', () => false)
  const isInstalled = useState<boolean>('pwa:isInstalled', () => false)

  if (import.meta.client) {
    // display-mode: standalone is true when launched from the home screen.
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      // iOS Safari does not support display-mode: standalone reliably.
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true
    isInstalled.value = !!standalone
  }

  async function promptInstall(): Promise<boolean> {
    if (import.meta.client) {
      const { $pwaPrompt } = useNuxtApp() as unknown as {
        $pwaPrompt: { promptInstall: () => Promise<boolean> }
      }
      if ($pwaPrompt) return await $pwaPrompt.promptInstall()
    }
    return false
  }

  return { canInstall, isInstalled, promptInstall }
}
