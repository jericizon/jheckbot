<template>
  <div class="flex h-[100dvh] overflow-hidden bg-surface text-content">
    <ConversationSidebar
      v-show="!fullscreen"
      :conversations="conversations"
      :active-conversations="activeConversations"
      :current-project-id="id"
      :loading="convLoading"
      @new="newConversation"
      @delete="deleteConversation"
      @rename="handleSidebarRename"
      @pin="togglePin"
    />

    <!-- Main content: office scene -->
    <div v-show="!fullscreen" class="flex-1 flex flex-col h-full min-w-0">
      <AppHeader class="shrink-0">
        <template #leading>
          <button
            @click="toggleSidebar"
            class="xl:hidden p-1.5 -ml-1 rounded-md text-content-subtle hover:text-content hover:bg-surface-subtle transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="Toggle sidebar"
            title="Toggle sidebar"
          >
            <svg
              class="w-5 h-5"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              viewBox="0 0 24 24"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </template>

        <div class="flex flex-col min-w-0">
          <h2 class="text-sm font-semibold text-content">Office</h2>
          <p v-if="project" class="text-[10px] text-content-subtle truncate">{{ project.name }}</p>
        </div>

        <template #actions>
          <button
            @click="toggleFullscreen"
            class="p-1.5 rounded-md text-content-subtle hover:text-content hover:bg-surface-subtle transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
            :aria-label="fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'"
            :title="fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'"
          >
            <svg
              v-if="!fullscreen"
              class="w-5 h-5"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              viewBox="0 0 24 24"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d="M4 8V4m0 0h4M4 4l4 4m8-4h4m0 0v4m0-4l-4 4M4 16v4m0 0h4m-4 0l4-4m8 4h4m0 0v-4m0 4l-4-4" />
            </svg>
            <svg
              v-else
              class="w-5 h-5"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              viewBox="0 0 24 24"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 4v4m0-4L5 8m10-4h4m0 0v4m0-4l-4 4M9 20v-4m0 4l-4-4m10 4h4m0 0v-4m0 4l-4-4" />
            </svg>
          </button>
        </template>
      </AppHeader>

      <div class="flex-1 min-h-0">
        <OfficePixi
          v-if="project"
          ref="officePixiRef"
          :agents="officeAgents"
          :ceo="ceo"
          :employees="employees"
          :loading="officeLoading"
          :agent-messages="agentMessages"
          :fullscreen="fullscreen"
          full-height
          @open-ceo-chat="ceoChatOpen = true"
          @toggle-fullscreen="toggleFullscreen"
        />
      </div>
    </div>

    <!-- Fullscreen office overlay: office fills the viewport with the
         chatbox as a side panel beside it. Uses v-show (not v-if) so the
         container always exists in the DOM and can be passed to
         requestFullscreen() synchronously within the click handler. -->
    <div
      v-show="fullscreen && project"
      class="fixed inset-0 z-50 flex bg-[#1c1c22]"
    >
      <!-- Office fills the remaining space -->
      <div class="flex-1 min-h-0 min-w-0 relative">
        <OfficePixi
          ref="officePixiFullscreenRef"
          :agents="officeAgents"
          :ceo="ceo"
          :employees="employees"
          :loading="officeLoading"
          :agent-messages="agentMessages"
          :fullscreen="fullscreen"
          full-height
          @open-ceo-chat="ceoChatOpen = true"
          @toggle-fullscreen="toggleFullscreen"
        />
      </div>

      <!-- Chatbox side panel -->
      <aside
        class="flex flex-col h-full min-w-0 border-l border-border bg-surface-elevated"
        :style="{ width: `${chatPanelWidth}px` }"
        aria-label="Project chat"
      >
        <!-- Resizer -->
        <div
          class="absolute top-0 left-0 w-1 h-full cursor-ew-resize hover:bg-content-subtle/20 active:bg-content-subtle/40 z-10"
          style="margin-left: -1px"
          role="separator"
          aria-label="Resize chat panel"
          aria-orientation="vertical"
          @mousedown="startChatResize"
        />

        <!-- Header with exit button -->
        <div class="flex items-center gap-2 border-b border-border px-3 py-3 shrink-0">
          <div class="flex-1 min-w-0">
            <h2 class="text-sm font-semibold text-content truncate">{{ project?.name }}</h2>
            <p class="text-[10px] text-content-subtle truncate">Office · Fullscreen</p>
          </div>
          <button
            @click="toggleFullscreen"
            class="p-1.5 rounded-md text-content-subtle hover:text-content hover:bg-surface-subtle transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="Exit fullscreen"
            title="Exit fullscreen"
          >
            <svg
              class="w-5 h-5"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              viewBox="0 0 24 24"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 4v4m0-4L5 8m10-4h4m0 0v4m0-4l-4 4M9 20v-4m0 4l-4-4m10 4h4m0 0v-4m0 4l-4-4" />
            </svg>
          </button>
        </div>

        <!-- Active task and activity -->
        <div class="flex-1 overflow-y-auto min-h-0">
          <div class="p-4 space-y-4">
            <OfficeTaskPanel :tasks="tasks" :loading="tasksLoading" />
            <OfficeActivityPanel :events="events" :loading="eventsLoading" />
          </div>
        </div>

        <ChangedFilesPanel :project-id="project?.id" />

        <!-- Chatbox -->
        <div class="shrink-0 pt-2 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <div class="w-full px-4">
            <div
              class="relative rounded-2xl border border-border bg-white focus-within:border-content-subtle/60 focus-within:ring-1 focus-within:ring-content-subtle/30 transition-all"
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
                class="w-full rounded-2xl px-4 py-3 pr-12 text-sm text-content placeholder-content-subtle dark:text-gray-900 dark:placeholder-gray-400 bg-transparent focus:outline-none resize-none max-h-32 overflow-y-auto disabled:opacity-50 min-h-[52px]"
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

            <MessageToolbar
              v-model="selectedModel"
              :families="availableFamilies"
              v-model:bypass-mode="bypassMode"
              :disabled="sending"
              @open-skills="skillsPickerOpen = true"
              @open-models="modelPickerOpen = true"
            >
              <template #actions>
                <button
                  @click="insertMediaPrompt"
                  class="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium border bg-transparent border-border text-content-subtle hover:text-content-muted hover:border-content-subtle transition-all shrink-0"
                  title="Insert media generation prompt"
                  aria-label="Insert media generation prompt"
                >
                  <svg
                    class="w-3.5 h-3.5"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                  <span>Media</span>
                </button>
              </template>
            </MessageToolbar>

            <p v-if="sendError" class="mt-3 text-sm text-red-500">{{ sendError }}</p>
          </div>
        </div>
      </aside>
    </div>

    <!-- Right side panel (chatbox + active task/activity) -->
    <aside
      v-show="!fullscreen"
      :class="[
        'flex-col h-full min-w-0 border-border bg-surface-elevated',
        mobileChatOpen ? 'fixed inset-0 z-30 w-full flex' : 'hidden xl:flex relative xl:border-l',
      ]"
      :style="mobileChatOpen ? { width: '100%' } : { width: `${chatPanelWidth}px` }"
      aria-label="Project chat"
    >
      <!-- Resizer (desktop only) -->
      <div
        class="hidden xl:block absolute top-0 left-0 w-1 h-full cursor-ew-resize hover:bg-content-subtle/20 active:bg-content-subtle/40 z-10"
        role="separator"
        aria-label="Resize chat panel"
        aria-orientation="vertical"
        @mousedown="startChatResize"
      />

      <!-- Header -->
      <ProjectHeader
        :project="project"
        :branch="projectBranch"
        show-back
        @project-updated="onProjectUpdated"
        @project-deleted="onProjectDeleted"
        @branch-switched="handleBranchSwitched"
      >
        <template #extra-actions>
          <button
            v-if="mobileChatOpen"
            @click="closeMobileChat"
            class="xl:hidden p-1.5 rounded-md text-content-subtle hover:text-content hover:bg-surface-subtle transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="Close chat"
            title="Close chat"
          >
            <svg
              class="w-5 h-5"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              viewBox="0 0 24 24"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </template>
      </ProjectHeader>

      <!-- Active task and activity (shown while there is no conversation) -->
      <div class="flex-1 overflow-y-auto min-h-0">
        <div class="p-4 space-y-4">
          <OfficeTaskPanel :tasks="tasks" :loading="tasksLoading" />
          <OfficeActivityPanel :events="events" :loading="eventsLoading" />
        </div>
      </div>

      <ChangedFilesPanel :project-id="project?.id" />

      <!-- Chatbox -->
      <div
        v-if="project"
        class="shrink-0 pt-2 pb-[calc(1rem+env(safe-area-inset-bottom))]"
      >
        <div class="w-full px-4">
          <div
            class="relative rounded-2xl border border-border bg-white focus-within:border-content-subtle/60 focus-within:ring-1 focus-within:ring-content-subtle/30 transition-all"
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
              class="w-full rounded-2xl px-4 py-3 pr-12 text-sm text-content placeholder-content-subtle dark:text-gray-900 dark:placeholder-gray-400 bg-transparent focus:outline-none resize-none max-h-32 overflow-y-auto disabled:opacity-50 min-h-[52px]"
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

          <MessageToolbar
            v-model="selectedModel"
            :families="availableFamilies"
            v-model:bypass-mode="bypassMode"
            :disabled="sending"
            @open-skills="skillsPickerOpen = true"
            @open-models="modelPickerOpen = true"
          >
            <template #actions>
              <button
                @click="insertMediaPrompt"
                class="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium border bg-transparent border-border text-content-subtle hover:text-content-muted hover:border-content-subtle transition-all shrink-0"
                title="Insert media generation prompt"
                aria-label="Insert media generation prompt"
              >
                <svg
                  class="w-3.5 h-3.5"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                <span>Media</span>
              </button>
            </template>
          </MessageToolbar>

          <p v-if="sendError" class="mt-3 text-sm text-red-500">{{ sendError }}</p>
        </div>
      </div>
    </aside>

    <!-- Mobile chat toggle -->
    <button
      v-if="chatViewportReady && !mobileChatOpen && !fullscreen"
      @click="openMobileChat"
      class="fixed bottom-4 right-4 z-20 xl:hidden rounded-full w-12 h-12 bg-content text-surface shadow-lg flex items-center justify-center active:scale-95 transition-transform"
      aria-label="Open chat"
      title="Open chat"
    >
      <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 0 01-2 2h-5l-5 3v-3z"
        />
      </svg>
    </button>

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

    <!-- CEO chat panel -->
    <CEOChatPanel
      :open="ceoChatOpen"
      :office-id="officeId"
      :project-id="id"
      @close="ceoChatOpen = false"
    />
  </div>
