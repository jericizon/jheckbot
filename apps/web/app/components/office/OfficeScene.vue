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
      class="relative rounded-2xl border-2 border-slate-400/40 dark:border-slate-600/40 overflow-hidden shadow-xl"
      :style="{ height: sceneHeight }"
    >
      <!-- Cartoon office floor -->
      <div
        class="absolute inset-0 bg-gradient-to-b from-slate-100 via-slate-200 to-slate-300 dark:from-slate-800 dark:via-slate-900 dark:to-slate-950"
      />

      <!-- Floor tile grid -->
      <div
        class="absolute inset-0 opacity-20 pointer-events-none"
        style="
          background-image:
            repeating-linear-gradient(0deg, transparent, transparent 1.5rem, rgb(255 255 255 / 0.3) 1.5rem, rgb(255 255 255 / 0.3) 1.625rem),
            repeating-linear-gradient(90deg, transparent, transparent 1.5rem, rgb(255 255 255 / 0.3) 1.5rem, rgb(255 255 255 / 0.3) 1.625rem);
        "
      />

      <!-- Decorative office props around perimeter -->
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

      <!-- Resource pills (status counters) -->
      <div
        class="absolute top-2 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 sm:gap-2 px-2 py-1 rounded-full bg-black/30 backdrop-blur-sm border border-white/20 dark:border-white/10"
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
        <!-- CEO corner office at center -->
        <div
          class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        >
          <OfficeCornerOffice v-if="ceo" :agent="ceo" @select="onCeoSelect" />
          <div v-else class="text-xs font-semibold text-content drop-shadow">
            No CEO assigned
          </div>
        </div>

        <!-- Employee cubicles in a grid -->
        <div
          v-for="(pos, index) in positions"
          :key="employees[index].id"
          class="absolute"
          :style="cellStyle(pos)"
        >
          <OfficeCubicle :agent="employees[index]" @select="onSelect" />
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import type { OfficeAgent, AgentStatus } from '@jheckbot/shared'
import { gridColumns, gridPositions, sceneHeightFor } from '~/utils/cubicleLayout'
import OfficeCornerOffice from './OfficeCornerOffice.vue'
import OfficeCubicle from './OfficeCubicle.vue'

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

// Responsive viewport detection via resize listener.
const windowWidth = ref(typeof window === 'undefined' ? 1024 : window.innerWidth)

function onResize() {
  windowWidth.value = window.innerWidth
}

onMounted(() => {
  window.addEventListener('resize', onResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', onResize)
})

const viewport = computed<'mobile' | 'desktop'>(() =>
  windowWidth.value < 640 ? 'mobile' : 'desktop',
)

const cols = computed(() => gridColumns(props.employees.length, viewport.value))
const positions = computed(() => gridPositions(props.employees.length, cols.value))
const sceneHeight = computed(() => sceneHeightFor(props.employees.length, cols.value))

function onSelect(agent: OfficeAgent) {
  emit('select-agent', agent)
}

function onCeoSelect() {
  emit('talk-to-ceo')
}

function cellStyle(pos: { left: number; top: number }) {
  return {
    left: `${pos.left}%`,
    top: `${pos.top}%`,
    transform: 'translate(-50%, -50%)',
  }
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

// Decorative office props scattered around the perimeter.
const scenery = computed(() => {
  const items = [
    { emoji: '🪴', x: 6, y: 14 },
    { emoji: '☕', x: 88, y: 22 },
    { emoji: '📝', x: 12, y: 78 },
    { emoji: '🪴', x: 90, y: 80 },
    { emoji: '💡', x: 4, y: 50 },
    { emoji: '🗂️', x: 94, y: 52 },
    { emoji: '🖼️', x: 22, y: 8 },
    { emoji: '🪴', x: 78, y: 90 },
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
