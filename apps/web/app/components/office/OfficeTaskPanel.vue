<template>
  <section class="rounded-lg border border-border bg-surface-elevated p-3 sm:p-4 h-full">
    <h2 class="text-[11px] font-semibold text-content-subtle uppercase tracking-wide mb-3">
      Active Tasks
    </h2>

    <div v-if="loading" class="space-y-2 animate-pulse">
      <div
        v-for="i in 3"
        :key="i"
        class="h-3 bg-surface-subtle rounded w-3/4"
      />
    </div>

    <ul v-else-if="displayTasks.length" class="space-y-2 max-h-60 overflow-y-auto pr-1">
      <li
        v-for="task in displayTasks"
        :key="task.id"
        class="text-sm text-content border-l-2 border-border pl-2"
      >
        <div class="flex items-center justify-between gap-2">
          <span class="font-medium truncate">{{ task.title }}</span>
          <span class="text-[10px] text-content-subtle uppercase shrink-0">
            {{ task.status }}
          </span>
        </div>
        <div
          v-if="task.assignedAgentId"
          class="text-[10px] text-content-muted mt-0.5"
        >
          {{ task.assignedAgentId }}
        </div>
      </li>
    </ul>

    <p v-else class="text-sm text-content-subtle text-center py-4">
      No active tasks.
    </p>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { OfficeTask } from '@jheckbot/shared'

const props = withDefaults(
  defineProps<{
    tasks?: OfficeTask[]
    loading?: boolean
  }>(),
  {
    tasks: () => [],
    loading: false,
  },
)

const now = new Date().toISOString()

const sampleTasks: OfficeTask[] = [
  {
    id: 'task-1',
    officeId: '',
    title: 'Authentication flow',
    status: 'working',
    priority: 'high',
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'task-2',
    officeId: '',
    title: 'Payment integration',
    status: 'qa',
    priority: 'critical',
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'task-3',
    officeId: '',
    title: 'Dashboard widgets',
    status: 'backlog',
    priority: 'medium',
    createdAt: now,
    updatedAt: now,
  },
]

const displayTasks = computed(() =>
  props.tasks.length ? props.tasks : sampleTasks,
)
</script>
