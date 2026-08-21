<template>
  <div class="flex h-[100dvh] overflow-hidden bg-surface text-content">
    <ConversationSidebar
      :conversations="conversations"
      :loading="convLoading"
      @new="newConversation"
      @delete="deleteConversation"
      @rename="handleSidebarRename"
    />

    <!-- Main content area -->
    <div class="flex-1 flex flex-col h-full min-w-0">
      <!-- Header -->
      <header class="flex items-center gap-3 px-4 py-3 border-b border-border shrink-0">
        <button
          @click="toggleSidebar"
          class="text-content-muted hover:text-content transition-colors p-1 -ml-1 rounded-md hover:bg-surface-subtle"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16" /></svg>
        </button>
        <button
          @click="navigateTo('/projects')"
          class="text-content-subtle hover:text-content transition-colors p-1 rounded-md hover:bg-surface-subtle"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" /></svg>
        </button>
        <h1 class="flex-1 text-sm font-semibold truncate">{{ project?.name || 'Project' }}</h1>
        <button
          v-if="project && !editing && !confirmingDelete"
          @click="startEdit"
          class="text-content-muted hover:text-content transition-colors p-1.5 rounded-md hover:bg-surface-subtle"
          title="Edit project"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
        </button>
        <button
          v-if="project && !editing && !confirmingDelete"
          @click="confirmingDelete = true"
          class="text-content-muted hover:text-red-500 transition-colors p-1.5 rounded-md hover:bg-surface-subtle"
          title="Delete project"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
        </button>
        <button
          @click="toggleTheme"
          class="text-content-muted hover:text-content transition-colors p-1.5 rounded-md hover:bg-surface-subtle"
          :title="theme === 'dark' ? 'Switch to light' : 'Switch to dark'"
        >
          <svg v-if="theme === 'dark'" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
          <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
        </button>
      </header>

      <!-- Content -->
      <div class="flex-1 overflow-y-auto">
        <div class="max-w-2xl mx-auto px-4 py-8 space-y-6">
          <!-- Edit form -->
          <div v-if="project && editing" class="rounded-lg border border-border bg-surface-elevated p-4 space-y-3 animate-slide-up">
            <div class="text-sm font-semibold">Edit Project</div>
            <input v-model="editForm.name" placeholder="Project name" class="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-content placeholder-content-subtle focus:border-content-subtle focus:outline-none transition-colors" />
            <input v-model="editForm.description" placeholder="Description (optional)" class="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-content placeholder-content-subtle focus:border-content-subtle focus:outline-none transition-colors" />
            <p class="text-xs text-content-subtle">Path cannot be changed after creation: <span class="font-mono break-all">{{ project.path }}</span></p>
            <div class="flex gap-2">
              <button @click="cancelEdit" :disabled="saving" class="flex-1 rounded-lg border border-border py-2 text-sm font-medium text-content-muted hover:text-content hover:border-content-subtle transition-colors disabled:opacity-50">
                Cancel
              </button>
              <button @click="saveEdit" :disabled="saving" class="flex-1 rounded-lg bg-content text-surface py-2 text-sm font-medium hover:opacity-80 disabled:opacity-50 transition-opacity active:scale-[0.98]">
                {{ saving ? 'Saving...' : 'Save' }}
              </button>
            </div>
            <p v-if="editError" class="text-sm text-red-500">{{ editError }}</p>
          </div>

          <!-- Delete confirmation -->
          <div v-else-if="project && confirmingDelete" class="rounded-lg border border-red-500/30 bg-surface-elevated p-4 space-y-3">
            <div class="text-sm font-semibold text-red-500">Delete Project</div>
            <div class="text-xs text-content-subtle">
              Delete <span class="font-medium text-content">{{ project.name }}</span> and all its conversations. This cannot be undone.
            </div>
            <div class="flex gap-2">
              <button @click="confirmingDelete = false" :disabled="deleting" class="flex-1 rounded-lg border border-border py-2 text-sm font-medium text-content-muted hover:text-content hover:border-content-subtle transition-colors disabled:opacity-50">
                Cancel
              </button>
              <button @click="handleDelete" :disabled="deleting" class="flex-1 rounded-lg bg-red-500 text-white py-2 text-sm font-medium hover:bg-red-600 disabled:opacity-50 transition-colors">
                {{ deleting ? 'Deleting...' : 'Yes, delete' }}
              </button>
            </div>
            <p v-if="deleteError" class="text-sm text-red-500">{{ deleteError }}</p>
          </div>

          <!-- Conversation box -->
          <div v-else-if="project" class="flex flex-col items-center justify-center min-h-[60vh] animate-fade-in">
            <div class="w-12 h-12 rounded-full bg-surface-subtle flex items-center justify-center mb-4">
              <svg class="w-6 h-6 text-content-subtle" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 3v-3z" /></svg>
            </div>
            <p class="text-content text-sm font-medium mb-1">{{ project.name }}</p>
            <p v-if="project.description" class="text-content-muted text-xs mb-1">{{ project.description }}</p>
            <p class="text-content-subtle text-xs font-mono break-all mb-6">{{ project.path }}</p>

            <!-- Input box -->
            <div class="w-full relative rounded-2xl border border-border bg-surface-elevated focus-within:border-content-subtle transition-colors">
              <textarea
                v-model="input"
                @keydown.enter.exact.prevent="sendMessage"
                @keydown.enter.shift.exact="input += '\n'"
                @input="autoResize"
                placeholder="Message Devin..."
                rows="1"
                ref="inputEl"
                :disabled="sending"
                class="w-full rounded-2xl px-4 py-3.5 pr-12 text-sm text-content placeholder-content-subtle focus:outline-none resize-none max-h-32 overflow-y-auto disabled:opacity-50"
                style="min-height: 52px;"
              />
              <button
                @click="sendMessage"
                :disabled="!input.trim() || sending"
                class="absolute right-2 bottom-2 rounded-lg w-8 h-8 flex items-center justify-center transition-all shrink-0 active:scale-95"
                :class="input.trim() && !sending ? 'bg-content text-surface hover:opacity-80' : 'bg-surface-subtle text-content-subtle'"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
              </button>
            </div>

            <!-- Model selector + bypass toggle + hint -->
            <div class="w-full flex items-center justify-between mt-2 px-1 gap-2">
              <div class="flex items-center gap-3">
                <select
                  v-model="selectedModel"
                  :disabled="sending"
                  class="text-xs text-content-muted bg-transparent border-none focus:outline-none cursor-pointer disabled:opacity-50"
                >
                  <optgroup v-for="group in modelGroups" :key="group.label" :label="group.label">
                    <option v-for="m in group.models" :key="m.id" :value="m.id" class="bg-surface-elevated text-content">
                      {{ m.label }}{{ m.free ? ' (Free)' : '' }}
                    </option>
                  </optgroup>
                </select>
                <button
                  @click="toggleBypass"
                  :disabled="sending"
                  class="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium border transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  :class="bypassMode
                    ? 'bg-amber-500/15 border-amber-500/40 text-amber-500'
                    : 'bg-transparent border-border text-content-subtle hover:text-content-muted hover:border-content-subtle'"
                  :title="bypassMode ? 'Bypass mode ON: Devin will auto-approve all tools without asking' : 'Bypass mode OFF: Devin will ask for permission on risky actions'"
                  :aria-pressed="bypassMode"
                >
                  <svg v-if="bypassMode" class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8 11V7a4 4 0 118 0m-4 4v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" /></svg>
                  <svg v-else class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                  <span>Bypass {{ bypassMode ? 'On' : 'Off' }}</span>
                </button>
                <button
                  @click="checkHealth"
                  :disabled="healthLoading"
                  class="text-xs text-content-muted hover:text-content transition-colors disabled:opacity-50"
                >
                  {{ healthLoading ? 'Checking...' : 'Health' }}
                </button>
              </div>
              <p class="text-xs text-content-subtle shrink-0">Enter to send, Shift+Enter for new line</p>
            </div>

            <p v-if="sendError" class="mt-3 text-sm text-red-500">{{ sendError }}</p>

            <!-- Health details -->
            <div v-if="health" class="w-full mt-4 grid grid-cols-2 gap-2 text-xs">
              <div class="flex items-center gap-2" :class="health.directory ? 'text-emerald-500' : 'text-content-subtle'">
                <span>{{ health.directory ? '✓' : '○' }}</span> Directory
              </div>
              <div class="flex items-center gap-2" :class="health.accessible ? 'text-emerald-500' : 'text-content-subtle'">
                <span>{{ health.accessible ? '✓' : '○' }}</span> Accessible
              </div>
              <div class="flex items-center gap-2" :class="health.gitRepository ? 'text-emerald-500' : 'text-content-subtle'">
                <span>{{ health.gitRepository ? '✓' : '○' }}</span> Git
              </div>
              <div class="flex items-center gap-2" :class="health.nodeProject ? 'text-emerald-500' : 'text-content-subtle'">
                <span>{{ health.nodeProject ? '✓' : '○' }}</span> Node
              </div>
              <div class="flex items-center gap-2" :class="health.pnpmProject ? 'text-emerald-500' : 'text-content-subtle'">
                <span>{{ health.pnpmProject ? '✓' : '○' }}</span> pnpm
              </div>
              <div class="flex items-center gap-2" :class="health.dockerProject ? 'text-emerald-500' : 'text-content-subtle'">
                <span>{{ health.dockerProject ? '✓' : '○' }}</span> Docker
              </div>
              <div class="flex items-center gap-2" :class="health.devinCli ? 'text-emerald-500' : 'text-content-subtle'">
                <span>{{ health.devinCli ? '✓' : '○' }}</span> Devin CLI
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Delete conversation modal -->
    <ConfirmModal
      :open="convDeleteModalOpen"
      title="Delete Conversation"
      :message="convDeleteTarget
        ? `Delete \u201C${convDeleteTargetTitle}\u201D? This cannot be undone.`
        : 'Delete this conversation? This cannot be undone.'"
      confirm-label="Yes, delete"
      loading-label="Deleting..."
      :loading="deletingConv"
      :error="convDeleteError"
      @confirm="confirmDeleteConversation"
      @cancel="closeConvDeleteModal"
    />
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const projectsApi = useProjects()
const convApi = useConversations()
const { theme, toggle: toggleTheme } = useTheme()
const { sidebarOpen, toggle: toggleSidebar } = useSidebar()

