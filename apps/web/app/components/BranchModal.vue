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
            aria-label="Branches"
            class="w-full max-w-md max-h-[85vh] flex flex-col rounded-xl border border-border bg-surface-elevated shadow-xl overflow-hidden"
          >
            <!-- Header -->
            <div class="flex items-center gap-2 px-4 py-3 border-b border-border shrink-0">
              <svg class="w-4 h-4 text-content-muted shrink-0" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 3v12" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="6" r="3" /><path stroke-linecap="round" stroke-linejoin="round" d="M18 9v3a3 3 0 01-3 3H6" /></svg>
              <h2 class="text-sm font-semibold text-content flex-1">Branches</h2>
              <button
                @click="dismiss"
                class="p-1 rounded-md text-content-subtle hover:text-content hover:bg-surface-subtle transition-colors shrink-0"
                title="Close (Esc)"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <!-- Body -->
            <div class="flex-1 overflow-y-auto p-4 space-y-4">
              <!-- Create new branch -->
              <div class="space-y-1.5">
                <label for="branch-name" class="text-xs font-medium text-content-muted">Create new branch</label>
                <div class="flex gap-2">
                  <input
                    id="branch-name"
                    v-model="newName"
                    @keydown.enter.exact.prevent="createBranch"
                    ref="nameEl"
                    placeholder="branch-name"
                    :disabled="creating"
                    class="flex-1 min-w-0 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-content placeholder-content-subtle focus:border-content-subtle focus:outline-none transition-colors font-mono disabled:opacity-50"
                  />
                  <button
                    @click="createBranch"
                    :disabled="!newName.trim() || creating"
                    class="shrink-0 rounded-lg bg-content text-surface px-3 py-2 text-sm font-medium hover:opacity-80 disabled:opacity-50 transition-opacity active:scale-[0.98]"
                  >
                    {{ creating ? 'Creating...' : 'Create' }}
                  </button>
                </div>
                <p class="text-[11px] text-content-subtle">Branches from current <span class="font-mono">{{ currentBranch || 'HEAD' }}</span> and switches to it.</p>
              </div>

              <!-- Error -->
              <p v-if="error" class="text-sm text-red-500">{{ error }}</p>

              <!-- Success -->
              <div v-if="success" class="rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 text-xs text-emerald-500 flex items-center gap-1.5">
                <svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" /></svg>
                {{ success }}
              </div>

              <!-- Branch list -->
              <div v-if="loading" class="flex items-center gap-1.5 text-xs text-content-subtle py-2">
                <span class="h-1.5 w-1.5 rounded-full bg-content-subtle animate-pulse" />
                Loading branches...
              </div>
              <div v-else class="space-y-3">
                <!-- Local -->
                <div v-if="localBranches.length > 0">
                  <div class="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-content-subtle mb-1">
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 3v12" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="6" r="3" /><path stroke-linecap="round" stroke-linejoin="round" d="M18 9v3a3 3 0 01-3 3H6" /></svg>
                    Local
                  </div>
                  <div class="space-y-0.5">
                    <button
                      v-for="b in localBranches"
                      :key="`local-${b.name}`"
                      @click="switchTo(b.name)"
                      :disabled="b.current || switching"
                      class="flex items-center gap-2 w-full text-left px-2 py-1.5 rounded-md text-sm transition-colors disabled:opacity-60"
                      :class="b.current ? 'bg-surface-subtle text-content' : 'text-content-muted hover:text-content hover:bg-surface-subtle'"
                    >
                      <svg v-if="b.current" class="w-3.5 h-3.5 text-emerald-500 shrink-0" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" /></svg>
                      <svg v-else class="w-3.5 h-3.5 text-content-subtle shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 3v12" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="6" r="3" /><path stroke-linecap="round" stroke-linejoin="round" d="M18 9v3a3 3 0 01-3 3H6" /></svg>
                      <span class="font-mono truncate flex-1">{{ b.name }}</span>
                      <span v-if="switchingName === b.name" class="text-[10px] text-content-subtle">Switching...</span>
                      <span v-else-if="b.current" class="text-[10px] text-content-subtle">current</span>
                    </button>
                  </div>
                </div>

                <!-- Remote -->
                <div v-if="remoteBranches.length > 0">
                  <div class="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-content-subtle mb-1">
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3.6 9h16.8M3.6 9a2.4 2.4 0 00-2.4 2.4v3.6A2.4 2.4 0 003.6 17.4h16.8a2.4 2.4 0 002.4-2.4V11.4A2.4 2.4 0 0020.4 9M3.6 9V6.6A2.4 2.4 0 016 4.2h12a2.4 2.4 0 012.4 2.4V9" /></svg>
                    Remote
                  </div>
                  <div class="space-y-0.5">
                    <button
                      v-for="b in remoteBranches"
                      :key="`remote-${b.remoteName}-${b.name}`"
                      @click="switchTo(b.name)"
                      :disabled="isRemoteCurrent(b) || switching"
                      class="flex items-center gap-2 w-full text-left px-2 py-1.5 rounded-md text-sm transition-colors disabled:opacity-60"
                      :class="isRemoteCurrent(b) ? 'bg-surface-subtle text-content' : 'text-content-muted hover:text-content hover:bg-surface-subtle'"
                    >
                      <svg class="w-3.5 h-3.5 text-content-subtle shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3.6 9h16.8M3.6 9a2.4 2.4 0 00-2.4 2.4v3.6A2.4 2.4 0 003.6 17.4h16.8a2.4 2.4 0 002.4-2.4V11.4A2.4 2.4 0 0020.4 9M3.6 9V6.6A2.4 2.4 0 016 4.2h12a2.4 2.4 0 012.4 2.4V9" /></svg>
                      <span class="font-mono truncate flex-1">{{ b.name }}</span>
                      <span v-if="b.remoteName" class="text-[10px] text-content-subtle shrink-0">{{ b.remoteName }}</span>
                      <span v-if="switchingName === b.name" class="text-[10px] text-content-subtle shrink-0">Switching...</span>
                      <span v-else-if="isRemoteCurrent(b)" class="text-[10px] text-content-subtle shrink-0">current</span>
                    </button>
                  </div>
                </div>

                <div v-if="localBranches.length === 0 && remoteBranches.length === 0 && !loading" class="text-xs text-content-subtle py-2">
                  No branches found.
                </div>
              </div>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
