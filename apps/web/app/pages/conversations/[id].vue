<template>
  <div class="min-h-screen flex flex-col bg-gray-50">
    <!-- Header -->
    <header class="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 z-40">
      <button @click="navigateTo(`/projects/${conversation?.project_id}`)" class="text-gray-600 text-lg">&larr;</button>
      <div class="flex-1 min-w-0">
        <h1 class="text-sm font-bold truncate">{{ conversation?.title || 'Conversation' }}</h1>
      </div>
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

      <div v-if="messages.length === 0 && liveOutput.length === 0" class="text-center text-gray-500 text-sm mt-8">
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
    <div class="fixed bottom-0 left-0 right-0 border-t border-gray-200 bg-white px-4 py-3 flex items-center gap-2 z-40">
      <input
        v-model="input"
        @keydown.enter="sendMessage"
        :disabled="agentRunning"
        placeholder="Message..."
        class="flex-1 rounded-full border border-gray-300 px-4 py-2 text-sm focus:border-indigo-500 focus:outline-none disabled:bg-gray-100"
      />
      <button
        @click="sendMessage"
        :disabled="!input.trim() || agentRunning"
        class="rounded-full bg-indigo-600 text-white w-10 h-10 flex items-center justify-center hover:bg-indigo-700 disabled:opacity-50"
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

const conversation = ref<Conversation | null>(null)
const messages = ref<Message[]>([])
const liveOutput = ref<string[]>([])
const input = ref('')
const agentRunning = ref(false)
const messagesContainer = ref<HTMLElement | null>(null)
let eventSource: EventSource | null = null

async function load() {
  try {
    const [conv, msgs] = await Promise.all([
      convApi.get(id.value),
      convApi.messages(id.value),
    ])
    conversation.value = conv
    messages.value = msgs
    agentRunning.value = conv.agent_status === 'running'
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
      if (data.status === 'running') agentRunning.value = true
      if (data.status === 'completed' || data.status === 'stopped' || data.status === 'failed') {
        agentRunning.value = false
        eventSource?.close()
      }
    } else if (event.type === 'output') {
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
  scrollToBottom()

  try {
    // Persist the message
    await convApi.sendMessage(id.value, prompt)

    // Start the agent if not running
    if (conversation.value && !agentRunning.value) {
      agentRunning.value = true
      liveOutput.value = []
      await convApi.startAgent(id.value, conversation.value.project_id, prompt)
      connectSSE()
    }
  } catch {
    agentRunning.value = false
  }
}

async function stopAgent() {
  try {
    await convApi.stopAgent(id.value)
    agentRunning.value = false
    eventSource?.close()
  } catch {
    // ignore
  }
}

onMounted(load)
onUnmounted(() => eventSource?.close())
</script>
