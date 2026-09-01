<template>
  <section
    class="office-pixi relative w-full overflow-hidden bg-[#1c1c22] select-none"
    :class="{ 'h-full': props.fullHeight }"
    :style="{ height: props.fullHeight ? '100%' : props.height }"
    aria-label="Virtual office"
  >
    <canvas ref="canvasRef" class="office-canvas block w-full h-full" />

    <!-- Loading / empty states -->
    <div
      v-if="loading"
      class="office-overlay flex items-center justify-center text-[#f4ecd8] text-xs tracking-widest"
    >
      LOADING OFFICE...
    </div>
    <div
      v-else-if="!hasAgents"
      class="office-overlay flex flex-col items-center justify-center text-center px-4 text-[#b09d80] text-xs tracking-widest"
    >
      NO ONE IS IN THIS OFFICE YET.
    </div>

    <!-- Top bar -->
    <div class="office-topbar">
      <span class="office-brand">JHECKBOT</span>
      <span class="office-stat"><i class="office-dot office-dot-green" />{{ stats.agentsOnline }} AGENTS</span>
      <span class="office-stat"><i class="office-dot office-dot-yellow" />{{ stats.tasksRunning }} TASKS</span>
    </div>

    <!-- Bottom controls -->
    <div class="office-controls">
      <button class="office-btn" title="Zoom in" @click="zoomIn">+</button>
      <button class="office-btn" title="Zoom out" @click="zoomOut">-</button>
      <button class="office-btn" title="Center office" @click="resetCamera">CENTER</button>
      <button
        class="office-btn"
        :class="{ 'office-btn-active': fullscreen }"
        :title="fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'"
        @click="$emit('toggle-fullscreen')"
      >{{ fullscreen ? 'EXIT' : 'FULL' }}</button>
    </div>

    <!-- Selected agent panel -->
    <div v-if="selection" class="office-panel">
      <div class="office-panel-header">
        <span class="office-panel-name">{{ selection.name }}</span>
        <button class="office-panel-close" @click="clearSelection">×</button>
      </div>
      <div class="office-panel-role">{{ roleLabel(selection.role) }}</div>
      <div class="office-panel-state">
        <i class="office-dot" :class="stateDotClass(selection.state)" />
        {{ selection.state.toUpperCase() }}
      </div>
      <div v-if="selection.task" class="office-panel-task">
        <div class="office-panel-task-label">CURRENT TASK</div>
        <div class="office-panel-task-title">{{ selection.task.title }}</div>
        <div class="office-panel-task-status" :class="taskStatusClass(selection.task.status)">
          {{ selection.task.status.replace('_', ' ').toUpperCase() }}
        </div>
      </div>
      <div v-if="selection.provider" class="office-panel-meta">
        {{ selection.provider }} · {{ selection.model || '?' }}
      </div>
      <div class="office-panel-actions">
        <button v-if="selection.role === 'ceo'" class="office-btn" @click="openCeoChat">OPEN CEO CHAT</button>
        <button class="office-btn" disabled>VIEW TASKS</button>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { OfficeAgent } from '@jheckbot/shared'
import {
  CollaborationTimeline,
  EventBus,
  VirtualOffice,
  type AgentDescriptor,
  type AgentVisualState,
  type SelectionInfo,
} from '~/office'

const props = withDefaults(
  defineProps<{
    agents?: OfficeAgent[]
    ceo?: OfficeAgent | null
    employees?: OfficeAgent[]
    loading?: boolean
    busy?: boolean
    reacting?: boolean
    reactionMessage?: string
    agentMessages?: Record<string, string>
    fullHeight?: boolean
    height?: string
    fullscreen?: boolean
  }>(),
  {
    agents: () => [],
    employees: () => [],
    loading: false,
    busy: false,
    reacting: false,
    agentMessages: () => ({}),
    fullHeight: false,
    height: '420px',
    fullscreen: false,
  },
)

const emit = defineEmits<{
  'open-ceo-chat': []
  'toggle-fullscreen': []
  select: [SelectionInfo | null]
}>()