</template>

<script setup lang="ts">
import type { ModelFamily } from '~/components/MessageToolbar.vue'
import type { OfficeAgent, OfficeEvent, OfficeTask } from '@jheckbot/shared'
import { insertMediaPrompt as insertMediaPromptBase } from '~/utils/mediaPrompt'
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
const { toggle: toggleSidebar } = useSidebar()

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
const ceoChatOpen = ref(false)

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

// Right side panel state
const chatPanelWidth = ref(320)
const chatPanelMin = 260
const chatPanelMax = 480
const chatResizing = ref(false)
const chatResizeStartX = ref(0)
const chatResizeStartWidth = ref(0)
const mobileChatOpen = ref(false)
const chatViewportReady = ref(false)
const fullscreen = ref(false)
// Refs to the two OfficePixi instances so the page can trigger the
// collaboration choreography on the one that's currently visible.
const officePixiRef = ref<{ runCollaboration: () => void } | null>(null)
const officePixiFullscreenRef = ref<{ runCollaboration: () => void } | null>(null)

// Enter real browser fullscreen (covers the whole monitor) using the
// Fullscreen API. We fullscreen document.documentElement (always visible)
// rather than the overlay container, because the overlay uses v-show and
// may still be display:none when the click handler runs -- browsers reject
// requestFullscreen() on hidden elements. The overlay's fixed inset-0 z-50
// covers everything in fullscreen mode regardless of which element is
// fullscreened. requestFullscreen() must be called synchronously within
// the user-gesture (click) handler.
function toggleFullscreen() {
  if (fullscreen.value) {
    exitFullscreen()
    return
  }
  fullscreen.value = true
  const el = document.documentElement
  if (el && el.requestFullscreen) {
    el.requestFullscreen().catch(() => {
      // If the browser rejects, the CSS overlay (fixed inset-0) still
      // fills the browser tab as a fallback.
    })
  }
}

