<template>
  <div>
    <SplashScreen :visible="showSplash" />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
    <InstallModal :open="showInstallModal" @close="dismissInstallModal" />
  </div>
</template>

<script setup lang="ts">
// Show the splash during initial hydration, then fade it out once mounted.
const showSplash = ref(true)

// Install modal: shown when the app is installable. Dismissal is persisted with
// a cooldown so it doesn't nag on every visit.
const DISMISS_KEY = 'pwa:install-modal-dismissed'
const COOLDOWN_MS = 1000 * 60 * 60 * 24 * 7 // 7 days
const showInstallModal = ref(false)
const pwa = usePWA()

function recentlyDismissed(): boolean {
  if (!import.meta.client) return false
  const ts = Number(localStorage.getItem(DISMISS_KEY) || 0)
  return ts > 0 && Date.now() - ts < COOLDOWN_MS
}

function dismissInstallModal() {
  showInstallModal.value = false
  if (import.meta.client) localStorage.setItem(DISMISS_KEY, String(Date.now()))
}

function isIOS(): boolean {
  if (!import.meta.client) return false
  const ua = navigator.userAgent
  return /iPad|iPhone|iPod/.test(ua) && !(window as unknown as { MSStream?: unknown }).MSStream
}

onMounted(() => {
  // Brief delay so the fade-out transition is visible rather than instant.
  setTimeout(() => {
    showSplash.value = false
  }, 350)

  // Show the install modal once the beforeinstallprompt event has fired
  // (Android/Chrome/desktop Edge) or on iOS where we show manual steps.
  // Only if not already installed and not recently dismissed.
  const eligible = () =>
    !pwa.isInstalled.value && !recentlyDismissed()

  const tryShow = () => {
    if (!eligible()) return
    // Android/Chrome/desktop: canInstall becomes true after beforeinstallprompt.
    // iOS: canInstall stays false, but we still show manual steps.
    if (pwa.canInstall.value || isIOS()) {
      showInstallModal.value = true
    }
  }

  // Give the beforeinstallprompt event a moment to fire before first check.
  setTimeout(tryShow, 1500)

  // Re-check when canInstall flips to true (event may fire later).
  watch(pwa.canInstall, (can) => {
    if (can && eligible()) showInstallModal.value = true
  })
})
</script>
