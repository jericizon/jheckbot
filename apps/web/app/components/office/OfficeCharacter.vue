<template>
  <button
    type="button"
    class="group relative flex flex-col items-center gap-1.5 p-2 rounded-lg hover:bg-surface-subtle focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface transition-colors"
    :aria-label="ariaLabel"
    @click="$emit('select', agent)"
  >
    <div class="relative">
      <div
        class="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 border-2 border-border flex items-center justify-center text-2xl sm:text-3xl shadow-sm group-hover:scale-105 group-hover:-translate-y-0.5 transition-transform"
        aria-hidden="true"
      >
        {{ emoji }}
      </div>
      <OfficeStatusBadge
        :status="agent.status"
        compact
        class="absolute -top-0.5 -right-0.5"
      />
    </div>
    <span class="text-xs font-semibold text-content truncate max-w-[5.5rem]">
      {{ agent.name }}
    </span>
    <span class="text-[10px] text-content-muted truncate max-w-[5.5rem]">
      {{ agent.role }}
    </span>
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { OfficeAgent } from '@jheckbot/shared'
import { getRoleEmoji } from '~/utils/roleEmoji'
import OfficeStatusBadge from './OfficeStatusBadge.vue'

const props = defineProps<{
  agent: OfficeAgent
  isCeo?: boolean
}>()

defineEmits<{
  select: [OfficeAgent]
}>()

const emoji = computed(() => (props.isCeo ? '👔' : getRoleEmoji(props.agent.role)))

const ariaLabel = computed(
  () =>
    `Select ${props.agent.name}, ${props.agent.role}, status ${props.agent.status}`,
)
</script>