function exitFullscreen() {
  if (document.fullscreenElement) {
    document.exitFullscreen().catch(() => {})
  }
  fullscreen.value = false
}

// Keep the Vue state in sync if the user exits via the browser's own
// controls (Esc, F11, mouse gesture) rather than our button.
function onFullscreenChange() {
  if (!document.fullscreenElement && fullscreen.value) {
    fullscreen.value = false
  }
}

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

function insertMediaPrompt() {
  insertMediaPromptBase(input, inputEl, autoResize, id.value)
}

function updateViewport() {
  if (!import.meta.client) return
  const xl = window.innerWidth >= 1280
  if (xl) mobileChatOpen.value = false
  if (!chatViewportReady.value) {
    chatViewportReady.value = true
  }
}

function openMobileChat() {
  mobileChatOpen.value = true
}

function closeMobileChat() {
  mobileChatOpen.value = false
}

function startChatResize(e: MouseEvent) {
  chatResizing.value = true
  chatResizeStartX.value = e.clientX
  chatResizeStartWidth.value = chatPanelWidth.value
  document.body.style.cursor = 'ew-resize'
  document.body.style.userSelect = 'none'
  window.addEventListener('mousemove', onChatResize)
  window.addEventListener('mouseup', stopChatResize)
}

function onChatResize(e: MouseEvent) {
  if (!chatResizing.value) return
  const delta = chatResizeStartX.value - e.clientX
  const next = chatResizeStartWidth.value + delta
  chatPanelWidth.value = Math.max(chatPanelMin, Math.min(chatPanelMax, next))
}