interface BranchInfo {
  name: string
  current: boolean
  remote: boolean
  remoteName: string | null
}

interface Props {
  open: boolean
  projectId: string | null | undefined
  currentBranch?: string | null
}

const props = withDefaults(defineProps<Props>(), {
  currentBranch: null,
})

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'switched', branch: string): void
}>()

const projectsApi = useProjects()

const newName = ref('')
const creating = ref(false)
const switching = ref(false)
const switchingName = ref<string | null>(null)
const loading = ref(false)
const error = ref('')
const success = ref('')
const overlayEl = ref<HTMLElement | null>(null)
const nameEl = ref<HTMLInputElement | null>(null)

const localBranches = ref<BranchInfo[]>([])
const remoteBranches = ref<BranchInfo[]>([])

function dismiss() {
  if (creating.value || switching.value) return
  emit('close')
}

function isRemoteCurrent(b: BranchInfo): boolean {
  return !b.current && b.name === props.currentBranch && localBranches.value.some((l) => l.name === b.name && l.current)
}

async function load() {
  if (!props.projectId) return
  loading.value = true
  error.value = ''
  try {
    const result = await projectsApi.branches(props.projectId)
    localBranches.value = result.local
    remoteBranches.value = result.remote
  } catch (err: unknown) {
    error.value = (err as { data?: { error?: string } })?.data?.error || 'Failed to load branches'
  } finally {
    loading.value = false
  }
}

async function createBranch() {
  if (!props.projectId || !newName.value.trim() || creating.value) return
  creating.value = true
  error.value = ''
  success.value = ''
  try {
    const result = await projectsApi.createBranch(props.projectId, newName.value.trim())
    success.value = `Created and switched to ${result.branch}`
    newName.value = ''
    emit('switched', result.branch)
    await load()
  } catch (err: unknown) {
    error.value = (err as { data?: { error?: string } })?.data?.error || 'Failed to create branch'
  } finally {
    creating.value = false
  }
}

async function switchTo(name: string) {
  if (!props.projectId || switching.value) return
  switching.value = true
  switchingName.value = name
  error.value = ''
  success.value = ''
  try {
    const result = await projectsApi.checkout(props.projectId, name)
    success.value = `Switched to ${result.branch}`
    emit('switched', result.branch)
    await load()
  } catch (err: unknown) {
    error.value = (err as { data?: { error?: string } })?.data?.error || 'Failed to switch branch'
  } finally {
    switching.value = false
    switchingName.value = null
  }
}

watch(() => props.open, (open) => {
  if (!open) return
  newName.value = ''
  error.value = ''
  success.value = ''
  localBranches.value = []
  remoteBranches.value = []
  nextTick(() => {
    load()
    nameEl.value?.focus()
  })
})
</script>
