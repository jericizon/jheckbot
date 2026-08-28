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
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
        @click.self="dismiss"
        @keydown.escape="dismiss"
        @keydown.arrow-left.prevent="moveFocus(-1)"
        @keydown.arrow-right.prevent="moveFocus(1)"
        tabindex="0"
        ref="overlayEl"
      >
        <Transition
          enter-active-class="transition-all duration-200 ease-out"
          leave-active-class="transition-all duration-150 ease-in"
          enter-from-class="opacity-0 scale-95"
          leave-to-class="opacity-0 scale-95"
        >
          <div
            v-if="open"
            role="dialog"
            aria-modal="true"
            :aria-label="title"
            class="w-full max-w-sm rounded-xl border border-border bg-surface-elevated shadow-xl p-5 space-y-4"
          >
            <div class="flex items-start gap-3">
              <div
                class="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                :class="variant === 'danger' ? 'bg-red-500/10 text-red-500' : 'bg-accent-muted text-content'"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01M5 19h14a2 2 0 001.84-2.75L13.74 4a2 2 0 00-3.48 0L3.16 16.25A2 2 0 005 19z" /></svg>
              </div>
              <div class="min-w-0 flex-1">
                <h2 class="text-sm font-semibold text-content">{{ title }}</h2>
                <p v-if="message" class="mt-1 text-xs text-content-subtle leading-relaxed">
                  <slot name="message">{{ message }}</slot>
                </p>
              </div>
            </div>

            <p v-if="error" class="text-sm text-red-500">{{ error }}</p>

            <div class="flex gap-2 pt-1">
              <button
                @click="dismiss"
                :disabled="loading"
                ref="cancelBtnEl"
                class="flex-1 rounded-lg border border-border py-2 text-sm font-medium text-content-muted hover:text-content hover:border-content-subtle transition-colors disabled:opacity-50"
              >
                {{ cancelLabel }}
              </button>
              <button
                @click="$emit('confirm')"
                :disabled="loading"
                ref="confirmBtnEl"
                class="flex-1 rounded-lg py-2 text-sm font-medium text-white disabled:opacity-50 transition-colors"
                :class="variant === 'danger' ? 'bg-red-500 hover:bg-red-600' : 'bg-content hover:opacity-80'"
              >
                {{ loading ? loadingLabel : confirmLabel }}
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
interface Props {
  open: boolean
  title: string
  message?: string
  confirmLabel?: string
  cancelLabel?: string
  loadingLabel?: string
  loading?: boolean
  error?: string
  variant?: 'danger' | 'default'
}

const props = withDefaults(defineProps<Props>(), {
  confirmLabel: 'Confirm',
  cancelLabel: 'Cancel',
  loadingLabel: 'Working...',
  loading: false,
  error: '',
  variant: 'danger',
})

const emit = defineEmits<{
  (e: 'confirm'): void
  (e: 'cancel'): void
}>()

const overlayEl = ref<HTMLElement | null>(null)
const cancelBtnEl = ref<HTMLButtonElement | null>(null)
const confirmBtnEl = ref<HTMLButtonElement | null>(null)

function dismiss() {
  if (props.loading) return
  emit('cancel')
}

// Arrow keys cycle focus between the two actions.
function moveFocus(dir: 1 | -1) {
  const buttons = [cancelBtnEl.value, confirmBtnEl.value].filter((b): b is HTMLButtonElement => !!b && !b.disabled)
  if (buttons.length === 0) return
  const active = document.activeElement as HTMLElement | null
  const idx = buttons.findIndex((b) => b === active)
  const next = buttons[(idx + dir + buttons.length) % buttons.length]
  next?.focus()
}

watch(() => props.open, (open) => {
  if (!open) return
  // Default focus on confirm so Enter immediately confirms; arrow keys
  // move between cancel and confirm.
  nextTick(() => {
    if (confirmBtnEl.value && !confirmBtnEl.value.disabled) {
      confirmBtnEl.value.focus()
    } else {
      overlayEl.value?.focus()
    }
  })
})
</script>
