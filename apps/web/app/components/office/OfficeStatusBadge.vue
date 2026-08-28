<template>
  <span
    class="inline-flex items-center gap-1.5"
    :title="style.label"
    :aria-label="compact ? style.label : undefined"
  >
    <span
      class="rounded-full"
      :class="[
        style.dotClass,
        animateClass,
        compact ? 'w-2.5 h-2.5' : 'w-2 h-2',
      ]"
      aria-hidden="true"
    />
    <span
      v-if="!compact"
      class="text-[10px] font-medium text-content-subtle uppercase tracking-wide"
    >
      {{ style.label }}
    </span>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { AgentStatus } from '@jheckbot/shared'
import { getAgentStatusStyle } from '~/utils/agentStatus'

const props = defineProps<{
  status: AgentStatus
  compact?: boolean
}>()

const style = computed(() => getAgentStatusStyle(props.status))

const animateClass = computed(() => {
  if (style.value.animate === 'pulse') return 'animate-pulse'
  if (style.value.animate === 'bounce') return 'animate-bounce'
  return ''
})
</script>
