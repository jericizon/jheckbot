<template>
  <!-- Messages scroll area -->
  <div ref="messagesContainer" class="flex-1 overflow-y-auto min-h-0">
    <div class="max-w-3xl mx-auto w-full px-4 py-8 space-y-6">
      <!-- Empty state -->
      <div
        v-if="!loading && messages.length === 0"
        class="flex flex-col items-center justify-center min-h-[50vh] text-center text-content-subtle animate-fade-in"
      >
        <div class="w-12 h-12 rounded-full bg-surface-subtle flex items-center justify-center mb-4">
          <svg
            class="w-6 h-6 text-content-subtle"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 3v-3z"
            />
          </svg>
        </div>
        <p class="text-sm">Send a request to the CEO to start planning.</p>
      </div>

      <!-- Message list -->
      <template v-for="message in messages" :key="message.id">
        <!-- User message -->
        <div
          class="group flex animate-slide-up"
          :class="message.sender === 'user' ? 'justify-end' : 'justify-start'"
        >
          <!-- User bubble -->
          <div v-if="message.sender === 'user'" class="flex flex-col items-end gap-1 max-w-[80%]">
            <div
              class="rounded-2xl rounded-br-md bg-accent-muted px-4 py-2.5 text-sm text-content whitespace-pre-wrap break-words"
            >
              {{ message.content }}
            </div>
            <button
              @click="copyMessage(message.content ?? '', `user-${message.id}`)"
              class="invisible group-hover:visible flex items-center gap-1 text-[11px] text-content-subtle hover:text-content transition-colors px-1"
              :title="copiedId === `user-${message.id}` ? 'Copied!' : 'Copy message'"
            >
              <svg
                v-if="copiedId === `user-${message.id}`"
                class="w-3 h-3 text-emerald-500"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                viewBox="0 0 24 24"
              >
                <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <svg
                v-else
                class="w-3 h-3"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
              <span>{{ copiedId === `user-${message.id}` ? 'Copied' : 'Copy' }}</span>
            </button>
          </div>

          <!-- CEO message with avatar -->
          <div v-else class="flex gap-3 max-w-[90%]">
            <div
              class="w-7 h-7 rounded-full bg-content flex items-center justify-center shrink-0 mt-0.5"
            >
              <svg
                class="w-3.5 h-3.5 text-surface"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
            </div>
            <div class="flex-1 min-w-0 pt-1">
              <div class="flex items-center gap-1 mb-1">
                <span
                  class="text-[10px] font-medium uppercase tracking-wide text-content-subtle bg-surface-subtle rounded px-1.5 py-0.5"
                  >CEO</span
                >
              </div>
              <div class="text-sm text-content leading-relaxed min-w-0">
                <Markdown :content="message.content" />
              </div>
              <button
                @click="copyMessage(message.content ?? '', `ceo-${message.id}`)"
                class="invisible group-hover:visible flex items-center gap-1 mt-1.5 text-[11px] text-content-subtle hover:text-content transition-colors"
                :title="copiedId === `ceo-${message.id}` ? 'Copied!' : 'Copy response'"
              >
                <svg
                  v-if="copiedId === `ceo-${message.id}`"
                  class="w-3 h-3 text-emerald-500"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  viewBox="0 0 24 24"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                <svg
                  v-else
                  class="w-3 h-3"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
                <span>{{ copiedId === `ceo-${message.id}` ? 'Copied' : 'Copy' }}</span>
              </button>

              <div
                v-if="getExecution(message)"
                class="mt-3 rounded-lg border px-3 py-2 text-xs"
                :class="getExecution(message)?.status === 'started' ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-600' : 'bg-red-500/5 border-red-500/20 text-red-600'"
              >
                <div class="flex items-center gap-1.5 font-medium">
                  <svg v-if="getExecution(message)?.status === 'started'" class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <svg v-else class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {{ getExecution(message)?.status === 'started' ? 'Devin started' : 'Devin could not start' }}
                </div>
                <div v-if="getExecution(message)?.error" class="mt-1 text-content-subtle">
                  {{ getExecution(message)?.error }}
                </div>
                <NuxtLink
                  v-if="conversationPath(getExecution(message)?.conversationId)"
                  :to="conversationPath(getExecution(message)?.conversationId)"
                  class="mt-1.5 inline-flex items-center gap-1 hover:underline"
                >
                  Open conversation
                  <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </NuxtLink>
              </div>
            </div>
          </div>
        </div>
      </template>

      <!-- Typing indicator -->
      <div v-if="loading" class="flex gap-3 animate-fade-in">
        <div
          class="w-7 h-7 rounded-full bg-content flex items-center justify-center shrink-0 mt-0.5"
        >
          <svg
            class="w-3.5 h-3.5 text-surface"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            viewBox="0 0 24 24"
          >
            <path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <div class="flex items-center gap-1 pt-2.5">
          <span
            class="h-1.5 w-1.5 rounded-full bg-content-subtle animate-bounce"
            style="animation-delay: 0ms"
          />
          <span
            class="h-1.5 w-1.5 rounded-full bg-content-subtle animate-bounce"
            style="animation-delay: 150ms"
          />
          <span
            class="h-1.5 w-1.5 rounded-full bg-content-subtle animate-bounce"
            style="animation-delay: 300ms"
          />
        </div>
      </div>

      <!-- Error -->
      <div v-if="error" class="flex justify-center animate-fade-in">
        <div
          class="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-2.5 text-sm text-red-500 flex items-center gap-2"
        >
          {{ error }}
          <button @click="error = ''" class="text-red-400 hover:text-red-500">
            <svg
              class="w-4 h-4"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              viewBox="0 0 24 24"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- Input area -->
  <div class="shrink-0 pt-2 pb-[calc(1rem+env(safe-area-inset-bottom))]">
    <div class="max-w-3xl mx-auto w-full px-4">
      <div
        v-if="activeExecution"
        class="mb-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 flex items-center justify-between gap-2 text-xs text-emerald-700"
      >
        <div class="flex items-center gap-2">
          <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Devin is working on this request.</span>
        </div>
        <NuxtLink
          v-if="conversationPath(activeExecution.conversationId)"
          :to="conversationPath(activeExecution.conversationId)"
          class="hover:underline"
        >
          Open conversation
        </NuxtLink>
      </div>

      <form
        class="relative rounded-2xl border border-border bg-surface-elevated focus-within:border-content-subtle/60 focus-within:ring-1 focus-within:ring-content-subtle/30 transition-all"
        @submit.prevent="submit"
      >
        <textarea
          v-model="draft"
          ref="inputEl"
          rows="1"
          :placeholder="activeExecution ? 'Waiting for Devin to finish...' : 'Message CEO...'"
          :disabled="loading || !!activeExecution"
          @input="autoResize"
          @keydown.enter.exact.prevent="submit"
          @keydown.enter.shift.exact="draft += '\n'"
          class="w-full rounded-2xl px-4 py-3 pr-14 text-sm text-content placeholder-content-subtle bg-transparent focus:outline-none resize-none max-h-32 overflow-y-auto min-h-[52px] disabled:opacity-50"
        />
        <button
          type="submit"
          :disabled="!canSubmit"
          class="absolute right-2 bottom-2 rounded-lg w-8 h-8 flex items-center justify-center transition-all shrink-0 active:scale-95"
          :class="
            canSubmit
              ? 'bg-content text-surface hover:opacity-80'
              : 'bg-surface-subtle text-content-subtle'
          "
          title="Send message"
        >
          <svg
            class="w-4 h-4"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            viewBox="0 0 24 24"
          >
            <path stroke-linecap="round" stroke-linejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
          </svg>
        </button>
      </form>

      <!-- Model selector + skills (bypass always on, hidden) -->
      <MessageToolbar
        v-model="selectedModel"
        :families="availableFamilies"
        :show-bypass="false"
        :disabled="loading || !!activeExecution"
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
    </div>
  </div>

  <!-- Skills picker -->
  <SkillsPicker :open="skillsPickerOpen" @select="insertSkill" @close="skillsPickerOpen = false" />

  <!-- Model picker -->
  <ModelPicker
    :open="modelPickerOpen"
    :families="availableFamilies"
    :current="selectedModel"
    @select="selectedModel = $event"
    @close="modelPickerOpen = false"
  />
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { insertMediaPrompt as insertMediaPromptBase } from '~/utils/mediaPrompt'
import { useCEOChat } from '~/composables/useCEOChat'
import { useOfficeEvents } from '~/composables/useOfficeEvents'
import { useConversations } from '~/composables/useConversations'
import { useSelectedModel } from '~/composables/useSelectedModel'
import type { ModelFamily } from '~/components/MessageToolbar.vue'
import type { OfficeEvent } from '@jheckbot/shared'