const canvasRef = ref<HTMLCanvasElement | null>(null)
const selection = ref<SelectionInfo | null>(null)
const stats = ref({ agentsOnline: 0, tasksRunning: 0 })

let office: VirtualOffice | null = null
let bus: EventBus | null = null
let lastMessageKeys = new Set<string>()
// Track which live agents we've already created so we don't re-spawn.
const liveAgentIds = new Set<string>()
// Track the last visual state we applied per agent so we only trigger
// movement when the status actually changes.
const liveAgentStates = new Map<string, AgentVisualState>()

const hasAgents = ref(false)
const officeReady = ref(false)
const collabRunning = ref(false)
let collabTimeline: CollaborationTimeline | null = null

function roleLabel(role: SelectionInfo['role']): string {
  switch (role) {
    case 'ceo':
      return 'Chief Executive Officer'
    case 'backend':
      return 'Backend Engineer'
    case 'frontend':
      return 'Frontend Engineer'
    case 'qa':
      return 'QA Engineer'
    case 'designer':
      return 'Designer'
    case 'devops':
      return 'DevOps Engineer'
    default:
      return role
  }
}

function stateDotClass(state: AgentVisualState): string {
  switch (state) {
    case 'working':
    case 'coding':
    case 'testing':
    case 'reviewing':
      return 'office-dot-blue'
    case 'thinking':
    case 'waiting':
      return 'office-dot-yellow'
    case 'success':
      return 'office-dot-green'
    case 'error':
    case 'blocked':
      return 'office-dot-red'
    case 'communicating':
    case 'meeting':
      return 'office-dot-orange'
    case 'offline':
      return 'office-dot-gray'
    default:
      return 'office-dot-gray'
  }
}

function taskStatusClass(status: string): string {
  if (status === 'completed') return 'office-task-done'
  if (status === 'failed') return 'office-task-fail'
  if (status === 'blocked') return 'office-task-block'
  return 'office-task-run'
}

onMounted(async () => {
  const canvas = canvasRef.value
  if (!canvas) return
  const parent = canvas.parentElement
  const w = parent?.clientWidth ?? 800
  const h = parent?.clientHeight ?? 420
  bus = new EventBus()
  office = new VirtualOffice(canvas, w, h, bus, {
    onSelect: (info) => {
      selection.value = info
      emit('select', info)
    },
    onOpenCeoChat: () => emit('open-ceo-chat'),
    onStats: (s) => {
      stats.value = s
    },
  })

  // Observe resize.
  if (parent && 'ResizeObserver' in window) {
    const ro = new ResizeObserver(() => {
      if (!office) return
      office.resize(parent.clientWidth, parent.clientHeight)
    })
    ro.observe(parent)
    ;(office as unknown as { _ro?: ResizeObserver })._ro = ro
  }

  // Wait for the Pixi app to finish async init before driving agents.
  await office.ready
  officeReady.value = true
  syncLiveAgents()
})

onBeforeUnmount(() => {
  collabTimeline?.cancel()
  collabTimeline = null
  const o = office as unknown as { _ro?: ResizeObserver } | null
  o?._ro?.disconnect()
  office?.destroy()
  office = null
  bus = null
})

// ---- Live agent sync (maps backend OfficeAgent -> engine) ----

function agentStatusToVisual(status: OfficeAgent['status']): AgentVisualState {
  switch (status) {
    case 'thinking':
      return 'thinking'
    case 'working':
      return 'working'
    case 'communicating':
      return 'communicating'
    case 'reviewing':
      return 'reviewing'
    case 'testing':
      return 'testing'
    case 'blocked':
      return 'blocked'
    case 'error':
      return 'error'
    case 'completed':
      return 'success'
    default:
      return 'idle'
  }
}

function inferRole(agent: OfficeAgent): AgentDescriptor['role'] {
  const r = agent.role.toLowerCase()
  if (/ceo|orchestr|exec/.test(r)) return 'ceo'
  if (/backend|server|api/.test(r)) return 'backend'
  if (/front|ui|web/.test(r)) return 'frontend'
  if (/qa|test/.test(r)) return 'qa'
  if (/design/.test(r)) return 'designer'
  if (/devops|infra|deploy/.test(r)) return 'devops'
  return 'backend'
}

