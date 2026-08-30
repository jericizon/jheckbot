<template>
  <div class="flex h-[100dvh] overflow-hidden bg-surface text-content">
    <ConversationSidebar
      :conversations="conversations"
      :active-conversations="activeConversations"
      :current-project-id="id"
      :loading="convLoading"
      @new="newConversation"
      @delete="deleteConversation"
      @rename="handleSidebarRename"
      @pin="togglePin"
    />

    <!-- Main content area -->
    <div class="flex-1 flex flex-col h-full min-w-0">
      <!-- Header -->
      <ProjectHeader
        :project="project"
        :branch="projectBranch"
        show-back
        @project-updated="onProjectUpdated"
        @project-deleted="onProjectDeleted"
        @branch-switched="handleBranchSwitched"
      />

      <!-- Content -->
      <div class="flex-1 overflow-y-auto">
        <div class="max-w-4xl mx-auto px-4 py-6 space-y-6">
          <!-- Office scene -->
          <div v-if="project" class="animate-fade-in">
            <OfficeScene
              :agents="officeAgents"
              :ceo="ceo"
              :employees="employees"
              :loading="officeLoading"
              :agent-messages="agentMessages"
            />
          </div>

          <!-- Office workspace -->
          <div v-if="project && officeId" class="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in">
            <OfficeTaskPanel :tasks="tasks" :loading="tasksLoading" />
            <OfficeActivityPanel :events="events" :loading="eventsLoading" />
          </div>
        </div>
      </div>

      <!-- Changed files panel (list, diff preview, commit) -->
      <ChangedFilesPanel :project-id="project?.id" />

      <!-- Conversation starter -->
      <div
        v-if="project"
        class="shrink-0 border-t border-border bg-surface px-4 pt-2 pb-[calc(1rem+env(safe-area-inset-bottom))]"
      >
        <div class="max-w-2xl mx-auto animate-fade-in">
          <p class="text-content-subtle text-xs font-medium mb-2 text-center">
            Start a conversation
          </p>
          <div
            class="relative rounded-2xl border border-border bg-surface-elevated focus-within:border-content-subtle transition-colors"
          >
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
              style="min-height: 52px"
            />
            <button
              @click="sendMessage"
              :disabled="!input.trim() || sending"
              class="absolute right-2 bottom-2 rounded-lg w-8 h-8 flex items-center justify-center transition-all shrink-0 active:scale-95"
              :class="
                input.trim() && !sending
                  ? 'bg-content text-surface hover:opacity-80'
                  : 'bg-surface-subtle text-content-subtle'
              "
            >
              <svg
                class="w-4 h-4"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M5 10l7-7m0 0l7 7m-7-7v18"
                />
              </svg>
            </button>
          </div>

          <!-- Model selector + bypass toggle + skills -->
          <MessageToolbar
            v-model="selectedModel"
            :families="availableFamilies"
            v-model:bypass-mode="bypassMode"
            :disabled="sending"
            @open-skills="skillsPickerOpen = true"
            @open-models="modelPickerOpen = true"
          />

          <p v-if="sendError" class="mt-3 text-sm text-red-500">{{ sendError }}</p>
        </div>
      </div>
    </div>

    <!-- Delete conversation modal -->
    <ConfirmModal
      :open="convDeleteModalOpen"
      title="Delete Conversation"
      :message="
        convDeleteTarget
          ? `Delete \u201C${convDeleteTargetTitle}\u201D? This cannot be undone.`
          : 'Delete this conversation? This cannot be undone.'
      "
      confirm-label="Yes, delete"
      loading-label="Deleting..."
      :loading="deletingConv"
      :error="convDeleteError"
      @confirm="confirmDeleteConversation"
      @cancel="closeConvDeleteModal"
    />

    <!-- Skills picker -->
    <SkillsPicker
      :open="skillsPickerOpen"
      @select="insertSkill"
      @close="skillsPickerOpen = false"
    />

    <!-- Model picker -->
    <ModelPicker
      :open="modelPickerOpen"
      :families="availableFamilies"
      :current="selectedModel"
      @select="selectedModel = $event"
      @close="modelPickerOpen = false"
    />
  </div>
</template>

<script setup lang="ts">
import type { ModelFamily } from '~/components/MessageToolbar.vue'
import type { OfficeAgent, OfficeEvent, OfficeTask } from '@jheckbot/shared'
import { findCeo, findEmployees } from '~/composables/useOffice'
import { useTasks } from '~/composables/useTasks'
import { useOfficeEvents } from '~/composables/useOfficeEvents'
import OfficeTaskPanel from '~/components/office/OfficeTaskPanel.vue'
import OfficeActivityPanel from '~/components/office/OfficeActivityPanel.vue'

const route = useRoute()
const projectsApi = useProjects()
const convApi = useConversations()
const officesApi = useOffices()
const tasksApi = useTasks()
const eventsApi = useOfficeEvents()
const { activeConversations, refresh: refreshActiveConversations } = useActiveConversations()

const id = computed(() => route.params.id as string)

interface Project {
  id: string
  name: string
  path: string
  description: string | null
  enabled: boolean
}
interface Conversation {
  id: string
  title: string
  agent_status: string
  is_pinned: boolean
  last_message_at: string | null
  created_at: string
}

const project = ref<Project | null>(null)
const conversations = ref<Conversation[]>([])
const convLoading = ref(true)
const projectBranch = ref<string | null>(null)

const officeAgents = ref<OfficeAgent[]>([])
const officeLoading = ref(false)
const officeId = ref<string>('')

const tasks = ref<OfficeTask[]>([])
const events = ref<OfficeEvent[]>([])
const tasksLoading = ref(false)
const eventsLoading = ref(false)
const agentMessages = ref<Record<string, string>>({})
let unsubscribeEvents: (() => void) | null = null

