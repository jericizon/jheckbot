<template>
  <div class="min-h-screen flex flex-col bg-gray-50">
    <!-- Header -->
    <header class="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 z-40">
      <button @click="navigateTo(`/projects/${conversation?.project_id}`)" class="text-gray-600 text-lg">&larr;</button>
      <div class="flex-1 min-w-0">
        <h1 class="text-sm font-bold truncate">{{ conversation?.title || 'Conversation' }}</h1>
      </div>
      <!-- Model selector -->
      <select
        v-model="selectedModel"
        :disabled="agentRunning || agentStarting"
        class="text-xs border border-gray-300 rounded-lg px-2 py-1 bg-white text-gray-700 focus:border-indigo-500 focus:outline-none disabled:bg-gray-100 disabled:opacity-50 max-w-[140px] truncate"
        title="Devin model"
      >
        <optgroup v-for="group in modelGroups" :key="group.label" :label="group.label">
          <option v-for="m in group.models" :key="m.id" :value="m.id">
            {{ m.label }}{{ m.free ? ' (Free)' : '' }}
          </option>
        </optgroup>
      </select>
      <span v-if="agentRunning" class="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
    </header>

    <!-- Messages -->
    <div ref="messagesContainer" class="flex-1 overflow-y-auto px-4 py-4 space-y-4 pb-32">
      <div v-for="msg in messages" :key="msg.id" class="space-y-1">
        <div class="text-xs text-gray-500">{{ msg.role === 'user' ? 'You' : msg.role === 'assistant' ? 'Devin' : 'System' }}</div>
        <div
          class="rounded-lg p-3 text-sm whitespace-pre-wrap break-words"
          :class="msg.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-200'"
        >
          {{ msg.content }}
        </div>
      </div>

      <!-- Live output -->
      <div v-if="liveOutput.length > 0" class="space-y-1">
        <div class="text-xs text-gray-500">Devin</div>
        <div class="rounded-lg p-3 text-sm bg-white border border-gray-200 whitespace-pre-wrap break-words font-mono text-xs">
          <div v-for="(line, i) in liveOutput" :key="i">{{ line }}</div>
        </div>
      </div>

      <!-- Preloader while agent is starting -->
      <div v-if="agentStarting" class="space-y-1">
        <div class="text-xs text-gray-500">Devin</div>
        <div class="rounded-lg p-4 bg-white border border-gray-200 flex items-center gap-3">
          <div class="flex gap-1">
            <span class="h-2 w-2 rounded-full bg-indigo-500 animate-bounce" style="animation-delay: 0ms" />
            <span class="h-2 w-2 rounded-full bg-indigo-500 animate-bounce" style="animation-delay: 150ms" />
            <span class="h-2 w-2 rounded-full bg-indigo-500 animate-bounce" style="animation-delay: 300ms" />
          </div>
          <span class="text-sm text-gray-500">{{ startingText }}</span>
        </div>
      </div>

      <div v-if="messages.length === 0 && liveOutput.length === 0 && !agentStarting" class="text-center text-gray-500 text-sm mt-8">
        Send a message to start working with Devin.
      </div>
    </div>

    <!-- Stop button -->
    <div v-if="agentRunning" class="fixed bottom-16 left-0 right-0 flex justify-center pb-2 z-40">
      <button @click="stopAgent" class="rounded-full bg-red-600 text-white px-6 py-2 text-sm font-medium shadow-lg hover:bg-red-700">
        Stop Agent
      </button>
    </div>

    <!-- Input -->
    <div class="fixed bottom-0 left-0 right-0 border-t border-gray-200 bg-white px-4 py-3 flex items-end gap-2 z-40">
      <textarea
        v-model="input"
        @keydown.enter.exact.prevent="sendMessage"
        @keydown.enter.shift.exact="input += '\n'"
        @input="autoResize"
        :disabled="agentRunning"
        placeholder="Message... (Shift+Enter for new line)"
        rows="1"
        ref="inputEl"
        class="flex-1 rounded-2xl border border-gray-300 px-4 py-2 text-sm focus:border-indigo-500 focus:outline-none disabled:bg-gray-100 resize-none max-h-32 overflow-y-auto"
        style="min-height: 40px;"
      />
      <button
        @click="sendMessage"
        :disabled="!input.trim() || agentRunning"
        class="rounded-full bg-indigo-600 text-white w-10 h-10 flex items-center justify-center hover:bg-indigo-700 disabled:opacity-50 shrink-0"
      >
        &rarr;
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const convApi = useConversations()
const sse = useSSE()

