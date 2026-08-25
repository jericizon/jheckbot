<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-all duration-300 ease-out"
      leave-active-class="transition-all duration-200 ease-in"
      enter-from-class="opacity-0 translate-y-full"
      leave-to-class="opacity-0 translate-y-full"
    >
      <div
        v-if="open"
        class="fixed inset-x-0 bottom-0 z-[60] px-3 pb-3 safe-area-pb pointer-events-none"
      >
        <div
          role="dialog"
          aria-modal="false"
          aria-label="Install JheckBot"
          class="pointer-events-auto mx-auto max-w-sm rounded-2xl border border-border bg-surface-elevated shadow-2xl p-3.5 space-y-3"
        >
          <!-- Header row: icon + title + close -->
          <div class="flex items-start gap-3">
            <img
              src="/icon-192.png"
              alt="JheckBot"
              class="w-11 h-11 rounded-xl shrink-0"
            />
            <div class="min-w-0 flex-1">
              <h2 class="text-sm font-semibold text-content">Install JheckBot</h2>
              <p class="mt-0.5 text-xs text-content-subtle leading-relaxed">
                Add to your home screen for a full-screen, app-like experience — works offline.
              </p>
            </div>
            <button
              @click="dismiss"
              aria-label="Dismiss"
              class="shrink-0 -m-1 p-1 rounded-md text-content-subtle hover:text-content transition-colors"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          <!-- Android/Chrome: native install prompt -->
          <div v-if="platform === 'android'" class="flex gap-2">
            <button
              @click="dismiss"
              class="flex-1 rounded-lg border border-border py-2.5 text-sm font-medium text-content-muted hover:text-content hover:border-content-subtle transition-colors"
            >
              Not now
            </button>
            <button
              @click="install"
              :disabled="installing"
              class="flex-[1.5] rounded-lg bg-content text-surface py-2.5 text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {{ installing ? 'Installing…' : 'Install' }}
            </button>
          </div>

          <!-- iOS: no beforeinstallprompt, show Share → Add to Home Screen steps -->
          <div v-else-if="platform === 'ios'" class="space-y-2.5">
            <ol class="space-y-1.5 text-xs text-content-subtle leading-relaxed">
              <li class="flex gap-2">
                <span class="font-semibold text-content">1.</span>
                <span>Tap the <span class="inline-flex items-center align-middle text-content"><svg class="w-3.5 h-3.5 mx-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M16 1l-4 4-4-4 .7-.7L12 3.6 15.3.3 16 1zM12 5v14M5 11l7-7 7 7" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></span> Share button in Safari</span>
              </li>
              <li class="flex gap-2">
                <span class="font-semibold text-content">2.</span>
                <span>Select <span class="font-medium text-content">Add to Home Screen</span></span>
              </li>
              <li class="flex gap-2">
                <span class="font-semibold text-content">3.</span>
                <span>Tap <span class="font-medium text-content">Add</span></span>
              </li>
            </ol>
            <button
              @click="dismiss"
              class="w-full rounded-lg border border-border py-2.5 text-sm font-medium text-content-muted hover:text-content hover:border-content-subtle transition-colors"
            >
              Got it
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { usePWA } from '~/composables/usePWA'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ (e: 'dismiss'): void }>()

const pwa = usePWA()
const installing = ref(false)

// Determine which install flow to show. Android/Chrome fire beforeinstallprompt
// so we can trigger install directly. iOS Safari does not, so we show manual
// steps instead. Desktop browsers are excluded by the parent (mobile-only).
type Platform = 'android' | 'ios' | 'none'
const platform = computed<Platform>(() => {
  if (!import.meta.client) return 'none'
  const ua = navigator.userAgent
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as unknown as { MSStream?: unknown }).MSStream
  if (isIOS) return 'ios'
  // beforeinstallprompt is only fired on Android/Chrome (and desktop Chrome).
  // If we're on mobile and it fired, treat as android flow.
  if (pwa.canInstall.value) return 'android'
  // Fallback: Android without beforeinstallprompt (rare) — still show ios-style steps.
  if (/Android/.test(ua)) return 'ios'
  return 'none'
})

async function install() {
  installing.value = true
  try {
    const accepted = await pwa.promptInstall()
    if (accepted) emit('dismiss')
  } finally {
    installing.value = false
  }
}

function dismiss() {
  if (installing.value) return
  emit('dismiss')
}
</script>
