<template>
  <div class="flex h-[100dvh] overflow-hidden bg-surface text-content">
    <ConversationSidebar
      :conversations="sidebarConversations"
      :active-id="id"
      @new="navigateTo('/projects/' + conversation?.project_id)"
      @delete="deleteConversation"
      @rename="handleSidebarRename"
    />

    <!-- Main chat area -->
    <div class="flex-1 flex flex-col h-full min-w-0">
      <!-- Header -->
      <header class="flex items-center gap-2 px-3 py-2.5 border-b border-border shrink-0">
        <button
          @click="toggleSidebar"
          class="text-content-muted hover:text-content transition-colors p-1 -ml-1 rounded-md hover:bg-surface-subtle shrink-0"
          aria-label="Toggle sidebar"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16" /></svg>
        </button>
        <!-- Title + project subtitle -->
        <div class="flex-1 min-w-0 flex flex-col">
          <div class="flex items-center gap-1 min-w-0">
            <input
              v-if="editingTitle"
              v-model="titleDraft"
              @blur="saveTitle"
              @keydown.enter.exact.prevent="saveTitle"
              @keydown.escape="cancelEditTitle"
              ref="titleInputEl"
              class="flex-1 min-w-0 text-sm font-semibold bg-transparent border-b border-content-subtle focus:outline-none focus:border-content text-content"
            />
            <button
              v-else
              @click="startEditTitle"
              class="flex items-center gap-1 min-w-0 group"
              :disabled="agentRunning"
            >
              <span class="text-sm font-semibold truncate text-content">{{ conversation?.title || 'Conversation' }}</span>
              <svg class="w-3 h-3 text-content-subtle opacity-0 group-hover:opacity-100 transition-opacity shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
            </button>
            <span v-if="agentRunning" class="flex items-center gap-1 text-xs text-emerald-500 font-medium shrink-0">
              <span class="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Active
            </span>
          </div>
          <!-- Project + branch as compact tappable subtitle (replaces separate back arrow) -->
          <button
            v-if="projectName"
            @click="navigateTo('/projects/' + conversation?.project_id)"
            class="flex items-center gap-1 mt-0.5 text-xs text-content-subtle hover:text-content-muted transition-colors min-w-0"
          >
            <svg class="w-3 h-3 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" /></svg>
            <span class="truncate">{{ projectName }}</span>
            <span v-if="projectBranch" class="flex items-center gap-1 text-[11px] text-content-subtle bg-surface-subtle rounded px-1.5 py-0.5 shrink-0">
              <svg class="w-3 h-3 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 3v12" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="6" r="3" /><path stroke-linecap="round" stroke-linejoin="round" d="M18 9v3a3 3 0 01-3 3H6" /></svg>
              <span class="font-mono truncate max-w-[12ch]">{{ projectBranch }}</span>
            </span>
          </button>
        </div>
        <button
          @click="toggleTheme"
          class="text-content-muted hover:text-content transition-colors p-1.5 rounded-md hover:bg-surface-subtle shrink-0"
          :title="theme === 'dark' ? 'Switch to light' : 'Switch to dark'"
        >
          <svg v-if="theme === 'dark'" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
          <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
        </button>
      </header>

      <!-- Messages -->
      <div ref="messagesContainer" class="flex-1 overflow-y-auto">
        <div class="max-w-3xl mx-auto px-4 py-8 space-y-6">
          <!-- Empty state -->
          <div v-if="messages.length === 0 && !liveOutput && !agentStarting" class="flex flex-col items-center justify-center min-h-[50vh] text-center animate-fade-in">
            <div class="w-12 h-12 rounded-full bg-surface-subtle flex items-center justify-center mb-4">
              <svg class="w-6 h-6 text-content-subtle" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 3v-3z" /></svg>
            </div>
            <p class="text-content-muted text-sm">Send a message to start working with Devin.</p>
          </div>

          <!-- Message list -->
          <template v-for="msg in messages" :key="msg.id">
            <!-- User message -->
            <div v-if="msg.role === 'user'" class="flex justify-end animate-slide-up">
              <div class="max-w-[80%] rounded-2xl rounded-br-md bg-accent-muted px-4 py-2.5 text-sm text-content whitespace-pre-wrap break-words">
                {{ msg.content }}
              </div>
            </div>

            <!-- Assistant message -->
            <div v-else-if="msg.role === 'assistant'" class="flex gap-3 animate-slide-up">
              <div class="w-7 h-7 rounded-full bg-content flex items-center justify-center shrink-0 mt-0.5">
                <svg class="w-3.5 h-3.5 text-surface" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              </div>
              <div class="flex-1 min-w-0 pt-1">
                <div v-if="msg.model" class="flex items-center gap-1 mb-1">
                  <span class="text-[10px] font-medium uppercase tracking-wide text-content-subtle bg-surface-subtle rounded px-1.5 py-0.5">{{ msg.model }}</span>
                </div>
                <div class="text-sm text-content leading-relaxed min-w-0">
                  <Markdown :content="msg.content" />
                </div>
              </div>
            </div>

            <!-- System message -->
            <div v-else class="flex gap-3 animate-slide-up">
              <div class="w-7 h-7 rounded-full bg-surface-subtle flex items-center justify-center shrink-0 mt-0.5">
                <svg class="w-4 h-4 text-content-subtle" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <div class="flex-1 text-sm text-content-muted whitespace-pre-wrap break-words pt-1">
                {{ msg.content }}
              </div>
            </div>
          </template>

          <!-- Live output -->
          <div v-if="liveOutput" class="flex gap-3 animate-fade-in">
            <div class="w-7 h-7 rounded-full bg-content flex items-center justify-center shrink-0 mt-0.5">
              <svg class="w-3.5 h-3.5 text-surface" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            </div>
            <div class="flex-1 min-w-0 pt-1">
              <div class="flex items-center gap-1 mb-1">
                <span class="text-[10px] font-medium uppercase tracking-wide text-content-subtle bg-surface-subtle rounded px-1.5 py-0.5">{{ selectedModel }}</span>
              </div>
              <div class="text-sm text-content leading-relaxed min-w-0">
                <Markdown :content="liveOutput" />
              </div>
              <!-- Background processing indicator -->
              <div v-if="agentRunning" class="flex items-center gap-1.5 mt-2 text-xs text-content-subtle animate-fade-in">
                <span class="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>Processing...</span>
              </div>
            </div>
          </div>

          <!-- Typing indicator -->
          <div v-if="agentStarting" class="flex gap-3 animate-fade-in">
            <div class="w-7 h-7 rounded-full bg-content flex items-center justify-center shrink-0 mt-0.5">
              <svg class="w-3.5 h-3.5 text-surface" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            </div>
            <div class="flex items-center gap-1 pt-2.5">
              <span class="h-1.5 w-1.5 rounded-full bg-content-subtle animate-bounce" style="animation-delay: 0ms" />
              <span class="h-1.5 w-1.5 rounded-full bg-content-subtle animate-bounce" style="animation-delay: 150ms" />
              <span class="h-1.5 w-1.5 rounded-full bg-content-subtle animate-bounce" style="animation-delay: 300ms" />
            </div>
          </div>

          <!-- Error -->
          <div v-if="sendError" class="flex justify-center animate-fade-in">
            <div class="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-2.5 text-sm text-red-500 flex items-center gap-2">
              {{ sendError }}
              <button @click="sendError = ''" class="text-red-400 hover:text-red-500">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Activity log panel -->
      <ChangedFilesPanel ref="changedFilesPanel" :project-id="conversation?.project_id" />
      <div v-if="agentRunning || agentStarting || activityLog" class="shrink-0 border-t border-border">
        <button
          @click="activityOpen = !activityOpen"
          class="w-full flex items-center gap-2 px-4 py-2 text-xs font-medium text-content-muted hover:text-content transition-colors"
        >
          <svg
            class="w-3.5 h-3.5 transition-transform"
            :class="activityOpen ? 'rotate-90' : ''"
            fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"
          ><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" /></svg>
          <span>Terminal activity</span>
          <span v-if="agentRunning" class="flex items-center gap-1 ml-1">
            <span class="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          </span>
        </button>
        <div v-show="activityOpen" class="px-4 pb-3 max-h-48 overflow-y-auto bg-surface-subtle/50">
          <pre class="text-[11px] font-mono text-content-muted whitespace-pre-wrap break-all leading-relaxed">{{ activityLog || 'Waiting for output...' }}</pre>
        </div>
      </div>

      <!-- Input area -->
      <div class="shrink-0 pt-2 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <div class="max-w-3xl mx-auto px-4">
          <!-- Stop button -->
          <div v-if="agentRunning" class="flex justify-center mb-3">
            <button
              @click="stopAgent"
              class="flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-medium text-content-muted hover:text-content hover:border-content-subtle transition-colors"
            >
              <span class="w-3 h-3 rounded-sm bg-current" />
              Stop
            </button>
          </div>

          <!-- Input box -->
          <div class="relative rounded-2xl border border-border bg-surface-elevated focus-within:border-content-subtle transition-colors">
            <textarea
              v-model="input"
              @keydown.enter.exact.prevent="sendMessage"
              @keydown.enter.shift.exact="input += '\n'"
              @input="autoResize"
              placeholder="Message Devin..."
              rows="1"
              ref="inputEl"
              :disabled="agentStarting || agentRunning"
              class="w-full rounded-2xl px-4 py-3.5 pr-12 text-sm text-content placeholder-content-subtle focus:outline-none resize-none max-h-32 overflow-y-auto disabled:opacity-50"
              style="min-height: 52px;"
            />
            <button
              @click="sendMessage"
              :disabled="!input.trim() || agentStarting || agentRunning"
              class="absolute right-2 bottom-2 rounded-lg w-8 h-8 flex items-center justify-center transition-all shrink-0 active:scale-95"
              :class="input.trim() && !agentStarting && !agentRunning ? 'bg-content text-surface hover:opacity-80' : 'bg-surface-subtle text-content-subtle'"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
            </button>
          </div>

          <!-- Model selector + bypass toggle + hint -->
          <div class="flex items-center gap-2 mt-2 px-1 overflow-x-auto">
            <select
              v-model="selectedModel"
              :disabled="agentStarting || agentRunning"
              class="text-xs text-content-muted bg-transparent border-none focus:outline-none cursor-pointer disabled:opacity-50 shrink-0"
            >
              <optgroup v-for="group in modelGroups" :key="group.label" :label="group.label">
                <option v-for="m in group.models" :key="m.id" :value="m.id" class="bg-surface-elevated text-content">
                  {{ m.label }}{{ m.free ? ' (Free)' : '' }}
                </option>
              </optgroup>
            </select>
            <button
              @click="skillsPickerOpen = true"
              :disabled="agentStarting || agentRunning"
              class="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium border bg-transparent border-border text-content-subtle hover:text-content-muted hover:border-content-subtle transition-all disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
              title="Browse and insert skills"
            >
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              <span>Skills</span>
            </button>
            <button
              @click="toggleBypass"
              :disabled="agentStarting || agentRunning"
              class="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium border transition-all disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
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
            <p class="text-xs text-content-subtle shrink-0 ml-auto hidden sm:block">Enter to send, Shift+Enter for new line</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Delete conversation modal -->
    <ConfirmModal
      :open="deleteModalOpen"
      title="Delete Conversation"
      :message="deleteTarget
        ? `Delete \u201C${deleteTargetTitle}\u201D? This cannot be undone.`
        : 'Delete this conversation? This cannot be undone.'"
      confirm-label="Yes, delete"
      loading-label="Deleting..."
      :loading="deletingConv"
      :error="deleteConvError"
      @confirm="confirmDeleteConversation"
      @cancel="closeDeleteModal"
    />

    <!-- Skills picker -->
    <SkillsPicker :open="skillsPickerOpen" @select="insertSkill" @close="skillsPickerOpen = false" />
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const convApi = useConversations()
const projectApi = useProjects()
const sse = useSSE()
const { theme, toggle: toggleTheme } = useTheme()

