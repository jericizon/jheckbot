<template>
  <div
    class="relative w-full h-full min-w-[20rem] min-h-[16rem]"
    aria-label="Thinking room"
  >
    <!-- Floor texture: subtle tile pattern (top view) -->
    <div
      class="absolute inset-0 rounded-lg opacity-25 border-2 border-border/70 bg-surface-elevated/30"
      style="background-image: linear-gradient(var(--border-subtle, #e5e7eb) 1px, transparent 1px), linear-gradient(90deg, var(--border-subtle, #e5e7eb) 1px, transparent 1px); background-size: 18px 18px;"
      aria-hidden="true"
    />

    <!-- Round thinking table (top view) -->
    <div
      class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[42%] aspect-square rounded-full bg-surface-elevated/90 border-2 border-border shadow-md flex items-center justify-center overflow-hidden"
      :class="{ 'animate-pulse': active }"
    >
      <!-- Planning props on the table during a meeting (top view) -->
      <div v-if="active" class="relative w-full h-full" aria-hidden="true">
        <span
          class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[9px] font-semibold text-content-subtle uppercase tracking-wide"
          >Brainstorm</span
        >
        <!-- Sticky notes scattered on the table -->
        <div class="absolute left-[18%] top-[22%] w-3.5 h-3.5 rounded-sm bg-amber-300/90 rotate-[-8deg] shadow-sm" />
        <div class="absolute right-[20%] top-[28%] w-3.5 h-3.5 rounded-sm bg-sky-300/90 rotate-[10deg] shadow-sm" />
        <div class="absolute left-[26%] bottom-[24%] w-3.5 h-3.5 rounded-sm bg-emerald-300/90 rotate-[6deg] shadow-sm" />
        <div class="absolute right-[24%] bottom-[20%] w-3.5 h-3.5 rounded-sm bg-pink-300/90 rotate-[-5deg] shadow-sm" />
        <!-- Laptop on the table (top view) -->
        <div class="absolute left-1/2 top-[38%] -translate-x-1/2 w-5 h-3.5 rounded-sm bg-slate-700 border border-slate-900" />
      </div>
    </div>

    <!-- Office chairs around the table (top view: small circles) -->
    <div
      v-for="(seat, i) in chairPositions"
      :key="`chair-${i}`"
      class="absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-content-subtle/30 border border-border/60"
      :style="{ left: `${seat.left}%`, top: `${seat.top}%`, width: '14%', height: '10%' }"
      aria-hidden="true"
    />

    <!-- Potted plant in the corner (top view) -->
    <div
      class="absolute left-[6%] top-[8%] w-[12%] aspect-square rounded-full bg-emerald-500/25 border border-emerald-700/40 flex items-center justify-center"
      aria-hidden="true"
    >
      <span class="text-[10px]">🪴</span>
    </div>

    <!-- Whiteboard on the wall (top view: thin rectangle along the top edge) -->
    <div
      v-if="active"
      class="absolute left-1/2 top-[4%] -translate-x-1/2 w-[55%] h-[8%] rounded-md bg-surface-elevated border border-border shadow-sm flex items-center justify-center"
      aria-hidden="true"
    >
      <span class="text-[8px] font-semibold text-content-subtle uppercase tracking-wide">Board</span>
    </div>

    <!-- Meeting participants seated around the table -->
    <div
      v-for="(agent, i) in seatedParticipants"
      :key="agent.id"
      class="absolute -translate-x-1/2 -translate-y-1/2 z-10 scale-75"
      :style="{ left: `${seatFor(i).left}%`, top: `${seatFor(i).top}%` }"
    >
      <OfficeCharacter
        :agent="agent"
        :is-ceo="isCeo(agent)"
        :seated="true"
        :brainstorming="active && !messages[agent.id]"
        :message="messages[agent.id]"
        :busy="busy"
      />
    </div>

    <!-- Empty state hint -->
    <div
      v-if="!active && seatedParticipants.length === 0"
      class="absolute bottom-1 left-1/2 -translate-x-1/2 text-[10px] text-content-subtle whitespace-nowrap"
    >
      Waiting for agents
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { OfficeAgent } from '@jheckbot/shared'
import OfficeCharacter from './OfficeCharacter.vue'

interface Seat {
  left: number
  top: number
}

const props = withDefaults(
  defineProps<{
    participants?: OfficeAgent[]
    active?: boolean
    busy?: boolean
    messages?: Record<string, string>
  }>(),
  {
    participants: () => [],
    active: false,
    busy: false,
    messages: () => ({}),
  },
)

const CHAIR_RADIUS_X = 42
const CHAIR_RADIUS_Y = 36

// Decorative empty chairs around the table (always visible, top view).
const chairPositions: Seat[] = [
  { left: 50, top: 12 },
  { left: 88, top: 50 },
  { left: 50, top: 88 },
  { left: 12, top: 50 },
]

// CEO sits at the head of the table (top center); employees fill the rest.
const seatedParticipants = computed(() => {
  const ceo = props.participants.find((a) => a.role.toLowerCase() === 'ceo')
  const rest = props.participants.filter((a) => a.role.toLowerCase() !== 'ceo')
  return [ceo, ...rest].filter((a): a is OfficeAgent => Boolean(a))
})

function isCeo(agent: OfficeAgent): boolean {
  return agent.role.toLowerCase() === 'ceo'
}

function seatFor(index: number): Seat {
  const count = Math.max(seatedParticipants.value.length, 1)
  const angle = (index / count) * Math.PI * 2 - Math.PI / 2
  return {
    left: 50 + Math.cos(angle) * CHAIR_RADIUS_X,
    top: 50 + Math.sin(angle) * CHAIR_RADIUS_Y,
  }
}
</script>