const props = defineProps<{
  officeId: string
  projectId?: string
}>()

type ChatMessage = OfficeEvent & { sender: 'user' | 'ceo' }

const chat = useCEOChat()
const eventsApi = useOfficeEvents()
const convApi = useConversations()
const { selectedModel, ensureDefault } = useSelectedModel()

const messages = ref<ChatMessage[]>([])
const draft = ref('')
const loading = ref(false)
const error = ref('')
const activeExecution = ref<{ taskId: string; conversationId?: string; agentId?: string; status: 'started' | 'failed'; error?: string } | null>(null)
const messagesContainer = ref<HTMLElement | null>(null)
const inputEl = ref<HTMLTextAreaElement | null>(null)
const copiedId = ref<string | null>(null)
let copyResetTimer: ReturnType<typeof setTimeout> | null = null

const availableFamilies = ref<ModelFamily[]>([])
const modelPickerOpen = ref(false)
const skillsPickerOpen = ref(false)

const canSubmit = computed(() => !loading.value && !activeExecution.value && draft.value.trim().length > 0)

function autoResize() {
  const el = inputEl.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = Math.min(el.scrollHeight, 128) + 'px'
}

async function copyMessage(content: string, key: string) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(content)
    } else {
      const ta = document.createElement('textarea')
      ta.value = content
      ta.setAttribute('readonly', '')
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    copiedId.value = key
    if (copyResetTimer) clearTimeout(copyResetTimer)
    copyResetTimer = setTimeout(() => {
      copiedId.value = null
    }, 2000)
  } catch {
    /* clipboard rejected */
  }
}

