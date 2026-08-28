<template>
  <section class="rounded-lg border border-border bg-surface-elevated p-3 sm:p-4 h-full">
    <h2 class="text-[11px] font-semibold text-content-subtle uppercase tracking-wide mb-3">
      Activity
    </h2>

    <div v-if="loading" class="space-y-2 animate-pulse">
      <div
        v-for="i in 3"
        :key="i"
        class="h-3 bg-surface-subtle rounded w-3/4"
      />
    </div>

    <ul v-else-if="displayEvents.length" class="space-y-2 max-h-60 overflow-y-auto pr-1">
      <li
        v-for="event in displayEvents"
        :key="event.id"
        class="text-xs text-content border-l-2 border-border pl-2"
      >
        <span class="text-content-subtle font-mono">{{ formatTime(event.createdAt) }}</span>
        <span class="ml-1.5">{{ event.content || event.eventType }}</span>
      </li>
    </ul>

    <p v-else class="text-sm text-content-subtle text-center py-4">
      No recent activity.
    </p>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { OfficeEvent } from '@jheckbot/shared'

const props = withDefaults(
  defineProps<{
    events?: OfficeEvent[]
    loading?: boolean
  }>(),
  {
    events: () => [],
    loading: false,
  },
)

const now = new Date().toISOString()

const sampleEvents: OfficeEvent[] = [
  {
    id: 'evt-1',
    officeId: '',
    eventType: 'CEO_PLANNING',
    content: 'CEO created an implementation plan',
    createdAt: now,
  },
  {
    id: 'evt-2',
    officeId: '',
    eventType: 'TASK_ASSIGNED',
    content: 'CEO assigned authentication to Alfred',
    createdAt: now,
  },
  {
    id: 'evt-3',
    officeId: '',
    eventType: 'TASK_STARTED',
    content: 'Alfred started work',
    createdAt: now,
  },
  {
    id: 'evt-4',
    officeId: '',
    eventType: 'QA_STARTED',
    content: 'Alice started QA',
    createdAt: now,
  },
]

const displayEvents = computed(() =>
  props.events.length ? props.events : sampleEvents,
)

function formatTime(iso?: string) {
  if (!iso) return '--:--'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '--:--'
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
</script>
