<template>
  <div>
    <SplashScreen :visible="showSplash" />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
    <InstallBanner :open="showInstallBanner" @dismiss="dismissInstallBanner" />
  </div>
</template>

<script setup lang="ts">
// Show the splash during initial hydration, then fade it out once mounted.
const showSplash = ref(true)

// Install banner: shown on mobile when the app is installable. Dismissal is
// persisted with a cooldown so it doesn't nag on every visit.
const DISMISS_KEY = 'pwa:install-dismissed'
const COOLDOWN_MS = 1000 * 60 * 60 * 24 * 7 // 7 days
const showInstallBanner = ref(false)
const pwa = usePWA()

function isMobile(): boolean {
  if (!import.meta.client) return false
  return window.matchMedia('(max-width: 768px)').matches
}

function recentlyDismissed(): boolean {
  if (!import.meta.client) return false
  const ts = Number(localStorage.getItem(DISMISS_KEY) || 0)
  return ts > 0 && Date.now() - ts < COOLDOWN_MS
}

function dismissInstallBanner() {
  showInstallBanner.value = false
  if (import.meta.client) localStorage.setItem(DISMISS_KEY, String(Date.now()))
}

onMounted(() => {
  // Brief delay so the fade-out transition is visible rather than instant.
  setTimeout(() => {
    showSplash.value = false
  }, 350)

  // Show the install banner once the beforeinstallprompt event has fired
  // (Android/Chrome) or on iOS where we show manual steps. Only on mobile,
  // only if not already installed, and only if not recently dismissed.
  const eligible = () =>
    isMobile() && !pwa.isInstalled.value && !recentlyDismissed()

  const tryShow = () => {
    if (!eligible()) return
    // Android/Chrome: canInstall becomes true after beforeinstallprompt.
    // iOS: canInstall stays false, but we still show manual steps.
    const ua = navigator.userAgent
    const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as unknown as { MSStream?: unknown }).MSStream
    if (pwa.canInstall.value || isIOS) {
      showInstallBanner.value = true
    }
  }

  // Give the beforeinstallprompt event a moment to fire before first check.
  setTimeout(tryShow, 1500)

  // Re-check when canInstall flips to true (event may fire later).
  watch(pwa.canInstall, (can) => {
    if (can && eligible()) showInstallBanner.value = true
  })
})
</script>
