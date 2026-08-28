<template>
  <section class="w-full" aria-label="Virtual office">
    <div
      v-if="loading"
      class="flex items-center justify-center h-60 sm:h-72 rounded-xl border-2 border-dashed border-border bg-surface-elevated text-sm text-content-subtle"
    >
      Loading office...
    </div>

    <div
      v-else-if="!ceo && employees.length === 0"
      class="flex flex-col items-center justify-center h-60 sm:h-72 rounded-xl border-2 border-dashed border-border bg-surface-elevated text-sm text-content-subtle text-center px-4"
    >
      <span class="text-2xl mb-2" aria-hidden="true">🏢</span>
      No one is in this office yet.
    </div>

    <div
      v-else
      class="relative rounded-2xl border-2 border-emerald-700/40 overflow-hidden shadow-xl"
      :style="{ height: sceneHeight }"
    >
      <!-- Grass terrain -->
      <div
        class="absolute inset-0 bg-gradient-to-b from-emerald-300 via-emerald-400 to-emerald-600 dark:from-emerald-800 dark:via-emerald-900 dark:to-emerald-950"
      />

      <!-- Grass tile grid -->
      <div
        class="absolute inset-0 opacity-20 pointer-events-none"
        style="
          background-image:
            repeating-linear-gradient(0deg, transparent, transparent 1.5rem, rgb(255 255 255 / 0.25) 1.5rem, rgb(255 255 255 / 0.25) 1.625rem),
            repeating-linear-gradient(90deg, transparent, transparent 1.5rem, rgb(255 255 255 / 0.25) 1.5rem, rgb(255 255 255 / 0.25) 1.625rem);
        "
      />

      <!-- Decorative props (trees, rocks, bushes) placed around the perimeter -->
      <div
        v-for="(prop, i) in scenery"
        :key="`prop-${i}`"
        class="absolute pointer-events-none select-none animate-prop-sway"
        :style="prop.style"
        :class="prop.delay ? `[animation-delay:${prop.delay}s]` : ''"
        aria-hidden="true"
      >
        <span class="text-xl sm:text-2xl drop-shadow">{{ prop.emoji }}</span>
      </div>

      <!-- Resource pills (CoC-style status counters) -->
      <div
        class="absolute top-2 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 sm:gap-2 px-2 py-1 rounded-full bg-black/30 backdrop-blur-sm border border-white/20"
      >
        <div
          v-for="pill in resourcePills"
          :key="pill.label"
          class="flex items-center gap-1 px-1.5 py-0.5 rounded-full"
          :title="`${pill.count} ${pill.label}`"
        >
          <span class="text-xs sm:text-sm" aria-hidden="true">{{ pill.icon }}</span>
          <span class="text-[10px] sm:text-xs font-bold text-white tabular-nums">
            {{ pill.count }}
          </span>
        </div>
      </div>

      <div class="relative z-10 w-full h-full">
        <!-- CEO Town Hall at the center -->
        <div
          class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-1.5"
        >
          <div class="relative animate-unit-bob">
            <!-- Town Hall building -->
            <div
              class="relative w-20 sm:w-28 bg-gradient-to-b from-amber-200 to-amber-400 border-2 border-amber-700 rounded-lg shadow-lg overflow-hidden"
            >
              <!-- Roof -->
              <div
                class="h-3 sm:h-4 bg-gradient-to-b from-red-500 to-red-700 border-b-2 border-red-900"
              />
              <!-- Door + windows -->
              <div class="px-2 py-1.5 sm:py-2 flex items-end justify-center gap-1.5">
                <div
                  class="w-3 h-4 sm:w-4 sm:h-5 bg-amber-900/70 rounded-t border border-amber-900"
                />
                <div
                  class="w-2.5 h-2.5 sm:w-3 sm:h-3 bg-sky-200/80 border border-amber-900 rounded-sm"
                />
              </div>
              <!-- Flag -->
              <div
                class="absolute -top-3 left-1/2 -translate-x-1/2 flex flex-col items-center"
              >
                <div class="w-0.5 h-3 bg-amber-900" />
                <div class="w-2 h-1.5 bg-red-500 -mt-0.5" />
              </div>
            </div>
          </div>

          <OfficeCharacter v-if="ceo" :agent="ceo" is-ceo @select="onCeoSelect" />
          <div v-else class="text-xs font-semibold text-white drop-shadow">
            No CEO assigned
          </div>
        </div>

        <!-- Employees arranged in a ring around the CEO -->
        <div
          v-for="(agent, index) in employees"
          :key="agent.id"
          class="absolute flex flex-col items-center gap-1"
          :style="ringStyle(index)"
        >
          <!-- Cartoon hut tile -->
          <div
            class="bg-gradient-to-b from-sky-200 to-sky-400 dark:from-sky-700 dark:to-sky-900 border-2 border-sky-700 dark:border-sky-500 rounded-lg shadow-md w-16 sm:w-20 overflow-hidden"
          >
            <div
              class="h-2 sm:h-2.5 bg-gradient-to-b from-orange-400 to-orange-600 border-b border-orange-800"
            />
            <div class="py-1 flex items-center justify-center">
              <span class="text-[9px] text-sky-900 dark:text-sky-100 font-mono font-bold uppercase">
                {{ deskLabel(agent) }}
              </span>
            </div>
          </div>

          <OfficeCharacter :agent="agent" @select="onSelect" />
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { OfficeAgent, AgentStatus } from '@jheckbot/shared'
import OfficeCharacter from './OfficeCharacter.vue'

