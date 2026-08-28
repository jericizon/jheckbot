<template>
  <div class="pb-24">
    <AppHeader sticky>
      <div class="w-full flex items-center justify-between gap-2">
        <h1 class="text-lg font-semibold">Office</h1>
        <span
          class="text-xs text-content-subtle font-mono truncate max-w-[50%]"
          :title="officeId"
        >
          {{ officeId }}
        </span>
      </div>
    </AppHeader>

    <main class="px-4 py-4 max-w-6xl mx-auto space-y-4">
      <OfficeScene
        :agents="agents"
        :ceo="ceo"
        :employees="employees"
        :loading="loading"
        @select-agent="selectAgent"
      />

      <div
        v-if="selectedAgent"
        class="rounded-lg border border-border bg-surface-elevated p-4 animate-fade-in"
      >
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0">
            <h2 class="font-semibold text-sm">{{ selectedAgent.name }}</h2>
            <p class="text-xs text-content-muted truncate">
              {{ selectedAgent.role }}
            </p>
          </div>
          <div class="flex items-center gap-2">
            <OfficeStatusBadge :status="selectedAgent.status" />
            <button
              type="button"
              class="text-content-subtle hover:text-content p-1 rounded"
              aria-label="Close details"
              @click="clearSelection"
            >
              <span aria-hidden="true">✕</span>
            </button>
          </div>
        </div>

        <p
          v-if="selectedAgent.description"
          class="text-xs text-content-subtle mt-2 line-clamp-3"
        >
          {{ selectedAgent.description }}
        </p>

        <p
          v-if="selectedAgent.provider || selectedAgent.model"
          class="text-xs text-content-subtle mt-1 font-mono truncate"
        >
          {{ [selectedAgent.provider, selectedAgent.model].filter(Boolean).join(' / ') }}
        </p>

        <div class="mt-3">
          <NuxtLink
            :to="`/agents/${selectedAgent.id}`"
            class="text-xs text-accent hover:text-accent-hover transition-colors"
          >
            View agent profile
          </NuxtLink>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <OfficeTaskPanel :tasks="tasks" :loading="tasksLoading" />
        <OfficeActivityPanel :events="events" :loading="eventsLoading" />
      </div>

      <OfficeChatButton :ceo="ceo" @talk-to-ceo="selectCeo" />
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { useOffice } from '~/composables/useOffice'
import { useTasks } from '~/composables/useTasks'
import { useOfficeEvents } from '~/composables/useOfficeEvents'
import OfficeScene from '~/components/office/OfficeScene.vue'
import OfficeStatusBadge from '~/components/office/OfficeStatusBadge.vue'
import OfficeTaskPanel from '~/components/office/OfficeTaskPanel.vue'
import OfficeActivityPanel from '~/components/office/OfficeActivityPanel.vue'
import OfficeChatButton from '~/components/office/OfficeChatButton.vue'
import type { OfficeTask, OfficeEvent } from '@jheckbot/shared'

const route = useRoute()
const office = useOffice(route.query.office as string)

const tasksApi = useTasks()
const eventsApi = useOfficeEvents()

const tasks = ref<OfficeTask[]>([])
const events = ref<OfficeEvent[]>([])
const tasksLoading = ref(false)
const eventsLoading = ref(false)

const {
  officeId,
  agents,
  ceo,
  employees,
  loading,
  selectedAgent,
  selectAgent,
  selectCeo,
  clearSelection,
  setOfficeId,
  load: loadAgents,
} = office

async function loadTasks() {
  tasksLoading.value = true
  try {
    tasks.value = await tasksApi.listByOffice(officeId.value)
  } catch {
    tasks.value = []
  } finally {
    tasksLoading.value = false
  }
}

let unsubscribeEvents: (() => void) | null = null

function isTaskEvent(eventType: string) {
  return eventType.startsWith('TASK_')
}

function isAgentEvent(eventType: string) {
  return eventType.startsWith('AGENT_')
}

function handleLiveEvent(event: OfficeEvent) {
  events.value = [event, ...events.value]
  if (isTaskEvent(event.eventType)) {
    loadTasks()
  }
  if (isAgentEvent(event.eventType)) {
    loadAgents()
  }
}

async function loadEvents() {
  if (unsubscribeEvents) {
    unsubscribeEvents()
    unsubscribeEvents = null
  }

  eventsLoading.value = true
  try {
    events.value = await eventsApi.listByOffice(officeId.value)
    unsubscribeEvents = eventsApi.subscribeToOffice(
      officeId.value,
      handleLiveEvent,
    )
  } catch {
    events.value = []
  } finally {
    eventsLoading.value = false
  }
}

onMounted(() => {
  loadAgents()
  loadTasks()
  loadEvents()
})

onUnmounted(() => {
  if (unsubscribeEvents) {
    unsubscribeEvents()
    unsubscribeEvents = null
  }
})

watch(
  () => route.query.office,
  (id) => {
    setOfficeId(id as string)
    loadAgents()
    loadTasks()
    loadEvents()
  },
)
</script>