const id = computed(() => route.params.id as string)

interface Project { id: string; name: string; path: string; description: string | null; enabled: boolean }
interface Conversation { id: string; title: string; agent_status: string; last_message_at: string | null; created_at: string }
interface HealthResult { directory: boolean; accessible: boolean; gitRepository: boolean; nodeProject: boolean; pnpmProject: boolean; dockerProject: boolean; devinCli: boolean }

const project = ref<Project | null>(null)
const conversations = ref<Conversation[]>([])
const convLoading = ref(true)
const health = ref<HealthResult | null>(null)
const healthLoading = ref(false)

// Refresh sidebar statuses periodically so background agent runs in any
// conversation of this project surface without a manual reload.
useConversationPolling(
  () => project.value?.id,
  (convs) => { conversations.value = convs },
)

const editing = ref(false)
const saving = ref(false)
const editError = ref('')
const editForm = reactive({ name: '', description: '' })

const confirmingDelete = ref(false)
const deleting = ref(false)
const deleteError = ref('')

const input = ref('')
const inputEl = ref<HTMLTextAreaElement | null>(null)
const sending = ref(false)
const sendError = ref('')
const { bypassMode, toggle: toggleBypass } = useBypassMode()

interface ModelOption { id: string; label: string; family: string; context: string; pricing: string; free: boolean }
const availableModels = ref<ModelOption[]>([])
const selectedModel = ref('glm-5-2')