const props = defineProps<{
  agents: OfficeAgent[]
  ceo?: OfficeAgent
  employees: OfficeAgent[]
  loading?: boolean
}>()

const emit = defineEmits<{
  'select-agent': [OfficeAgent]
  'talk-to-ceo': []
}>()

// Ring radii (as % of the scene) scale with headcount so tiles never overlap.
const ringRadiusX = computed(() => {
  const count = props.employees.length
  if (count <= 4) return 38
  if (count <= 8) return 42
  return 45
})

const ringRadiusY = computed(() => {
  const count = props.employees.length
  if (count <= 4) return 34
  if (count <= 8) return 38
  return 41
})

// Scene grows with the ring so employees stay inside the frame.
const sceneHeight = computed(() => {
  const count = props.employees.length
  if (count === 0) return '22rem'
  if (count <= 4) return '24rem'
  if (count <= 8) return '28rem'
  return '32rem'
})

function onSelect(agent: OfficeAgent) {
  emit('select-agent', agent)
}

function onCeoSelect() {
  emit('talk-to-ceo')
}

// Place each employee on the ring at an evenly spaced angle, starting at the top.
function ringStyle(index: number) {
  const count = props.employees.length
  const angle = (360 / count) * index - 90
  const rad = (angle * Math.PI) / 180
  const left = 50 + Math.cos(rad) * ringRadiusX.value
  const top = 50 + Math.sin(rad) * ringRadiusY.value
  return {
    left: `${left}%`,
    top: `${top}%`,
    transform: 'translate(-50%, -50%)',
  }
}

function deskLabel(agent: OfficeAgent) {
  const role = agent.role.toLowerCase()
  if (role.includes('qa')) return 'QA'
  if (role.includes('review')) return 'REV'
  if (role.includes('devops')) return 'OPS'
  if (role.includes('frontend')) return 'FE'
  if (role.includes('backend')) return 'BE'
  if (role.includes('full')) return 'FS'
  return 'DEV'
}

// CoC-style resource pills: counts of agents grouped by status category.
const resourcePills = computed(() => {
  const all = [...props.employees, ...(props.ceo ? [props.ceo] : [])]
  const count = (pred: (s: AgentStatus) => boolean) =>
    all.filter((a) => pred(a.status)).length

  return [
    { icon: '⚔️', label: 'Working', count: count((s) => s === 'working' || s === 'testing' || s === 'reviewing') },
    { icon: '💬', label: 'Talking', count: count((s) => s === 'communicating' || s === 'thinking') },
    { icon: '💤', label: 'Idle', count: count((s) => s === 'idle') },
    { icon: '✅', label: 'Done', count: count((s) => s === 'completed') },
    { icon: '⚠️', label: 'Issues', count: count((s) => s === 'error' || s === 'blocked') },
  ]
})

// Decorative scenery props scattered around the village perimeter.
const scenery = computed(() => {
  const items = [
    { emoji: '🌳', x: 6, y: 14 },
    { emoji: '🪨', x: 88, y: 22 },
    { emoji: '🌲', x: 12, y: 78 },
    { emoji: '🌳', x: 90, y: 80 },
    { emoji: '🪨', x: 4, y: 50 },
    { emoji: '🌲', x: 94, y: 52 },
    { emoji: '🌻', x: 22, y: 8 },
    { emoji: '🍄', x: 78, y: 90 },
  ]
  return items.map((it, i) => ({
    emoji: it.emoji,
    delay: (i % 4) * 0.4,
    style: {
      left: `${it.x}%`,
      top: `${it.y}%`,
      transform: 'translate(-50%, -50%)',
    },
  }))
})
</script>