const id = computed(() => route.params.id as string)

interface Conversation { id: string; project_id: string; title: string; agent_status: string }
interface Message { id: string; role: string; content: string; message_type: string; model?: string | null }
interface ModelOption { id: string; label: string; family: string; context: string; pricing: string; free: boolean }

const conversation = ref<Conversation | null>(null)
const messages = ref<Message[]>([])
const liveOutput = ref('')
const input = ref('')
const agentRunning = ref(false)
const agentStarting = ref(false)
const sendError = ref('')
const activityLog = ref('')
const activityOpen = ref(false)
const skillsPickerOpen = ref(false)
const { bypassMode, toggle: toggleBypass } = useBypassMode()
const editingTitle = ref(false)
const titleDraft = ref('')
const titleInputEl = ref<HTMLInputElement | null>(null)
const messagesContainer = ref<HTMLElement | null>(null)
const inputEl = ref<HTMLTextAreaElement | null>(null)
const changedFilesPanel = ref<{ refresh: () => void } | null>(null)
const projectName = ref('')
const projectBranch = ref<string | null>(null)
const { sidebarOpen, toggle: toggleSidebar } = useSidebar()
const sidebarConversations = ref<Conversation[]>([])
let eventSource: EventSource | null = null

// Refresh sidebar statuses periodically so background runs in other
// conversations surface without a manual reload. While the active
// conversation's agent is running, SSE owns its status and we skip
// clobbering it from the (possibly stale) poll result.
useConversationPolling(
  () => conversation.value?.project_id,
  (convs) => {
    if (agentRunning.value) {
      const activeId = id.value
      sidebarConversations.value = convs.map((c) =>
        c.id === activeId
          ? { ...c, agent_status: sidebarConversations.value.find((s) => s.id === activeId)?.agent_status ?? c.agent_status }
          : c,
      )
    } else {
      sidebarConversations.value = convs
    }
  },
)

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

