<template>
  <button
    type="button"
    class="group relative flex flex-col items-center gap-1.5 p-1 rounded-xl hover:bg-emerald-500/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-emerald-50 transition-colors animate-pop-in"
    :aria-label="ariaLabel"
    @click="$emit('select', agent)"
  >
    <div class="relative" :class="{ 'animate-unit-bob': bar.glow }">
      <!-- Status glow ring for active units -->
      <div
        v-if="bar.glow"
        class="absolute inset-0 rounded-full animate-glow-pulse pointer-events-none"
        aria-hidden="true"
      />

      <!-- Avatar disc -->
      <div
        class="relative w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center text-2xl sm:text-3xl shadow-md border-[3px] transition-transform group-hover:scale-110 group-hover:-translate-y-1"
        :class="avatarClasses"
        aria-hidden="true"
      >
        {{ emoji }}
      </div>

      <!-- Role badge (CoC-style circular badge) -->
      <div
        class="absolute -bottom-1 -left-1 w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-gradient-to-br from-amber-300 to-amber-500 border-2 border-white dark:border-slate-900 shadow flex items-center justify-center text-[10px] font-bold text-amber-900"
        :title="agent.role"
        aria-hidden="true"
      >
        {{ badgeLabel }}
      </div>

      <!-- Status dot -->
      <OfficeStatusBadge
        :status="agent.status"
        compact
        class="absolute -top-0.5 -right-0.5"
      />
    </div>

    <!-- Name -->
    <span class="text-xs font-bold text-content truncate max-w-[7rem] drop-shadow-sm">
      {{ agent.name }}
    </span>

    <!-- Cartoon status / activity bar -->
    <div
      class="w-12 h-1.5 sm:w-14 rounded-full bg-black/15 dark:bg-white/15 overflow-hidden border border-black/10 dark:border-white/10"
      role="progressbar"
      :aria-valuenow="bar.percent"
      aria-valuemin="0"
      aria-valuemax="100"
      :aria-label="`${style.label} status`"
    >
      <div
        class="h-full rounded-full transition-all duration-500"
        :class="[bar.barClass, bar.glow ? 'animate-pulse' : '']"
        :style="{ width: `${bar.percent}%` }"
      />
    </div>
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { OfficeAgent } from '@jheckbot/shared'
import { getRoleEmoji } from '~/utils/roleEmoji'
import { getAgentStatusStyle, getAgentStatusBar } from '~/utils/agentStatus'
import OfficeStatusBadge from './OfficeStatusBadge.vue'

const props = defineProps<{
  agent: OfficeAgent
  isCeo?: boolean
}>()

defineEmits<{
  select: [OfficeAgent]
}>()

const emoji = computed(() => (props.isCeo ? '👑' : getRoleEmoji(props.agent.role)))
const style = computed(() => getAgentStatusStyle(props.agent.status))
const bar = computed(() => getAgentStatusBar(props.agent.status))

const avatarClasses = computed(() => {
  if (props.isCeo) {
    return 'bg-gradient-to-br from-amber-200 to-amber-400 border-amber-600'
  }
  return 'bg-gradient-to-br from-sky-200 to-sky-400 border-sky-600'
})

// Short role badge label (1-3 chars) for the circular badge.
const badgeLabel = computed(() => {
  if (props.isCeo) return 'CEO'
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

const ariaLabel = computed(
  () =>
    `Select ${props.agent.name}, ${props.agent.role}, status ${props.agent.status}`,
)
</script>
