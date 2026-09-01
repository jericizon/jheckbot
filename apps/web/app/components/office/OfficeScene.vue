<template>
  <section class="w-full" :class="{ 'h-full': props.fullHeight }" aria-label="Virtual office">
    <div
      v-if="loading"
      class="flex items-center justify-center h-60 rounded-xl border-2 border-dashed border-border bg-surface-elevated text-sm text-content-subtle"
    >
      Loading office...
    </div>

    <div
      v-else-if="!ceo && employees.length === 0"
      class="flex flex-col items-center justify-center h-60 rounded-xl border-2 border-dashed border-border bg-surface-elevated text-sm text-content-subtle text-center px-4"
    >
      No one is in this office yet.
    </div>

    <div
      v-else
      class="relative rounded-2xl border-2 border-border overflow-hidden shadow-lg bg-surface"
      :class="{ 'h-full': props.fullHeight }"
      :style="{ height: props.fullHeight ? '100%' : sceneHeight }"
    >
      <!-- Hallway divisions -->
      <div
        v-for="(hall, i) in hallways"
        :key="`hall-${i}`"
        class="absolute left-0 right-0 bg-surface-subtle/60 border-y border-border pointer-events-none"
        :style="{ top: `${hall.top}%`, height: `${hall.height}%` }"
        aria-hidden="true"
      />

      <!-- Room boxes (top-view office rooms with furniture).
           The Thinking Room is drawn by OfficeConferenceRoom instead. -->
      <OfficeRoom
        v-for="room in rooms.filter((r) => r.id !== 'thinking-room')"
        :key="room.id"
        :label="room.label"
        :left="room.left"
        :top="room.top"
        :width="room.width"
        :height="room.height"
      />

      <!-- Walk paths connecting rooms -->
      <div
        v-for="road in roads"
        :key="road.id"
        class="absolute pointer-events-none rounded-full"
        :style="roadStyle(road)"
        aria-hidden="true"
      >
        <div class="absolute inset-0 bg-surface-subtle/40 rounded-full" />
        <div
          class="absolute inset-0 rounded-full"
          :style="pathStripeStyle(road)"
        />
      </div>

      <div
        class="relative z-10 w-full h-full transition-transform duration-700 ease-out will-change-transform"
        :style="meetingActive ? zoomStyle : { transform: 'none' }"
      >
        <!-- CEO character — walks to the Thinking Room while a task runs, returns when done -->
        <div
          v-if="ceo"
          class="absolute z-20 transition-all duration-[1200ms] ease-in-out"
          :style="ceoWalkStyle"
        >
          <OfficeCornerOffice
            :agent="ceo"
            :message="agentMessages[ceo.id]"
            :busy="busy"
            :reacting="reacting"
            :reaction-message="reactionMessage"
            @select="$emit('open-ceo-chat')"
          />
        </div>

        <!-- Thinking Room — room visuals only; meeting participants are
             rendered as walking characters above so they animate in. -->
        <div class="absolute z-10" :style="thinkingRoomStyle">
          <OfficeConferenceRoom
            :participants="[]"
            :active="meetingActive"
            :busy="busy"
            :messages="agentMessages"
          />
        </div>

        <!-- Employee cubicles — only agents not currently in the thinking room -->
        <div
          v-for="slot in cubicleSlots"
          :key="slot.emp.id"
          class="absolute"
          :style="cellStyle(slot.pos)"
        >
          <OfficeCubicle :agent="slot.emp" :message="agentMessages[slot.emp.id]" :busy="busy" />
        </div>

        <!-- Meeting employees walking from their cubicles to the thinking room.
             Each character animates from its cubicle coords to a seat around
             the thinking table via a CSS transition on left/top. -->
        <div
          v-for="(emp, i) in meetingEmployees"
          :key="`walk-${emp.id}`"
          class="absolute z-20 -translate-x-1/2 -translate-y-1/2 scale-75 transition-all duration-[1200ms] ease-in-out"
          :style="walkStyle(emp.id, i)"
        >
          <OfficeCharacter
            :agent="emp"
            :busy="busy"
            :seated="!isWalking(emp.id)"
            :brainstorming="meetingActive && !agentMessages[emp.id]"
            :message="agentMessages[emp.id]"
          />
        </div>

        <!-- Sub-agents stationed in their rooms (QA and Support, available for delegation) -->
        <div
          v-for="(sub, i) in subAgents"
          :key="`sub-${sub.id}`"
          class="absolute z-10 -translate-x-1/2 -translate-y-1/2 scale-75"
          :style="subAgentSeatStyle(i)"
        >
          <OfficeCharacter
            :agent="sub"
            :busy="busy"
          />
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, reactive, watch, nextTick, onMounted, onUnmounted } from 'vue'
import type { OfficeAgent, AgentStatus } from '@jheckbot/shared'
import {
  gridColumns,
  gridPositions,
  sceneHeightFor,
  midZoneLayout,
  conferenceSeats,
  hallwayPositions,
  roomLayout,
  roadLayout,
  type RoadSegment,
} from '~/utils/cubicleLayout'
import OfficeCornerOffice from './OfficeCornerOffice.vue'
import OfficeCubicle from './OfficeCubicle.vue'
import OfficeCharacter from './OfficeCharacter.vue'
import OfficeConferenceRoom from './OfficeConferenceRoom.vue'
import OfficeRoom from './OfficeRoom.vue'

