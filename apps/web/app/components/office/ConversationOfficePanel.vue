<template>
  <section
    class="flex flex-col h-full bg-surface p-4"
    aria-label="Project office"
  >
    <header class="shrink-0 flex items-center gap-3 py-3 border-b border-border">
      <button
        @click="toggleSidebar"
        class="xl:hidden p-1.5 -ml-1 rounded-md text-content-subtle hover:text-content hover:bg-surface-subtle transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
        aria-label="Toggle sidebar"
        title="Toggle sidebar"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16" /></svg>
      </button>
      <div class="flex-1 min-w-0">
        <h2 class="text-sm font-semibold text-content">Office</h2>
        <p v-if="office" class="text-[10px] text-content-subtle truncate">
          {{ office.name }}
        </p>
      </div>
    </header>

    <div class="flex-1 min-h-0">
      <OfficePixi
        ref="officePixiRef"
        :agents="agents"
        :ceo="ceo"
        :employees="employees"
        :loading="loading"
        :busy="busy || !!activeExecution"
        :reacting="reacting"
        :reaction-message="reactionMessage"
        :agent-messages="agentMessages"
        full-height
        @open-ceo-chat="chatOpen = true"
      />
    </div>

    <CEOChatPanel
      :open="chatOpen"
      :office-id="office?.id ?? ''"
      :project-id="props.projectId"
      @close="chatOpen = false"
    />
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import type { Office, OfficeAgent, OfficeEvent } from '@jheckbot/shared'
import { useOffices } from '~/composables/useOffices'
import { useOfficeEvents } from '~/composables/useOfficeEvents'
import { findCeo, findEmployees } from '~/composables/useOffice'
import OfficePixi from './OfficePixi.vue'
import CEOChatPanel from './CEOChatPanel.vue'

const props = defineProps<{
  projectId: string
  busy?: boolean
  reacting?: boolean
  reactionMessage?: string
}>()

const emit = defineEmits<{
  'office-loaded': [Office]
}>()

const officesApi = useOffices()
const eventsApi = useOfficeEvents()
const { toggle: toggleSidebar } = useSidebar()

const loading = ref(false)
const office = ref<Office | null>(null)
const officePixiRef = ref<{ runCollaboration: () => void } | null>(null)
const agents = ref<OfficeAgent[]>([])
const agentMessages = ref<Record<string, string>>({})
const chatOpen = ref(false)
const activeExecution = ref<{ taskId: string; conversationId?: string; status: string } | null>(null)
let unsubscribe: (() => void) | null = null

const ceo = computed(() => findCeo(agents.value))
const employees = computed(() => findEmployees(agents.value, ceo.value))

function handleEvent(event: OfficeEvent) {
  // Refresh agents on agent or task events so movement reflects live status.
  if (event.eventType.startsWith('AGENT_') || event.eventType.startsWith('TASK_')) {
    loadAgents()
  }

  // Show agent-to-agent speech bubbles for the latest AGENT_MESSAGE.
  if (event.eventType === 'AGENT_MESSAGE' && event.metadata?.fromAgentId) {
    const from = event.metadata.fromAgentId as string
    agentMessages.value = { ...agentMessages.value, [from]: event.content ?? '' }
  }

  // Track the active CEO execution so the CEO stays in the thinking room while
  // work is happening and the chat can guard duplicate submissions.
  if (event.eventType === 'CEO_RESPONSE' && event.metadata?.execution) {
    const execution = event.metadata.execution as { taskId: string; conversationId?: string; status: string }
    activeExecution.value = execution.status === 'started' ? execution : null
  }

  const terminalTypes = new Set(['AGENT_COMPLETED', 'AGENT_FAILED', 'TASK_COMPLETED', 'TASK_FAILED'])
  if (terminalTypes.has(event.eventType) && event.metadata?.taskId === activeExecution.value?.taskId) {
    activeExecution.value = null
  }
}

async function loadAgents() {
  if (!office.value) return
  try {
    const list = await officesApi.getOrCreateByProject(props.projectId)
    agents.value = list.agents
    // Clear speech bubbles for agents that are no longer active so stale
    // messages don't linger once work is done.
    pruneIdleMessages(list.agents)
  } catch {
    // Keep existing agents on refresh failure.
  }
}

function pruneIdleMessages(next: OfficeAgent[]) {
  const active = next.filter((a) => a.status !== 'idle' && a.status !== 'completed')
  if (active.length === 0) {
    // Nobody is working — drop every lingering bubble.
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

async function loadOffice() {
  loading.value = true
  try {
    const result = await officesApi.getOrCreateByProject(props.projectId)
    office.value = result.office
    agents.value = result.agents
    emit('office-loaded', result.office)

    if (unsubscribe) {
      unsubscribe()
      unsubscribe = null
    }
    unsubscribe = eventsApi.subscribeToOffice(result.office.id, handleEvent)
  } catch {
    office.value = null
    agents.value = []
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadOffice()
})

onUnmounted(() => {
  if (unsubscribe) {
    unsubscribe()
    unsubscribe = null
  }
})

watch(() => props.projectId, loadOffice)

// Forward the collaboration choreography trigger to the parent page so a
// prompt can fire the gather -> work -> QA -> CEO -> confetti sequence.
function runCollaboration(): void {
  officePixiRef.value?.runCollaboration()
}

defineExpose({ runCollaboration })
</script>
