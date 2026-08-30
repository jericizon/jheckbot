<template>
  <div
    class="group relative flex flex-col items-center animate-pop-in"
    :aria-label="ariaLabel"
  >
    <div class="relative">
      <!-- Speech bubble — only for actual messages, not generic status -->
      <div
        v-if="hasMessage"
        class="absolute -top-8 left-1/2 -translate-x-1/2 z-10 px-2 py-1 rounded-xl bg-surface-elevated border border-border text-[10px] leading-tight shadow-sm animate-talk-bubble max-w-[12rem] text-center break-words"
        aria-hidden="true"
      >
        {{ speechBubbleText }}
      </div>

      <!-- Brainstorming thought bubble (idea indicator while planning) -->
      <div
        v-else-if="brainstorming"
        class="absolute -top-6 left-1/2 -translate-x-1/2 z-10 text-sm animate-talk-bubble"
        aria-hidden="true"
      >
        <span class="inline-block animate-pulse">💭</span>
      </div>

      <!-- Mini figure character -->
      <div
        class="relative w-12 h-14 sm:w-14 sm:h-16 transition-transform group-hover:scale-110 group-hover:-translate-y-1"
        aria-hidden="true"
      >
        <OfficeMiniFigure
          :role="agent.role"
          :is-ceo="isCeo"
          :active="bar.glow"
          :walking="isMoving"
          :talking="isTalking"
          :busy="busy"
          :seated="seated"
          :variant="figureVariant"
        />
      </div>
    </div>

    <!-- Name tag below the feet so it never overlaps the speech bubble -->
    <span
      class="z-20 -mt-0.5 px-1.5 py-0.5 rounded-full bg-surface-elevated/90 border border-border text-[10px] font-semibold text-content truncate max-w-[8rem] shadow-sm"
    >
      {{ agent.name }}
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { OfficeAgent, AgentStatus } from '@jheckbot/shared'
import { getAgentStatusBar } from '~/utils/agentStatus'
import OfficeMiniFigure from './OfficeMiniFigure.vue'

const props = defineProps<{
  agent: OfficeAgent
  isCeo?: boolean
  walking?: boolean
  busy?: boolean
  seated?: boolean
  brainstorming?: boolean
  message?: string
}>()

const MOVING_STATUSES: AgentStatus[] = ['working', 'thinking', 'communicating', 'reviewing', 'testing']

const bar = computed(() => getAgentStatusBar(props.agent.status))

// Characters only move based on their OWN status, not the global busy flag.
const isMoving = computed(
  () => props.walking || MOVING_STATUSES.includes(props.agent.status),
)
const hasMessage = computed(() => !!props.message?.trim())
const speechBubbleText = computed(() => props.message?.trim() ?? '')

const figureVariant = computed(() => {
  if (!props.agent.id) return 0
  let hash = 0
  for (let i = 0; i < props.agent.id.length; i++) {
    hash = (hash * 31 + props.agent.id.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
})

const ariaLabel = computed(
  () => `${props.agent.name}, ${props.agent.role}, status ${props.agent.status}`,
)
</script>