const modelGroups = computed(() => {
  const groups: { label: string; models: ModelOption[] }[] = [
    { label: 'Free', models: [] },
    { label: 'Budget', models: [] },
    { label: 'Mid-range', models: [] },
    { label: 'Premium', models: [] },
  ]
  for (const m of availableModels.value) {
    if (m.free) groups[0].models.push(m)
    else if (m.pricing.includes('$0.') || m.pricing.includes('$1.')) groups[1].models.push(m)
    else if (m.pricing.includes('$2.') || m.pricing.includes('$3.')) groups[2].models.push(m)
    else groups[3].models.push(m)
  }
  return groups.filter((g) => g.models.length > 0)
})

function autoResize() {
  const el = inputEl.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = Math.min(el.scrollHeight, 128) + 'px'
}

async function load() {
  try {
    const [proj, convs, modelsRes] = await Promise.all([
      projectsApi.get(id.value),
      convApi.listByProject(id.value),
      convApi.models(),
    ])
    project.value = proj
    conversations.value = convs
    availableModels.value = modelsRes.models
    selectedModel.value = modelsRes.default
  } catch {
    // ignore
  } finally {
    convLoading.value = false
  }
}

async function checkHealth() {
  healthLoading.value = true
  try {
    health.value = await projectsApi.health(id.value)
  } catch {
    // ignore
  } finally {
    healthLoading.value = false
  }
}