const props = withDefaults(
  defineProps<{
    agents: OfficeAgent[]
    ceo?: OfficeAgent
    employees: OfficeAgent[]
    loading?: boolean
    busy?: boolean
    reacting?: boolean
    reactionMessage?: string
    fullHeight?: boolean
    agentMessages?: Record<string, string>
  }>(),
  { busy: false, reacting: false, reactionMessage: '', fullHeight: false, agentMessages: () => ({}) },
)

const emit = defineEmits<{ 'open-ceo-chat': [] }>()

const windowWidth = ref(typeof window === 'undefined' ? 1024 : window.innerWidth)

function onResize() {
  windowWidth.value = window.innerWidth
}

onMounted(() => window.addEventListener('resize', onResize))
onUnmounted(() => window.removeEventListener('resize', onResize))

const viewport = computed<'mobile' | 'desktop'>(() =>
  windowWidth.value < 640 ? 'mobile' : 'desktop',
)

const IDLE_STATUSES: AgentStatus[] = ['idle', 'completed']

// Only show employees that have been called to work; idle ones stay hidden
// until a task dispatches them. This keeps the office focused on the CEO
// until other agents are actually needed.
const calledEmployees = computed(() =>
  props.employees.filter((a) => !IDLE_STATUSES.includes(a.status)),
)

const cols = computed(() => gridColumns(calledEmployees.value.length, viewport.value))
const calledPositions = computed(() =>
  gridPositions(calledEmployees.value.length, cols.value),
)
const sceneHeight = computed(() => sceneHeightFor(calledEmployees.value.length, cols.value))
const midZone = computed(() => midZoneLayout())
const hallways = computed(() => hallwayPositions())
const rooms = computed(() => roomLayout())
const roads = computed(() => roadLayout())

const MEETING_STATUSES: AgentStatus[] = ['communicating', 'thinking']

const meetingEmployees = computed(() =>
  calledEmployees.value.filter((a) => MEETING_STATUSES.includes(a.status)),
)
const ceoInMeeting = computed(
  () => !!props.ceo && MEETING_STATUSES.includes(props.ceo.status),
)
// CEO joins the thinking room when the meeting is active.
const meetingParticipants = computed(() =>
  ceoInMeeting.value && props.ceo ? [props.ceo, ...meetingEmployees.value] : meetingEmployees.value,
)
const meetingActive = computed(() => meetingParticipants.value.length > 0)

// Cubicle slots for employees NOT in the thinking room. Meeting employees and
// anyone mid-walk are excluded so they don't double-render at their cubicle.
const cubicleSlots = computed(() =>
  calledEmployees.value
    .map((emp, index) => ({ emp, pos: calledPositions.value[index] }))
    .filter(({ emp }) => !MEETING_STATUSES.includes(emp.status) && !walkState[emp.id]),
)

// Thinking-room seat positions (scene %) for meeting employees, arranged
// around the table. Reserve the top seat for the CEO.
const meetingEmployeeSeats = computed(() => {
  const seats = conferenceSeats(meetingEmployees.value.length + 1)
  // Skip seat 0 (top center, CEO's seat) for employees.
  return seats.slice(1)
})

// Walk state: per-agent current {left, top} in scene %. When an agent enters
// the meeting we seed it with their cubicle coords, then on the next tick move
// them to their thinking-room seat — the CSS transition animates the walk.
const walkState = reactive({} as Record<string, { left: number; top: number }>)

function cubiclePosFor(agentId: string): { left: number; top: number } {
  const idx = calledEmployees.value.findIndex((e) => e.id === agentId)
  return calledPositions.value[idx] ?? midZone.value.conference
}

// An agent is "walking" while its walkState hasn't settled on a seat yet. We
// treat the seat target as arrived once it matches the seat position.
function isWalking(agentId: string): boolean {
  const state = walkState[agentId]
  if (!state) return false
  const idx = meetingEmployees.value.findIndex((e) => e.id === agentId)
  const seat = meetingEmployeeSeats.value[idx]
  if (!seat) return true
  return Math.abs(state.left - seat.left) > 0.5 || Math.abs(state.top - seat.top) > 0.5
}

