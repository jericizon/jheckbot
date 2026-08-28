<template>
  <div
    class="rounded-lg border border-border bg-surface-elevated p-3 hover:border-content-subtle transition-colors"
  >
    <div class="flex items-center justify-between gap-2">
      <div class="flex items-center gap-2 min-w-0">
        <span
          class="w-2 h-2 rounded-full shrink-0"
          :class="agent.enabled ? 'bg-emerald-500' : 'bg-content-subtle'"
          :title="agent.enabled ? 'Enabled' : 'Disabled'"
        />
        <span class="font-medium text-sm truncate">{{ agent.name }}</span>
      </div>
      <span
        class="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded bg-surface-subtle text-content-subtle shrink-0"
      >
        {{ agent.status }}
      </span>
    </div>
    <p class="text-xs text-content-muted mt-1 truncate">{{ agent.role }}</p>
    <p v-if="agent.description" class="text-xs text-content-subtle mt-1 truncate">
      {{ agent.description }}
    </p>
    <p
      v-if="agent.provider || agent.model"
      class="text-xs text-content-subtle mt-1 font-mono truncate"
    >
      {{ [agent.provider, agent.model].filter(Boolean).join(' / ') }}
    </p>
  </div>
</template>

<script setup lang="ts">
import type { OfficeAgent } from '@jheckbot/shared'

defineProps<{
  agent: OfficeAgent
}>()
</script>
