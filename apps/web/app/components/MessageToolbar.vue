<template>
  <div class="flex items-center gap-2 mt-2 px-1 overflow-x-auto">
    <button
      @click="$emit('openModels')"
      :disabled="disabled"
      class="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium border bg-transparent border-border text-content-subtle hover:text-content-muted hover:border-content-subtle transition-all disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
      :title="currentLabel ? `Model: ${currentLabel}` : 'Choose model'"
    >
      <svg
        class="w-3.5 h-3.5"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M12 6V4m0 16v-2m6-6h2M4 12H2m15.07-5.07l1.41-1.41M5.52 18.48l-1.41-1.41m12.96 0l1.41 1.41M5.52 5.52L4.11 4.11"
        />
        <circle cx="12" cy="12" r="3" />
      </svg>
      <span>{{ currentLabel || 'Models' }}</span>
    </button>
    <button
      @click="$emit('openSkills')"
      class="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium border bg-transparent border-border text-content-subtle hover:text-content-muted hover:border-content-subtle transition-all shrink-0"
      title="Browse and insert skills"
    >
      <svg
        class="w-3.5 h-3.5"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        viewBox="0 0 24 24"
      >
        <path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
      <span>Skills</span>
    </button>
    <button
      @click="$emit('update:bypassMode', !bypassMode)"
      :disabled="disabled"
      class="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium border transition-all disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
      :class="
        bypassMode
          ? 'bg-amber-500/15 border-amber-500/40 text-amber-500'
          : 'bg-transparent border-border text-content-subtle hover:text-content-muted hover:border-content-subtle'
      "
      :title="
        bypassMode
          ? 'Bypass mode ON: Devin will auto-approve all tools without asking'
          : 'Bypass mode OFF: Devin will ask for permission on risky actions'
      "
      :aria-pressed="bypassMode"
    >
      <svg
        v-if="bypassMode"
        class="w-3.5 h-3.5"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M8 11V7a4 4 0 118 0m-4 4v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z"
        />
      </svg>
      <svg
        v-else
        class="w-3.5 h-3.5"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
        />
      </svg>
      <span>Bypass {{ bypassMode ? 'On' : 'Off' }}</span>
    </button>
    <slot name="actions" />
  </div>
</template>

<script setup lang="ts">
import {
  THINKING_LEVEL_LABELS,
  type ModelFamily,
  type ThinkingLevel,
} from '@jheckbot/shared'

export type { ModelFamily }

const props = withDefaults(
  defineProps<{
    modelValue: string
    families: ModelFamily[]
    bypassMode?: boolean
    disabled?: boolean
  }>(),
  {
    bypassMode: false,
    disabled: false,
  },
)

defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'update:bypassMode', value: boolean): void
  (e: 'openSkills'): void
  (e: 'openModels'): void
}>()

function levelLabel(level: ThinkingLevel) {
  return THINKING_LEVEL_LABELS[level] ?? level
}

// Display only — derives the chip label from the current selection.
const currentLabel = computed(() => {
  for (const f of props.families) {
    const v = f.variants.find((vr) => vr.id === props.modelValue)
    if (v) return `${f.label} · ${levelLabel(v.level)}`
  }
  return ''
})
</script>