function syncLiveAgents(): void {
  if (!office) return
  const all = [...(props.ceo ? [props.ceo] : []), ...props.employees, ...props.agents]
  const seen = new Set<string>()
  hasAgents.value = all.length > 0
  for (const a of all) {
    seen.add(a.id)
    const desc: AgentDescriptor = {
      id: a.id,
      name: a.name,
      role: inferRole(a),
      provider: a.provider,
      model: a.model,
    }
    const isNew = !liveAgentIds.has(a.id)
    if (isNew) {
      office.createAgent(desc)
      liveAgentIds.add(a.id)
    }

    const visual = agentStatusToVisual(a.status)
    const prev = liveAgentStates.get(a.id)
    if (isNew || prev !== visual) {
      liveAgentStates.set(a.id, visual)
      // Working-type states trigger movement to the workstation.
      if (visual === 'working' || visual === 'reviewing' || visual === 'testing') {
        void office.workAt(a.id, visual)
      } else if (visual === 'thinking') {
        office.think(a.id)
      } else if (visual === 'communicating') {
        office.setState(a.id, 'communicating')
      } else if (visual === 'blocked' || visual === 'error') {
        office.fail(a.id)
      } else if (visual === 'success') {
        office.succeed(a.id)
      } else if (isNew) {
        // New idle agents walk to their workstation and sit.
        void office.workAt(a.id, 'idle')
      } else {
        office.setState(a.id, visual)
      }
    }
  }
  // Agents that disappeared go offline.
  for (const id of liveAgentIds) {
    if (!seen.has(id)) {
      office.setState(id, 'offline')
      liveAgentStates.delete(id)
    }
  }
}

// Watch live props.
watch(
  () => [props.agents, props.ceo, props.employees],
  () => {
    if (office && officeReady.value) syncLiveAgents()
  },
  { deep: true },
)

watch(
  () => props.busy,
  (busy) => {
    if (!office || !officeReady.value || !props.ceo) return
    if (busy) {
      // CEO walks to their office and thinks.
      void office.workAt(props.ceo.id, 'thinking')
    } else {
      office.idle(props.ceo.id)
    }
  },
)

watch(
  () => props.agentMessages,
  (msgs) => {
    if (!office || !officeReady.value) return
    // Send an envelope for each new from-agent message.
    for (const [fromId, content] of Object.entries(msgs)) {
      const key = `${fromId}:${content}`
      if (lastMessageKeys.has(key)) continue
      lastMessageKeys.add(key)
      // Keep the set from growing forever.
      if (lastMessageKeys.size > 40) lastMessageKeys = new Set([...lastMessageKeys].slice(-20))
      // Recipient: prefer CEO if the sender isn't the CEO, else first employee.
      const sender = findLiveAgentById(fromId)
      if (!sender) continue
      const recipient = props.ceo && props.ceo.id !== fromId ? props.ceo : props.employees[0]
      if (!recipient) continue
      void office.message(fromId, recipient.id, 'normal')
    }
  },
  { deep: true },
)

function findLiveAgentById(id: string): OfficeAgent | undefined {
  return [...(props.ceo ? [props.ceo] : []), ...props.employees, ...props.agents].find(
    (a) => a.id === id,
  )
}

// ---- Camera controls ----

function zoomIn(): void {
  office?.zoomIn()
}
function zoomOut(): void {
  office?.zoomOut()
}
function resetCamera(): void {
  office?.resetCamera()
}
function clearSelection(): void {
  office?.select(null)
}
function openCeoChat(): void {
  emit('open-ceo-chat')
}

