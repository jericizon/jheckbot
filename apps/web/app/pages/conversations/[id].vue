<template>
  <div class="flex h-[100dvh] overflow-hidden bg-surface text-content">
    <!-- Sidebar overlay (mobile) -->
    <Transition
      enter-active-class="transition-opacity duration-200"
      leave-active-class="transition-opacity duration-200"
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
    >
      <div v-if="sidebarOpen" class="fixed inset-0 bg-black/40 z-30 md:hidden" @click="closeSidebar" />
    </Transition>

    <!-- Sidebar -->
    <Transition
      enter-active-class="transition-transform duration-300 ease-out"
      leave-active-class="transition-transform duration-200 ease-in"
      enter-from-class="-translate-x-full"
      leave-to-class="-translate-x-full"
    >
      <aside
        v-if="sidebarOpen"
        class="fixed md:relative z-40 w-64 shrink-0 h-full bg-surface-elevated border-r border-border flex flex-col"
      >
        <!-- New chat -->
        <div class="p-3">
          <button
            @click="navigateTo('/projects/' + conversation?.project_id)"
            class="w-full flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-content bg-accent-muted hover:bg-border-subtle transition-colors"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" /></svg>
            New Conversation
          </button>
        </div>

        <!-- Conversation list -->
        <div class="flex-1 overflow-y-auto px-2 pb-2">
          <p class="px-3 py-2 text-[11px] font-medium text-content-subtle uppercase tracking-wide">Recent</p>
          <NuxtLink
            v-for="conv in sidebarConversations"
            :key="conv.id"
            :to="`/conversations/${conv.id}`"
            class="block rounded-lg px-3 py-2 text-sm truncate mb-0.5 transition-colors"
            :class="conv.id === id ? 'bg-accent-muted text-content' : 'text-content-muted hover:bg-surface-subtle hover:text-content'"
          >
            {{ conv.title }}
          </NuxtLink>
        </div>

        <!-- Footer -->
        <div class="p-3 border-t border-border">
          <NuxtLink to="/" class="flex items-center gap-2 text-sm text-content-muted hover:text-content transition-colors">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
            Home
          </NuxtLink>
        </div>
      </aside>
    </Transition>

    <!-- Main chat area -->
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
          @click="navigateTo('/projects/' + conversation?.project_id)"
          class="text-content-subtle hover:text-content transition-colors p-1 rounded-md hover:bg-surface-subtle"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" /></svg>
        </button>
        <!-- Editable title -->
        <div class="flex-1 min-w-0 flex items-center gap-1">
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
        </div>
        <span v-if="agentRunning" class="flex items-center gap-1.5 text-xs text-emerald-500 font-medium shrink-0">
          <span class="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Active
        </span>
        <button
          @click="toggleTheme"
          class="text-content-muted hover:text-content transition-colors p-1.5 rounded-md hover:bg-surface-subtle"
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
              <div class="flex-1 text-sm text-content whitespace-pre-wrap break-words leading-relaxed pt-1">
                {{ msg.content }}
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
            <div class="flex-1 text-sm text-content whitespace-pre-wrap break-words leading-relaxed pt-1">
              {{ liveOutput }}
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
      <div class="shrink-0 pb-4 pt-2">
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
          <div class="flex items-center justify-between mt-2 px-1 gap-2">
            <div class="flex items-center gap-3">
              <select
                v-model="selectedModel"
                :disabled="agentStarting || agentRunning"
                class="text-xs text-content-muted bg-transparent border-none focus:outline-none cursor-pointer disabled:opacity-50"
              >
                <optgroup v-for="group in modelGroups" :key="group.label" :label="group.label">
                  <option v-for="m in group.models" :key="m.id" :value="m.id" class="bg-surface-elevated text-content">
                    {{ m.label }}{{ m.free ? ' (Free)' : '' }}
                  </option>
                </optgroup>
              </select>
              <button
                @click="bypassMode = !bypassMode"
                :disabled="agentStarting || agentRunning"
                class="flex items-center gap-1 text-xs transition-colors disabled:opacity-50"
                :class="bypassMode ? 'text-amber-500' : 'text-content-subtle hover:text-content-muted'"
                :title="bypassMode ? 'Bypass mode ON: Devin will auto-approve all tools without asking' : 'Bypass mode OFF: Devin will ask for permission on risky actions'"
              >
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                <span>Bypass</span>
              </button>
            </div>
            <p class="text-xs text-content-subtle shrink-0">Enter to send, Shift+Enter for new line</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const convApi = useConversations()
const sse = useSSE()
const { theme, toggle: toggleTheme } = useTheme()

const id = computed(() => route.params.id as string)

interface Conversation { id: string; project_id: string; title: string; agent_status: string }
interface Message { id: string; role: string; content: string; message_type: string }
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
const bypassMode = ref(false)
const editingTitle = ref(false)
const titleDraft = ref('')
const titleInputEl = ref<HTMLInputElement | null>(null)
const messagesContainer = ref<HTMLElement | null>(null)
const inputEl = ref<HTMLTextAreaElement | null>(null)
const { sidebarOpen, toggle: toggleSidebar, close: closeSidebar } = useSidebar()
const sidebarConversations = ref<Conversation[]>([])
let eventSource: EventSource | null = null

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

async function loadSidebarConversations() {
  if (!conversation.value?.project_id) return
  try {
    sidebarConversations.value = await convApi.listByProject(conversation.value.project_id)
  } catch {
    // ignore
  }
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
        eventSource?.close()
        await reloadMessages()
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

    agentRunning.value = true
    liveOutput.value = ''
    activityLog.value = ''
    activityOpen.value = true
    agentStarting.value = true
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
  }
}

async function stopAgent() {
  try {
    await convApi.stopAgent(id.value)
    agentRunning.value = false
    agentStarting.value = false
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