// Insert a selected skill slash command into the input and focus it so the
// user can immediately append their prompt.
function insertSkill(command: string) {
  input.value = input.value ? `${input.value} ${command}`.trim() : command
  nextTick(() => {
    inputEl.value?.focus()
    autoResize()
  })
}

async function loadSidebarConversations() {
  if (!conversation.value?.project_id) return
  try {
    sidebarConversations.value = await convApi.listByProject(conversation.value.project_id)
  } catch {
    // ignore
  }
}

// Keep the active conversation's sidebar entry in sync with SSE status
// events so the background-process indicator updates live.
function setSidebarStatus(convId: string, status: string) {
  const idx = sidebarConversations.value.findIndex((c) => c.id === convId)
  if (idx >= 0) sidebarConversations.value[idx].agent_status = status
}

async function load() {
  try {
    const [conv, msgs, modelsRes] = await Promise.all([
      convApi.get(id.value),
      convApi.messages(id.value),
      convApi.models(),
    ])
    conversation.value = conv
    messages.value = msgs
    availableModels.value = modelsRes.models
    selectedModel.value = modelsRes.default

    loadSidebarConversations()
    loadProjectInfo(conv.project_id)

    try {
      const agentStatus = await convApi.agentStatus(id.value)
      if (agentStatus && (agentStatus.status === 'running' || agentStatus.status === 'starting')) {
        agentRunning.value = true
        connectSSE()
      }
    } catch {
      // 404 means no agent run
    }

    await nextTick()
    scrollToBottom()
  } catch {
    // ignore
  }
}