function toChatMessage(event: OfficeEvent): OfficeEvent & { sender: 'user' | 'ceo' } {
  const sender = event.eventType === 'CEO_MESSAGE' ? 'user' : 'ceo'
  return { ...event, sender }
}

function getExecution(event: OfficeEvent) {
  const execution = event.metadata?.execution as
    | { taskId: string; conversationId?: string; agentId?: string; status: 'started' | 'failed'; error?: string }
    | undefined
  return execution
}

function conversationPath(id?: string) {
  return id ? `/conversations/${id}` : undefined
}

function isChatEvent(event: OfficeEvent): boolean {
  return event.eventType === 'CEO_MESSAGE' || event.eventType === 'CEO_RESPONSE'
}

function updateActiveExecution(event: OfficeEvent) {
  if (event.eventType === 'CEO_RESPONSE' && event.metadata?.execution) {
    const execution = event.metadata.execution as { taskId: string; conversationId?: string; agentId?: string; status: 'started' | 'failed'; error?: string }
    activeExecution.value = execution.status === 'started' ? execution : null
    return
  }

  const terminalTypes = new Set(['AGENT_COMPLETED', 'AGENT_FAILED', 'TASK_COMPLETED', 'TASK_FAILED'])
  if (terminalTypes.has(event.eventType) && event.metadata?.taskId === activeExecution.value?.taskId) {
    activeExecution.value = null
  }
}

async function loadMessages() {
  try {
    const events = await chat.listEvents(props.officeId)
    messages.value = events.filter(isChatEvent).map(toChatMessage).reverse()
    activeExecution.value = null
    for (let i = events.length - 1; i >= 0; i--) {
      updateActiveExecution(events[i])
    }
  } catch {
    messages.value = []
    activeExecution.value = null
  }
}

function handleLiveEvent(event: OfficeEvent) {
  updateActiveExecution(event)
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
    const result = await chat.sendMessage(props.officeId, draft.value, props.projectId, selectedModel.value)
    if (result.execution.status === 'started') {
      activeExecution.value = result.execution
    } else {
      activeExecution.value = null
    }
    draft.value = ''
    nextTick(() => autoResize())
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to send message'
  } finally {
    loading.value = false
  }
}

function insertSkill(command: string) {
  draft.value = draft.value ? `${draft.value} ${command}`.trim() : command
  nextTick(() => {
    inputEl.value?.focus()
    autoResize()
  })
}

function insertMediaPrompt() {
  insertMediaPromptBase(draft, inputEl, autoResize, props.projectId)
}

async function loadModels() {
  try {
    const res = await convApi.models()
    availableFamilies.value = res.families
    ensureDefault(res.default)
  } catch {
    // models optional — chat still works without them
  }
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
  loadModels()
})

onUnmounted(() => {
  if (unsubscribeEvents) {
    unsubscribeEvents()
    unsubscribeEvents = null
  }
})
</script>