const ceo = computed(() => findCeo(officeAgents.value))
const employees = computed(() => findEmployees(officeAgents.value, ceo.value))

useConversationPolling(
  () => project.value?.id,
  (convs) => {
    conversations.value = convs
  },
)

const input = ref('')
const inputEl = ref<HTMLTextAreaElement | null>(null)
const sending = ref(false)
const sendError = ref('')
const skillsPickerOpen = ref(false)
const modelPickerOpen = ref(false)
const { bypassMode } = useBypassMode()

const availableFamilies = ref<ModelFamily[]>([])
const { selectedModel, ensureDefault } = useSelectedModel()

function autoResize() {
  const el = inputEl.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = Math.min(el.scrollHeight, 128) + 'px'
}

function insertSkill(command: string) {
  input.value = input.value ? `${input.value} ${command}`.trim() : command
  nextTick(() => {
    inputEl.value?.focus()
    autoResize()
  })
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
    availableFamilies.value = modelsRes.families
    ensureDefault(modelsRes.default)
    projectsApi
      .branch(id.value)
      .then((r) => {
        projectBranch.value = r.branch
      })
      .catch(() => {
        projectBranch.value = null
      })
  } catch {
    // ignore
  } finally {
    convLoading.value = false
  }
}

async function loadOffice() {
  if (!project.value) return
  officeLoading.value = true
  try {
    const result = await officesApi.getOrCreateByProject(project.value.id)
    officeId.value = result.office.id
    officeAgents.value = result.agents
    pruneIdleMessages(result.agents)
  } catch {
    officeAgents.value = []
    officeId.value = ''
  } finally {
    officeLoading.value = false
  }
}

// Drop speech bubbles for agents that are no longer active so stale messages
// don't linger once work is done.
function pruneIdleMessages(next: OfficeAgent[]) {
  const active = next.filter((a) => a.status !== 'idle' && a.status !== 'completed')
  if (active.length === 0) {
    if (Object.keys(agentMessages.value).length > 0) agentMessages.value = {}
    return
  }
  const activeIds = new Set(active.map((a) => a.id))
  const pruned: Record<string, string> = {}
  for (const [id, msg] of Object.entries(agentMessages.value)) {
    if (activeIds.has(id)) pruned[id] = msg
  }
  agentMessages.value = pruned
}

async function loadTasks() {
  if (!officeId.value) return
  tasksLoading.value = true
  try {
    tasks.value = await tasksApi.listByOffice(officeId.value)
  } catch {
    tasks.value = []
  } finally {
    tasksLoading.value = false
  }
}

function isTaskEvent(eventType: string) {
  return eventType.startsWith('TASK_')
}

function isAgentEvent(eventType: string) {
  return eventType.startsWith('AGENT_')
}

function handleLiveEvent(event: OfficeEvent) {
  if (events.value.some((e) => e.id === event.id)) return
  events.value = [event, ...events.value]
  if (isTaskEvent(event.eventType)) {
    loadTasks()
  }
  if (isAgentEvent(event.eventType)) {
    loadOffice()
  }
  // Show agent-to-agent speech bubbles for the latest AGENT_MESSAGE.
  if (event.eventType === 'AGENT_MESSAGE' && event.metadata?.fromAgentId) {
    const from = event.metadata.fromAgentId as string
    agentMessages.value = { ...agentMessages.value, [from]: event.content ?? '' }
  }
}

async function loadEvents() {
  if (unsubscribeEvents) {
    unsubscribeEvents()
    unsubscribeEvents = null
  }
  if (!officeId.value) return
  eventsLoading.value = true
  try {
    events.value = await eventsApi.listByOffice(officeId.value)
    unsubscribeEvents = eventsApi.subscribeToOffice(officeId.value, handleLiveEvent)
  } catch {
    events.value = []
  } finally {
    eventsLoading.value = false
  }
}

function handleBranchSwitched(branch: string) {
  projectBranch.value = branch
}

function onProjectUpdated(updated: Project) {
  project.value = updated
}

async function onProjectDeleted() {
  await navigateTo('/projects')
}

function newConversation() {
  input.value = ''
  sendError.value = ''
  nextTick(() => {
    inputEl.value?.focus()
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

async function togglePin(convId: string, isPinned: boolean) {
  try {
    await convApi.update(convId, { isPinned })
    const [convs] = await Promise.all([convApi.listByProject(id.value), refreshActiveConversations()])
    conversations.value = convs
  } catch {
    // Ignore; the next poll will reconcile.
  }
}

const convDeleteModalOpen = ref(false)
const convDeleteTarget = ref<string | null>(null)
const deletingConv = ref(false)
const convDeleteError = ref('')

const convDeleteTargetTitle = computed(
  () =>
    conversations.value.find((c) => c.id === convDeleteTarget.value)?.title ?? 'this conversation',
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
    convDeleteError.value =
      (err as { data?: { error?: string } })?.data?.error || 'Failed to delete conversation'
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
    const message =
      err && typeof err === 'object' && 'data' in err
        ? (err as { data?: { error?: string } }).data?.error
        : err instanceof Error
          ? err.message
          : 'Failed to start conversation'
    sendError.value = message ?? 'Failed to start conversation'
    sending.value = false
  }
}

onMounted(async () => {
  await load()
  await loadOffice()
  await loadTasks()
  await loadEvents()
})

onUnmounted(() => {
  if (unsubscribeEvents) {
    unsubscribeEvents()
    unsubscribeEvents = null
  }
})

watch(
  () => id.value,
  async () => {
    await load()
    await loadOffice()
    await loadTasks()
    await loadEvents()
  },
)
</script>