async function loadProjectInfo(projectId: string) {
  try {
    const project = await projectApi.get(projectId)
    projectName.value = project.name
  } catch {
    // ignore — header just won't show project name
  }
  try {
    const result = await projectApi.branch(projectId)
    projectBranch.value = result.branch
  } catch {
    projectBranch.value = null
  }
}

function connectSSE() {
  eventSource = sse.connect(id.value, async (event) => {
    if (event.type === 'status') {
      const data = JSON.parse(event.data)
      if (data.status === 'running') {
        agentRunning.value = true
      }
      if (data.status === 'completed' || data.status === 'stopped' || data.status === 'failed' || data.status === 'idle') {
        agentRunning.value = false
        agentStarting.value = false
        setSidebarStatus(id.value, 'idle')
        eventSource?.close()
        await reloadMessages()
        changedFilesPanel.value?.refresh()
      } else {
        setSidebarStatus(id.value, data.status)
      }
    } else if (event.type === 'output') {
      agentStarting.value = false
      const data = JSON.parse(event.data)
      liveOutput.value = data.content
      await nextTick()
      scrollToBottom()
    } else if (event.type === 'log') {
      const data = JSON.parse(event.data)
      activityLog.value = data.content
    }
  })
}

async function refreshConversation() {
  try {
    const conv = await convApi.get(id.value)
    conversation.value = conv
    const idx = sidebarConversations.value.findIndex((c) => c.id === id.value)
    if (idx >= 0) sidebarConversations.value[idx].title = conv.title
  } catch {
    // keep existing title on failure
  }
}

async function reloadMessages() {
  try {
    const msgs = await convApi.messages(id.value)
    messages.value = msgs
    liveOutput.value = ''
    await nextTick()
    scrollToBottom()
  } catch {
    // Keep existing messages if reload fails
  }
}

function scrollToBottom() {
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
  }
}

function startEditTitle() {
  if (agentRunning.value) return
  titleDraft.value = conversation.value?.title || ''
  editingTitle.value = true
  nextTick(() => titleInputEl.value?.focus())
}

function cancelEditTitle() {
  editingTitle.value = false
  titleDraft.value = ''
}

