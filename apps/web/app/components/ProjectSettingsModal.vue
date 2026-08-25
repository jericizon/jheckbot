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
            aria-label="Project settings"
            class="w-full max-w-sm max-h-[85vh] flex flex-col rounded-xl border border-border bg-surface-elevated shadow-xl overflow-hidden"
          >
            <!-- Header -->
            <div class="flex items-center gap-2 px-4 py-3 border-b border-border shrink-0">
              <button
                v-if="view !== 'menu'"
                @click="view = 'menu'"
                class="p-1 rounded-md text-content-subtle hover:text-content hover:bg-surface-subtle transition-colors shrink-0"
                aria-label="Back to project settings"
                title="Back"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" /></svg>
              </button>
              <svg v-else class="w-4 h-4 text-content-muted shrink-0" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              <h2 class="text-sm font-semibold text-content flex-1">{{ title }}</h2>
              <button
                @click="dismiss"
                class="p-1 rounded-md text-content-subtle hover:text-content hover:bg-surface-subtle transition-colors shrink-0"
                title="Close (Esc)"
                aria-label="Close project settings"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <!-- Body -->
            <div class="flex-1 overflow-y-auto p-4">
              <!-- Menu -->
              <div v-if="view === 'menu'" class="space-y-1">
                <button
                  @click="startEdit"
                  class="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-content hover:bg-surface-subtle transition-colors text-left"
                >
                  <svg class="w-4 h-4 text-content-subtle shrink-0" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                  <span class="flex-1">Edit project details</span>
                </button>
                <button
                  @click="view = 'delete'"
                  class="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-red-500 hover:bg-red-500/5 transition-colors text-left"
                >
                  <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  <span class="flex-1">Delete project</span>
                </button>
              </div>

              <!-- Edit form -->
              <div v-else-if="view === 'edit'" class="space-y-3">
                <input
                  v-model="editForm.name"
                  placeholder="Project name"
                  class="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-content placeholder-content-subtle focus:border-content-subtle focus:outline-none transition-colors"
                />
                <input
                  v-model="editForm.description"
                  placeholder="Description (optional)"
                  class="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-content placeholder-content-subtle focus:border-content-subtle focus:outline-none transition-colors"
                />
                <p class="text-xs text-content-subtle">
                  Path cannot be changed after creation:
                  <span class="font-mono break-all">{{ project?.path }}</span>
                </p>
                <div class="flex gap-2">
                  <button
                    @click="view = 'menu'"
                    :disabled="saving"
                    class="flex-1 rounded-lg border border-border py-2 text-sm font-medium text-content-muted hover:text-content hover:border-content-subtle transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    @click="saveEdit"
                    :disabled="saving"
                    class="flex-1 rounded-lg bg-content text-surface py-2 text-sm font-medium hover:opacity-80 disabled:opacity-50 transition-opacity active:scale-[0.98]"
                  >
                    {{ saving ? 'Saving...' : 'Save' }}
                  </button>
                </div>
                <p v-if="editError" class="text-sm text-red-500">{{ editError }}</p>
              </div>

              <!-- Delete confirmation -->
              <div v-else-if="view === 'delete'" class="space-y-3">
                <p class="text-sm text-content">
                  Delete <span class="font-medium">{{ project?.name }}</span> and all its conversations. This cannot be undone.
                </p>
                <div class="flex gap-2">
                  <button
                    @click="view = 'menu'"
                    :disabled="deleting"
                    class="flex-1 rounded-lg border border-border py-2 text-sm font-medium text-content-muted hover:text-content hover:border-content-subtle transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    @click="confirmDelete"
                    :disabled="deleting"
                    class="flex-1 rounded-lg bg-red-500 text-white py-2 text-sm font-medium hover:bg-red-600 disabled:opacity-50 transition-colors active:scale-[0.98]"
                  >
                    {{ deleting ? 'Deleting...' : 'Yes, delete' }}
                  </button>
                </div>
                <p v-if="deleteError" class="text-sm text-red-500">{{ deleteError }}</p>
              </div>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
interface Project {
  id: string
  name: string
  path: string
  description: string | null
  enabled: boolean
}

interface Props {
  open: boolean
  project: Project | null
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'close'): void
  (e: 'updated', project: Project): void
  (e: 'deleted'): void
}>()

const projectsApi = useProjects()

const view = ref<'menu' | 'edit' | 'delete'>('menu')
const saving = ref(false)
const editError = ref('')
const deleting = ref(false)
const deleteError = ref('')
const overlayEl = ref<HTMLElement | null>(null)

const editForm = reactive({
  name: '',
  description: '',
})

const title = computed(() => {
  if (view.value === 'edit') return 'Edit Project'
  if (view.value === 'delete') return 'Delete Project'
  return 'Project Settings'
})

function dismiss() {
  if (saving.value || deleting.value) return
  emit('close')
}

function startEdit() {
  if (!props.project) return
  editForm.name = props.project.name
  editForm.description = props.project.description ?? ''
  editError.value = ''
  view.value = 'edit'
}

async function saveEdit() {
  if (!props.project) return
  saving.value = true
  editError.value = ''
  try {
    const updated = await projectsApi.update(props.project.id, {
      name: editForm.name,
      description: editForm.description || undefined,
    })
    emit('updated', updated)
    view.value = 'menu'
  } catch (err: unknown) {
    editError.value = (err as { data?: { error?: string } })?.data?.error || 'Failed to save project'
  } finally {
    saving.value = false
  }
}

async function confirmDelete() {
  if (!props.project) return
  deleting.value = true
  deleteError.value = ''
  try {
    await projectsApi.delete(props.project.id)
    emit('deleted')
  } catch (err: unknown) {
    deleteError.value = (err as { data?: { error?: string } })?.data?.error || 'Failed to delete project'
  } finally {
    deleting.value = false
  }
}

// Reset view and errors each time the modal opens.
watch(() => props.open, (open) => {
  if (!open) return
  view.value = 'menu'
  editError.value = ''
  deleteError.value = ''
  nextTick(() => overlayEl.value?.focus())
})
</script>
