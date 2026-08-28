<template>
  <div class="flex flex-col items-center gap-1 w-full">
    <!-- Walled cubicle tile -->
    <div
      class="relative w-full max-w-[10rem] bg-gradient-to-b from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800 border-2 border-slate-400 dark:border-slate-500 rounded-lg shadow-md overflow-hidden"
    >
      <!-- Partition wall (top edge) -->
      <div class="h-1.5 bg-gradient-to-b from-slate-300 to-slate-400 dark:from-slate-600 dark:to-slate-700 border-b border-slate-500/50" />

      <!-- Desk with monitor + status prop -->
      <div class="px-2 py-1.5 flex items-end justify-between gap-1">
        <!-- Monitor -->
        <div class="w-8 h-6 bg-sky-200 dark:bg-sky-800 border border-slate-500 rounded-sm flex items-center justify-center text-[10px]">
          <span class="font-mono font-bold text-slate-700 dark:text-slate-200 uppercase">{{ deskLabel }}</span>
        </div>
        <!-- Status prop on desk -->
        <span class="text-sm" :title="statusProp.label" aria-hidden="true">{{ statusProp.emoji }}</span>
      </div>

      <!-- Chair -->
      <div class="mx-auto mb-1 w-4 h-2 bg-slate-400 dark:bg-slate-600 rounded-sm" aria-hidden="true" />
    </div>

    <!-- Agent inside the cubicle -->
    <OfficeCharacter :agent="agent" @select="$emit('select', agent)" />

    <!-- Role nameplate -->
    <span class="text-[10px] font-bold text-content-muted bg-surface-elevated/80 px-1.5 py-0.5 rounded border border-border truncate max-w-[8rem]">
      {{ agent.role }}
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { OfficeAgent } from '@jheckbot/shared'
import { getCubicleStatusProp } from '~/utils/agentStatus'
import OfficeCharacter from './OfficeCharacter.vue'

const props = defineProps<{ agent: OfficeAgent }>()
defineEmits<{ select: [OfficeAgent] }>()

const statusProp = computed(() => getCubicleStatusProp(props.agent.status))

const deskLabel = computed(() => {
  const role = props.agent.role.toLowerCase()
  if (role.includes('qa')) return 'QA'
  if (role.includes('review')) return 'REV'
  if (role.includes('devops')) return 'OPS'
  if (role.includes('security')) return 'SEC'
  if (role.includes('frontend')) return 'FE'
  if (role.includes('backend')) return 'BE'
  if (role.includes('full')) return 'FS'
  if (role.includes('design') || role.includes('ui') || role.includes('ux')) return 'UX'
  if (role.includes('writer') || role.includes('doc')) return 'DOC'
  if (role.includes('product') || role.includes('manager')) return 'PM'
  return 'DEV'
})
</script>
