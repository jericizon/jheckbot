<template>
  <div class="flex flex-col h-full bg-surface text-content">
    <AppHeader sticky>
      <div class="w-full flex items-center justify-between gap-2">
        <div class="flex items-center gap-2">
          <NuxtLink
            :to="`/office?office=${officeId}`"
            class="text-content-subtle hover:text-content text-sm"
          >
            ← Office
          </NuxtLink>
          <h1 class="text-lg font-semibold">Talk to CEO</h1>
        </div>
        <span
          class="hidden sm:inline text-xs text-content-subtle font-mono truncate max-w-[50%]"
          :title="officeId"
        >
          {{ officeId }}
        </span>
      </div>
    </AppHeader>

    <main class="flex-1 flex flex-col px-4 py-4 max-w-3xl mx-auto w-full min-h-0">
      <div
        ref="messagesContainer"
        class="flex-1 overflow-y-auto space-y-3 pr-1"
      >
        <div
          v-for="message in messages"
          :key="message.id"
          :class="[
            'flex',
            message.sender === 'user' ? 'justify-end' : 'justify-start',
          ]"
        >
          <div
            :class="[
              'max-w-[92%] sm:max-w-[80%] rounded-lg px-3 py-2 text-sm',
              message.sender === 'user'
                ? 'bg-accent text-white'
                : 'bg-surface-elevated border border-border',
            ]"
          >
            <p class="whitespace-pre-wrap">{{ message.content }}</p>
            <span class="text-[10px] opacity-70 block mt-1 text-right">
              {{ formatTime(message.createdAt) }}
            </span>
          </div>
        </div>

        <div v-if="loading" class="flex justify-start">
          <div class="bg-surface-elevated border border-border rounded-lg px-3 py-2 text-sm">
            <span class="inline-flex gap-1">
              <span class="w-1.5 h-1.5 bg-content-subtle rounded-full animate-bounce" />
              <span class="w-1.5 h-1.5 bg-content-subtle rounded-full animate-bounce [animation-delay:0.1s]" />
              <span class="w-1.5 h-1.5 bg-content-subtle rounded-full animate-bounce [animation-delay:0.2s]" />
            </span>
          </div>
        </div>
      </div>

      <div
        v-if="!loading && messages.length === 0"
        class="flex-1 flex flex-col items-center justify-center text-center text-content-subtle"
      >
        <span class="text-4xl mb-2" aria-hidden="true">👔</span>
        <p class="text-sm">Send a request to the CEO to start planning.</p>
      </div>

      <form class="mt-4 flex items-end gap-2" @submit.prevent="submit">
        <textarea
          v-model="draft"
          rows="2"
          class="flex-1 min-w-0 rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm focus:outline-none focus:border-accent resize-none"
          placeholder="Type a request..."
          :disabled="loading"
        />
        <button
          type="submit"
          class="bg-accent hover:bg-accent-hover text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-50"
          :disabled="!canSubmit"
        >
          Send
        </button>
      </form>

      <p v-if="error" class="text-xs text-red-500 mt-2">{{ error }}</p>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { useCEOChat } from '~/composables/useCEOChat'
import { useOfficeEvents } from '~/composables/useOfficeEvents'
import type { OfficeEvent } from '@jheckbot/shared'

const props = defineProps<{
  officeId: string
}>()

type ChatMessage = OfficeEvent & { sender: 'user' | 'ceo' }

const chat = useCEOChat()
const eventsApi = useOfficeEvents()

const messages = ref<ChatMessage[]>([])
const draft = ref('')
const loading = ref(false)
const error = ref('')
const messagesContainer = ref<HTMLElement | null>(null)

const canSubmit = computed(() => !loading.value && draft.value.trim().length > 0)

function toChatMessage(event: OfficeEvent): OfficeEvent & { sender: 'user' | 'ceo' } {
  const sender = event.eventType === 'CEO_MESSAGE' ? 'user' : 'ceo'
  return { ...event, sender }
}

function isChatEvent(event: OfficeEvent): boolean {
  return event.eventType === 'CEO_MESSAGE' || event.eventType === 'CEO_RESPONSE'
}

async function loadMessages() {
  try {
    const events = await chat.listEvents(props.officeId)
    messages.value = events.filter(isChatEvent).map(toChatMessage).reverse()
  } catch {
    messages.value = []
  }
}

function handleLiveEvent(event: OfficeEvent) {
  if (!isChatEvent(event)) return
  if (messages.value.some((m) => m.id === event.id)) return
  messages.value = [...messages.value, toChatMessage(event)]
}

let unsubscribeEvents: (() => void) | null = null

function connectEvents() {
  if (unsubscribeEvents) {
    unsubscribeEvents()
    unsubscribeEvents = null
  }
  unsubscribeEvents = eventsApi.subscribeToOffice(props.officeId, handleLiveEvent)
}

async function submit() {
  if (!canSubmit.value) return
  error.value = ''
  loading.value = true
  try {
    await chat.sendMessage(props.officeId, draft.value)
    draft.value = ''
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to send message'
  } finally {
    loading.value = false
  }
}

function formatTime(iso?: string) {
  if (!iso) return '--:--'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '--:--'
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function scrollToBottom() {
  nextTick(() => {
    const el = messagesContainer.value
    if (el) el.scrollTop = el.scrollHeight
  })
}

watch(messages, scrollToBottom, { deep: true })

onMounted(() => {
  loadMessages()
  connectEvents()
})

onUnmounted(() => {
  if (unsubscribeEvents) {
    unsubscribeEvents()
    unsubscribeEvents = null
  }
})
</script>