watch(
  meetingEmployees,
  (list, oldList) => {
    const oldIds = new Set((oldList ?? []).map((a) => a.id))
    // New arrivals: start at the cubicle, then walk to a seat next tick.
    list.forEach((emp, i) => {
      if (!oldIds.has(emp.id)) {
        const start = cubiclePosFor(emp.id)
        walkState[emp.id] = { left: start.left, top: start.top }
        nextTick(() => {
          const seat = meetingEmployeeSeats.value[i] ?? midZone.value.conference
          walkState[emp.id] = { left: seat.left, top: seat.top }
        })
      }
    })
    // Leavers: walk back to their cubicle, then drop after the transition.
    for (const id of Object.keys(walkState)) {
      if (!list.some((e) => e.id === id)) {
        const home = cubiclePosFor(id)
        walkState[id] = { left: home.left, top: home.top }
        setTimeout(() => {
          delete walkState[id]
        }, 1200)
      }
    }
  },
  { immediate: true },
)

// CEO walks from the office to the thinking room when a task is running and
// stays there until the task completes, then walks back to the office.
// `reacting` gives the initial walk-off beat on send; `busy` holds the CEO in
// the thinking room for the whole task duration.
const ceoInThinkingRoom = computed(() => props.busy || props.reacting || ceoInMeeting.value)
const ceoWalkStyle = computed(() => {
  const pos = ceoInThinkingRoom.value ? midZone.value.conference : midZone.value.ceo
  return {
    left: `${pos.left}%`,
    top: `${pos.top}%`,
    transform: 'translate(-50%, -50%)',
  }
})

// Thinking Room fills its room box so it has space for sub-agents.
const thinkingRoomStyle = computed(() => {
  const box = rooms.value.find((r) => r.id === 'thinking-room')
  if (!box) return cellStyle(midZone.value.conference)
  return {
    left: `${box.left}%`,
    top: `${box.top}%`,
    width: `${box.width}%`,
    height: `${box.height}%`,
  }
})

// Zoom the scene so the thinking room fills the panel while a meeting runs.
// Thinking room center sits at midZone.conference (left 78%, top ~59%).
// Scale around the top-left, then translate so that point lands at the center.
const ZOOM_SCALE = 2.4
const zoomStyle = computed(() => {
  const { left, top } = midZone.value.conference
  const tx = (0.5 - (left / 100) * ZOOM_SCALE) * 100
  const ty = (0.5 - (top / 100) * ZOOM_SCALE) * 100
  return {
    transform: `translate(${tx}%, ${ty}%) scale(${ZOOM_SCALE})`,
    transformOrigin: '0 0',
  }
})

function cellStyle(pos: { left: number; top: number }) {
  return {
    left: `${pos.left}%`,
    top: `${pos.top}%`,
    transform: 'translate(-50%, -50%)',
  }
}

function roadStyle(road: RoadSegment) {
  return {
    left: `${road.left}%`,
    top: `${road.top}%`,
    width: `${road.width}%`,
    height: `${road.height}%`,
  }
}

// Dotted stripe direction: horizontal paths use horizontal dashes, vertical
// paths use vertical dashes.
function pathStripeStyle(road: RoadSegment) {
  const isVertical = road.height > road.width
  const angle = isVertical ? '0deg' : '90deg'
  return {
    backgroundImage: `repeating-linear-gradient(${angle}, var(--border, #d1d5db) 0, var(--border, #d1d5db) 4px, transparent 4px, transparent 10px)`,
    opacity: '0.5',
  }
}

// Position for a meeting employee. Falls back to the thinking-room center if
// the walk state hasn't been seeded yet (e.g. first render).
function walkStyle(agentId: string, index: number) {
  const state = walkState[agentId]
  const seat = meetingEmployeeSeats.value[index] ?? midZone.value.conference
  const pos = state ?? seat
  return {
    left: `${pos.left}%`,
    top: `${pos.top}%`,
  }
}

// Default sub-agents stationed in their rooms, waiting for delegation.
const SUB_AGENT_DEFS = [
  { id: 'sub-qa', name: 'QA', role: 'QA' },
  { id: 'sub-support', name: 'Support', role: 'Support' },
] as const

const subAgents = computed<OfficeAgent[]>(() =>
  SUB_AGENT_DEFS.map((def) => ({
    id: def.id,
    officeId: '',
    name: def.name,
    role: def.role,
    status: 'idle' as AgentStatus,
    enabled: true,
    createdAt: '',
    updatedAt: '',
  })),
)

// Position each sub-agent inside its room center.
function subAgentSeatStyle(index: number) {
  const subRooms = rooms.value.filter((r) => r.id === 'qa-office' || r.id === 'support-office')
  const room = subRooms[index]
  if (!room) return { left: '50%', top: '50%' }
  return {
    left: `${room.left + room.width / 2}%`,
    top: `${room.top + room.height / 2}%`,
  }
}
</script>
