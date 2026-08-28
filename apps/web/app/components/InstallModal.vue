<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-200"
      leave-active-class="transition-opacity duration-150"
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
    >
      <div
        v-if="open"
        ref="overlayEl"
        tabindex="0"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
        @click.self="dismiss"
        @keydown.esc="dismiss"
        @keydown.tab="trapFocus"
      >
        <Transition
          enter-active-class="transition-all duration-200 ease-out"
          leave-active-class="transition-all duration-150 ease-in"
          enter-from-class="opacity-0 scale-95"
          leave-to-class="opacity-0 scale-95"
        >
          <div
            v-if="open"
            ref="modalEl"
            role="dialog"
            aria-modal="true"
            aria-label="Install JheckBot"
            class="w-full max-w-sm rounded-2xl border border-border bg-surface-elevated shadow-2xl overflow-hidden"
          >
            <!-- Header: icon + title + close -->
            <div class="flex items-start gap-3 p-4 border-b border-border">
              <img
                src="/icon-192.png"
                alt="JheckBot"
                class="w-12 h-12 rounded-xl shrink-0"
              />
              <div class="min-w-0 flex-1">
                <h2 class="text-base font-semibold text-content">Install JheckBot</h2>
                <p class="mt-0.5 text-xs text-content-subtle leading-relaxed">
                  Add to your home screen or desktop for a full-screen, app-like experience.
                </p>
              </div>
              <button
                ref="closeBtnEl"
                type="button"
                @click="dismiss"
                aria-label="Close"
                title="Close (Esc)"
                class="shrink-0 -m-1 p-1 rounded-md text-content-subtle hover:text-content hover:bg-surface-subtle transition-colors"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <!-- Body -->
            <div class="p-4 space-y-4">
              <!-- Android / desktop: native install prompt -->
              <div v-if="platform === 'android' || platform === 'desktop'" class="flex gap-2">
                <button
                  type="button"
                  @click="dismiss"
                  class="flex-1 rounded-lg border border-border py-2.5 text-sm font-medium text-content-muted hover:text-content hover:border-content-subtle transition-colors"
                >
                  Not now
                </button>
                <button
                  ref="installBtnEl"
                  type="button"
                  @click="install"
                  :disabled="installing"
                  class="flex-[1.5] rounded-lg bg-content text-surface py-2.5 text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity active:scale-[0.98]"
                >
                  {{ installing ? 'Installing...' : 'Install' }}
                </button>
              </div>

              <!-- iOS: manual Add to Home Screen steps -->
              <div v-else-if="platform === 'ios'" class="space-y-3">
                <ol class="space-y-2 text-sm text-content-subtle leading-relaxed">
                  <li class="flex gap-2">
                    <span class="font-semibold text-content">1.</span>
                    <span>
                      Tap the
                      <span class="inline-flex items-center align-middle text-content">
                        <svg class="w-3.5 h-3.5 mx-0.5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M16 1l-4 4-4-4 .7-.7L12 3.6 15.3.3 16 1zM12 5v14M5 11l7-7 7 7" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                      </span>
                      Share button in Safari
                    </span>
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
                  ref="installBtnEl"
                  type="button"
                  @click="dismiss"
                  class="w-full rounded-lg bg-content text-surface py-2.5 text-sm font-semibold hover:opacity-90 transition-opacity active:scale-[0.98]"
                >
                  Got it
                </button>
              </div>

              <!-- Fallback for browsers with no install path -->
              <div v-else class="space-y-3">
                <p class="text-sm text-content-subtle">
                  Your browser can install JheckBot from its menu. Look for "Install" or "Add to Home Screen" in the address bar or browser menu.
                </p>
                <button
                  ref="installBtnEl"
                  type="button"
                  @click="dismiss"
                  class="w-full rounded-lg bg-content text-surface py-2.5 text-sm font-semibold hover:opacity-90 transition-opacity active:scale-[0.98]"
                >
                  Got it
                </button>
              </div>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
// Custom in-app PWA install modal.
// Source: https://web.dev/articles/customize-install
// Source: https://developer.mozilla.org/en-US/docs/Web/API/BeforeInstallPromptEvent

interface Props {
  open: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'close'): void
}>()

const pwa = usePWA()
const installing = ref(false)

const overlayEl = ref<HTMLElement | null>(null)
const modalEl = ref<HTMLElement | null>(null)
const installBtnEl = ref<HTMLButtonElement | null>(null)
const closeBtnEl = ref<HTMLButtonElement | null>(null)

type Platform = 'android' | 'ios' | 'desktop' | 'none'

const platform = computed<Platform>(() => {
  if (!import.meta.client) return 'none'
  const ua = navigator.userAgent
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as unknown as { MSStream?: unknown }).MSStream
  if (isIOS) return 'ios'

  // The beforeinstallprompt event fires on Android Chrome and desktop Chrome/Edge.
  if (pwa.canInstall.value) {
    if (/Android/.test(ua)) return 'android'
    return 'desktop'
  }

  // Some Android browsers without beforeinstallprompt can still use the menu.
  if (/Android/.test(ua)) return 'ios'

  return 'none'
})

async function install() {
  installing.value = true
  try {
    const accepted = await pwa.promptInstall()
    if (accepted) emit('close')
  } finally {
    installing.value = false
  }
}

function dismiss() {
  if (installing.value) return
  emit('close')
}

// Trap focus inside the modal while it is open.
function trapFocus(e: KeyboardEvent) {
  if (e.key !== 'Tab' || !modalEl.value) return
  const focusable = Array.from(
    modalEl.value.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
  ).filter((el) => !el.hasAttribute('disabled') && el.tabIndex >= 0)

  if (focusable.length === 0) return
  const first = focusable[0]
  const last = focusable[focusable.length - 1]
  const active = document.activeElement as HTMLElement | null

  if (e.shiftKey && active === first) {
    e.preventDefault()
    last.focus()
  } else if (!e.shiftKey && active === last) {
    e.preventDefault()
    first.focus()
  }
}

// Focus the primary action when the modal opens.
watch(() => props.open, (open) => {
  if (!open) return
  nextTick(() => {
    installBtnEl.value?.focus()
  })
})
</script>