function startEdit() {
  if (!project.value) return
  editForm.name = project.value.name
  editForm.description = project.value.description ?? ''
  editError.value = ''
  editing.value = true
}

function cancelEdit() {
  editing.value = false
  editError.value = ''
}

async function saveEdit() {
  if (!project.value) return
  saving.value = true
  editError.value = ''
  try {
    const updated = await projectsApi.update(project.value.id, {
      name: editForm.name,
      description: editForm.description || undefined,
    })
    project.value = updated
    editing.value = false
  } catch (err: unknown) {
    editError.value = (err as { data?: { error?: string } })?.data?.error || 'Failed to save project'
  } finally {
    saving.value = false
  }
}

async function handleDelete() {
  if (!project.value) return
  deleting.value = true
  deleteError.value = ''
  try {
    await projectsApi.delete(project.value.id)
    await navigateTo('/projects')
  } catch (err: unknown) {
    deleteError.value = (err as { data?: { error?: string } })?.data?.error || 'Failed to delete project'
  } finally {
    deleting.value = false
  }
}

function newConversation() {
  // Focus the create-conversation input box instead of creating an empty conversation via API.
  input.value = ''
  sendError.value = ''
  nextTick(() => {
    inputEl.value?.focus()
    inputEl.value?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  })
}

async function handleSidebarRename(convId: string, newTitle: string) {
  try {
    const updated = await convApi.update(convId, { title: newTitle })
    const conv = conversations.value.find((c) => c.id === convId)
    if (conv) conv.title = updated.title
  } catch {
    // Keep old title on failure
  }
}

const convDeleteModalOpen = ref(false)
const convDeleteTarget = ref<string | null>(null)
const deletingConv = ref(false)
const convDeleteError = ref('')

const convDeleteTargetTitle = computed(() =>
  conversations.value.find((c) => c.id === convDeleteTarget.value)?.title
  ?? 'this conversation',
)

function deleteConversation(convId: string) {
  convDeleteTarget.value = convId
  convDeleteError.value = ''
  convDeleteModalOpen.value = true
}

function closeConvDeleteModal() {
  if (deletingConv.value) return
  convDeleteModalOpen.value = false
  convDeleteTarget.value = null
  convDeleteError.value = ''
}

async function confirmDeleteConversation() {
  const convId = convDeleteTarget.value
  if (!convId) return
  deletingConv.value = true
  convDeleteError.value = ''
  try {
    await convApi.delete(convId)
    conversations.value = conversations.value.filter((c) => c.id !== convId)
    convDeleteModalOpen.value = false
    convDeleteTarget.value = null
  } catch (err: unknown) {
    convDeleteError.value = (err as { data?: { error?: string } })?.data?.error || 'Failed to delete conversation'
  } finally {
    deletingConv.value = false
  }
}

async function sendMessage() {
  const prompt = input.value.trim()
  if (!prompt || sending.value) return

  sending.value = true
  sendError.value = ''
  try {
    const conv = await convApi.create(id.value)
    await convApi.sendMessage(conv.id, prompt, selectedModel.value, bypassMode.value)
    await navigateTo(`/conversations/${conv.id}`)
  } catch (err: unknown) {
    const message = err && typeof err === 'object' && 'data' in err
      ? (err as { data?: { error?: string } }).data?.error
      : err instanceof Error ? err.message : 'Failed to start conversation'
    sendError.value = message ?? 'Failed to start conversation'
    sending.value = false
  }
}

onMounted(load)
</script>
