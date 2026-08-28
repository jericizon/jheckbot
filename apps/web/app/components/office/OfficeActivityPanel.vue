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

    <ul v-else-if="events.length" class="space-y-2 max-h-60 overflow-y-auto pr-1">
      <li
        v-for="event in events"
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
import type { OfficeEvent } from '@jheckbot/shared'

withDefaults(
  defineProps<{
    events?: OfficeEvent[]
    loading?: boolean
  }>(),
  {
    events: () => [],
    loading: false,
  },
)

function formatTime(iso?: string) {
  if (!iso) return '--:--'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '--:--'
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
</script>