async function saveTitle() {
  if (!editingTitle.value) return
  const newTitle = titleDraft.value.trim()
  editingTitle.value = false
  if (!newTitle || !conversation.value || newTitle === conversation.value.title) {
    titleDraft.value = ''
    return
  }
  try {
    const updated = await convApi.update(id.value, { title: newTitle })
    conversation.value = { ...conversation.value, title: updated.title }
    // Update sidebar entry too
    const idx = sidebarConversations.value.findIndex((c) => c.id === id.value)
    if (idx >= 0) sidebarConversations.value[idx].title = updated.title
  } catch {
    // Keep old title on failure
  }
  titleDraft.value = ''
}

async function handleSidebarRename(convId: string, newTitle: string) {
  try {
    const updated = await convApi.update(convId, { title: newTitle })
    const conv = sidebarConversations.value.find((c) => c.id === convId)
    if (conv) conv.title = updated.title
    if (conversation.value?.id === convId) {
      conversation.value = { ...conversation.value, title: updated.title }
    }
  } catch {
    // Keep old title on failure
  }
}

const deleteModalOpen = ref(false)
const deleteTarget = ref<string | null>(null)
const deletingConv = ref(false)
const deleteConvError = ref('')

const deleteTargetTitle = computed(() =>
  sidebarConversations.value.find((c) => c.id === deleteTarget.value)?.title
  ?? conversation.value?.title
  ?? 'this conversation',
)

function deleteConversation(convId: string) {
  deleteTarget.value = convId
  deleteConvError.value = ''
  deleteModalOpen.value = true
}

function closeDeleteModal() {
  if (deletingConv.value) return
  deleteModalOpen.value = false
  deleteTarget.value = null
  deleteConvError.value = ''
}

async function confirmDeleteConversation() {
  const convId = deleteTarget.value
  if (!convId) return
  deletingConv.value = true
  deleteConvError.value = ''
  try {
    await convApi.delete(convId)
    sidebarConversations.value = sidebarConversations.value.filter((c) => c.id !== convId)
    deleteModalOpen.value = false
    deleteTarget.value = null
    if (convId === id.value) {
      // Send the user back to the project page (which hosts the "New Conversation" action)
      // rather than the root index. Fall back to /projects if project_id is missing.
      const projectId = conversation.value?.project_id
      await navigateTo(projectId ? `/projects/${projectId}` : '/projects')
    }
  } catch (err: unknown) {
    deleteConvError.value = (err as { data?: { error?: string } })?.data?.error || 'Failed to delete conversation'
  } finally {
    deletingConv.value = false
  }
}

async function sendMessage() {
  const prompt = input.value.trim()
  if (!prompt || agentStarting.value || agentRunning.value) return

  sendError.value = ''

  const tempId = `temp-${Date.now()}`
  messages.value.push({
    id: tempId,
    role: 'user',
    content: prompt,
    message_type: 'prompt',
  })
  input.value = ''
  autoResize()
  await nextTick()
  scrollToBottom()

  try {
    const result = await convApi.sendMessage(id.value, prompt, selectedModel.value, bypassMode.value)

    const idx = messages.value.findIndex((m) => m.id === tempId)
    if (idx >= 0) {
      messages.value[idx] = result.message
    }

    // Backend auto-generates a title from the first prompt; refresh the
    // header + sidebar so the new title shows without a full page reload.
    if (conversation.value?.title === 'New Conversation') {
      refreshConversation()
    }

    agentRunning.value = true
    liveOutput.value = ''
    activityLog.value = ''
    activityOpen.value = true
    agentStarting.value = true
    setSidebarStatus(id.value, 'starting')
    connectSSE()
  } catch (err: unknown) {
    const idx = messages.value.findIndex((m) => m.id === tempId)
    if (idx >= 0) messages.value.splice(idx, 1)

    const message = err && typeof err === 'object' && 'data' in err
      ? (err as { data?: { error?: string } }).data?.error
      : err instanceof Error ? err.message : 'Failed to send message'
    sendError.value = message ?? 'Failed to send message'

    agentRunning.value = false
    agentStarting.value = false
    setSidebarStatus(id.value, 'idle')
  }
}

async function stopAgent() {
  try {
    await convApi.stopAgent(id.value)
    agentRunning.value = false
    agentStarting.value = false
    setSidebarStatus(id.value, 'idle')
    eventSource?.close()
  } catch {
    // ignore
  }
}

watch([messages, liveOutput], async () => {
  await nextTick()
  scrollToBottom()
})

onMounted(load)
onUnmounted(() => {
  eventSource?.close()
})
</script>