const id = computed(() => route.params.id as string)

interface Conversation { id: string; project_id: string; title: string; agent_status: string }
interface Message { id: string; role: string; content: string; message_type: string }
interface ModelOption { id: string; label: string; family: string; context: string; pricing: string; free: boolean }

const conversation = ref<Conversation | null>(null)
const messages = ref<Message[]>([])
const liveOutput = ref<string[]>([])
const input = ref('')
const agentRunning = ref(false)
const agentStarting = ref(false)
const startingText = ref('Starting Devin...')
const messagesContainer = ref<HTMLElement | null>(null)
const inputEl = ref<HTMLTextAreaElement | null>(null)
let eventSource: EventSource | null = null

// Model selection
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
let startingTimer: ReturnType<typeof setInterval> | null = null

const startingMessages = [
  'Starting Devin...',
  'Booting CLI...',
  'Loading model...',
  'Preparing workspace...',
  'Connecting to project...',
]

function startStartingAnimation() {
  agentStarting.value = true
  let i = 0
  startingText.value = startingMessages[0]
  startingTimer = setInterval(() => {
    i = (i + 1) % startingMessages.length
    startingText.value = startingMessages[i]
  }, 2000)
}

function stopStartingAnimation() {
  agentStarting.value = false
  if (startingTimer) {
    clearInterval(startingTimer)
    startingTimer = null
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
    agentRunning.value = conv.agent_status === 'running'
    availableModels.value = modelsRes.models
    selectedModel.value = modelsRes.default
    if (agentRunning.value) connectSSE()
    await nextTick()
    scrollToBottom()
  } catch {
    // ignore
  }
}

function connectSSE() {
  eventSource = sse.connect(id.value, (event) => {
    if (event.type === 'status') {
      const data = JSON.parse(event.data)
      if (data.status === 'running') {
        agentRunning.value = true
      }
      if (data.status === 'completed' || data.status === 'stopped' || data.status === 'failed') {
        agentRunning.value = false
        stopStartingAnimation()
        eventSource?.close()
      }
    } else if (event.type === 'output') {
      stopStartingAnimation()
      const data = JSON.parse(event.data)
      liveOutput.value.push(data.content)
      scrollToBottom()
    }
  })
}

function scrollToBottom() {
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
  }
}

async function sendMessage() {
  const prompt = input.value.trim()
  if (!prompt || agentRunning.value) return

  // Optimistically add user message
  messages.value.push({
    id: `temp-${Date.now()}`,
    role: 'user',
    content: prompt,
    message_type: 'text',
  })
  input.value = ''
  autoResize()
  scrollToBottom()

  try {
    // Persist the message
    await convApi.sendMessage(id.value, prompt)

    // Start the agent if not running
    if (conversation.value && !agentRunning.value) {
      agentRunning.value = true
      liveOutput.value = []
      startStartingAnimation()
      await convApi.startAgent(id.value, conversation.value.project_id, prompt, selectedModel.value)
      connectSSE()
    }
  } catch {
    agentRunning.value = false
    stopStartingAnimation()
  }
}

async function stopAgent() {
  try {
    await convApi.stopAgent(id.value)
    agentRunning.value = false
    stopStartingAnimation()
    eventSource?.close()
  } catch {
    // ignore
  }
}

onMounted(load)
onUnmounted(() => {
  eventSource?.close()
  stopStartingAnimation()
})
</script>