function stopChatResize() {
  chatResizing.value = false
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
  window.removeEventListener('mousemove', onChatResize)
  window.removeEventListener('mouseup', stopChatResize)
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
    const [convs] = await Promise.all([
      convApi.listByProject(id.value),
      refreshActiveConversations(),
    ])
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
    // Trigger the collaboration choreography on the visible office instance
    // so the user sees the characters gather, work, and celebrate — instead
    // of navigating away immediately. The conversation is still created and
    // processed in the background; the user can open it from the sidebar.
    const office = fullscreen.value ? officePixiFullscreenRef.value : officePixiRef.value
    office?.runCollaboration()
    input.value = ''
    nextTick(() => autoResize())
  } catch (err: unknown) {
    const message =
      err && typeof err === 'object' && 'data' in err
        ? (err as { data?: { error?: string } }).data?.error
        : err instanceof Error
          ? err.message
          : 'Failed to start conversation'
    sendError.value = message ?? 'Failed to start conversation'
  } finally {
    sending.value = false
  }
}

onMounted(async () => {
  updateViewport()
  window.addEventListener('resize', updateViewport)
  document.addEventListener('fullscreenchange', onFullscreenChange)
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
  window.removeEventListener('resize', updateViewport)
  document.removeEventListener('fullscreenchange', onFullscreenChange)
  // Make sure we don't leave the monitor fullscreen if the user navigates away.
  if (document.fullscreenElement) {
    document.exitFullscreen().catch(() => {})
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