// Run the collaboration choreography: everyone gathers in the collaboration
// room for a chit-chat, returns to their workstation, QA works last, walks to
// the CEO office to report, and confetti celebrates the completed task.
function runCollaboration(): void {
  if (!office || !officeReady.value || collabRunning.value) return
  collabRunning.value = true
  collabTimeline = new CollaborationTimeline(office, { speed: 1 })
  collabTimeline.run().finally(() => {
    collabRunning.value = false
    collabTimeline = null
  })
}

// Expose runCollaboration so the parent page can trigger it automatically
// when the user submits a prompt, instead of via a manual button.
defineExpose({ runCollaboration })
</script>

<style scoped>
.office-pixi {
  border: 2px solid #2b2b33;
  font-family: ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace;
  color: #f4ecd8;
  image-rendering: pixelated;
}
.office-canvas {
  image-rendering: pixelated;
  image-rendering: crisp-edges;
}
.office-overlay {
  position: absolute;
  inset: 0;
  background: rgba(28, 28, 34, 0.85);
  z-index: 30;
}
.office-topbar {
  position: absolute;
  top: 8px;
  left: 8px;
  right: 8px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 6px 10px;
  background: #2b2b33;
  border: 2px solid #1c1c22;
  box-shadow: 0 2px 0 #1c1c22;
  font-size: 10px;
  letter-spacing: 1px;
  z-index: 20;
  pointer-events: none;
}
.office-brand {
  color: #e8c34a;
  font-weight: 700;
  letter-spacing: 2px;
}
.office-stat {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: #b09d80;
}
.office-dot {
  display: inline-block;
  width: 7px;
  height: 7px;
  background: #6b727f;
}
.office-dot-green { background: #6b8f6a; }
.office-dot-blue { background: #5b7ea8; }
.office-dot-yellow { background: #e8c34a; }
.office-dot-red { background: #b5544a; }
.office-dot-orange { background: #d98a4a; }
.office-dot-gray { background: #6b727f; }

.office-controls {
  position: absolute;
  bottom: 8px;
  left: 8px;
  display: flex;
  gap: 6px;
  z-index: 20;
}
.office-btn {
  background: #2b2b33;
  border: 2px solid #1c1c22;
  box-shadow: 0 2px 0 #1c1c22;
  color: #f4ecd8;
  padding: 5px 9px;
  font-size: 10px;
  letter-spacing: 1px;
  cursor: pointer;
  font-family: inherit;
  border-radius: 0;
}
.office-btn:hover { background: #3c3c46; }
.office-btn:active { transform: translateY(1px); box-shadow: 0 1px 0 #1c1c22; }
.office-btn:disabled { color: #6b727f; cursor: not-allowed; }
.office-btn-active { background: #4f6f4e; border-color: #456a43; }

.office-panel {
  position: absolute;
  top: 48px;
  right: 8px;
  width: 200px;
  background: #2b2b33;
  border: 2px solid #1c1c22;
  box-shadow: 0 3px 0 #1c1c22;
  padding: 10px;
  z-index: 25;
  font-size: 10px;
  letter-spacing: 0.5px;
}
.office-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.office-panel-name {
  color: #e8c34a;
  font-weight: 700;
  letter-spacing: 1px;
}
.office-panel-close {
  background: transparent;
  border: 0;
  color: #b09d80;
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
}
.office-panel-role { color: #b09d80; margin-top: 2px; }
.office-panel-state {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  color: #f4ecd8;
}
.office-panel-task {
  margin-top: 8px;
  border-top: 1px solid #1c1c22;
  padding-top: 8px;
}
.office-panel-task-label { color: #6b727f; font-size: 9px; letter-spacing: 1px; }
.office-panel-task-title { color: #f4ecd8; margin-top: 2px; }
.office-panel-task-status { margin-top: 4px; font-size: 9px; letter-spacing: 1px; }
.office-task-run { color: #5b7ea8; }
.office-task-done { color: #6b8f6a; }
.office-task-fail { color: #b5544a; }
.office-task-block { color: #d98a4a; }
.office-panel-meta { margin-top: 8px; color: #6b727f; font-size: 9px; }
.office-panel-actions {
  margin-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.office-panel-actions .office-btn { width: 100%; text-align: center; }
</style>
