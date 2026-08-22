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
            aria-label="Commit and push"
            class="w-full max-w-md max-h-[85vh] flex flex-col rounded-xl border border-border bg-surface-elevated shadow-xl overflow-hidden"
          >
            <!-- Header -->
            <div class="flex items-center gap-2 px-4 py-3 border-b border-border shrink-0">
              <svg class="w-4 h-4 text-content-muted shrink-0" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
              <h2 class="text-sm font-semibold text-content flex-1">Commit &amp; Push</h2>
              <button
                @click="dismiss"
                class="p-1 rounded-md text-content-subtle hover:text-content hover:bg-surface-subtle transition-colors shrink-0"
                title="Close (Esc)"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <!-- Body -->
            <div class="flex-1 overflow-y-auto p-4 space-y-3">
              <!-- Branch + file count -->
              <div class="flex items-center gap-2 text-xs text-content-subtle">
                <span v-if="branch" class="flex items-center gap-1 bg-surface-subtle rounded px-1.5 py-0.5">
                  <svg class="w-3 h-3 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 3v12" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="6" r="3" /><path stroke-linecap="round" stroke-linejoin="round" d="M18 9v3a3 3 0 01-3 3H6" /></svg>
                  <span class="font-mono">{{ branch }}</span>
                </span>
                <span v-if="fileCount > 0">{{ fileCount }} file{{ fileCount === 1 ? '' : 's' }} changed</span>
              </div>

              <!-- Commit message input -->
              <div class="space-y-1.5">
                <div class="flex items-center justify-between">
                  <label for="commit-message" class="text-xs font-medium text-content-muted">Commit message</label>
                  <button
                    @click="generate"
                    :disabled="generating || committing"
                    class="flex items-center gap-1 text-xs font-medium text-content-subtle hover:text-content transition-colors disabled:opacity-50"
                  >
                    <svg v-if="generating" class="w-3 h-3 animate-spin" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                    <svg v-else class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>
                    {{ generating ? 'Generating...' : 'Generate' }}
                  </button>
                </div>
                <textarea
                  id="commit-message"
                  v-model="message"
                  @keydown.escape="dismiss"
                  ref="messageEl"
                  placeholder="Enter commit message..."
                  rows="6"
                  :disabled="committing"
                  class="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-content placeholder-content-subtle focus:border-content-subtle focus:outline-none transition-colors resize-none font-mono"
                />
              </div>

              <!-- Error -->
              <p v-if="error" class="text-sm text-red-500">{{ error }}</p>

              <!-- Success -->
              <div v-if="success" class="rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 text-xs text-emerald-500 space-y-1">
                <div class="flex items-center gap-1.5 font-medium">
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" /></svg>
                  Committed{{ success.pushed ? ' & pushed' : '' }} to {{ success.branch }}
                </div>
                <div class="font-mono text-content-muted truncate">{{ success.commitHash.slice(0, 7) }}</div>
              </div>
            </div>

            <!-- Footer -->
            <div class="flex gap-2 px-4 py-3 border-t border-border shrink-0 safe-area-pb">
              <button
                @click="dismiss"
                :disabled="committing"
                class="flex-1 rounded-lg border border-border py-2.5 text-sm font-medium text-content-muted hover:text-content hover:border-content-subtle transition-colors disabled:opacity-50"
              >
                {{ success ? 'Close' : 'Cancel' }}
              </button>
              <button
                v-if="!success"
                @click="submit"
                :disabled="!message.trim() || committing"
                class="flex-1 rounded-lg bg-content text-surface py-2.5 text-sm font-medium hover:opacity-80 disabled:opacity-50 transition-opacity active:scale-[0.98]"
              >
                {{ committing ? 'Committing...' : 'Commit & Push' }}
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
  projectId: string | null | undefined
  branch?: string | null
  fileCount?: number
}

const props = withDefaults(defineProps<Props>(), {
  branch: null,
  fileCount: 0,
})

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'committed'): void
}>()

const projectsApi = useProjects()

const message = ref('')
const generating = ref(false)
const committing = ref(false)
const error = ref('')
const success = ref<{ branch: string; commitHash: string; pushed: boolean } | null>(null)
const overlayEl = ref<HTMLElement | null>(null)
const messageEl = ref<HTMLTextAreaElement | null>(null)

function dismiss() {
  if (committing.value) return
  emit('close')
}

async function generate() {
  if (!props.projectId || generating.value) return
  generating.value = true
  error.value = ''
  try {
    const result = await projectsApi.generateCommit(props.projectId)
    message.value = result.message
  } catch (err: unknown) {
    error.value = (err as { data?: { error?: string } })?.data?.error || 'Failed to generate commit message'
  } finally {
    generating.value = false
  }
}

async function submit() {
  if (!props.projectId || !message.value.trim() || committing.value) return
  committing.value = true
  error.value = ''
  success.value = null
  try {
    const result = await projectsApi.commit(props.projectId, message.value.trim())
    success.value = { branch: result.branch, commitHash: result.commitHash, pushed: result.pushed }
    emit('committed')
  } catch (err: unknown) {
    error.value = (err as { data?: { error?: string } })?.data?.error || 'Failed to commit'
  } finally {
    committing.value = false
  }
}

watch(() => props.open, (open) => {
  if (!open) return
  // Reset state when opening
  message.value = ''
  error.value = ''
  success.value = null
  nextTick(() => messageEl.value?.focus())
})
</script>
