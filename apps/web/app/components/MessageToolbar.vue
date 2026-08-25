<template>
  <div class="flex items-center gap-2 mt-2 px-1 overflow-x-auto">
    <button
      @click="$emit('openModels')"
      :disabled="disabled"
      class="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium border bg-transparent border-border text-content hover:text-content-muted hover:border-content-subtle transition-all disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
      :title="chipTitle"
      :aria-label="chipTitle"
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
      <span v-if="!currentModel">Models</span>
      <template v-else>
        <span
          v-if="tierDot"
          class="w-2 h-2 rounded-full shrink-0"
          :class="tierDot"
          aria-hidden="true"
        />
        <span class="shrink-0">{{ currentLabel }}</span>
        <span :class="['font-normal', tierTextClass]">· {{ currentPricing }}</span>
      </template>
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
  type ModelVariant,
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

const TIER_STYLES: Record<ModelFamily['tier'], { dot: string; text: string }> = {
  free: { dot: 'bg-emerald-500', text: 'text-emerald-500' },
  budget: { dot: 'bg-amber-500', text: 'text-amber-500' },
  mid: { dot: 'bg-orange-500', text: 'text-orange-500' },
  premium: { dot: 'bg-rose-500', text: 'text-rose-500' },
}

function levelLabel(level: ThinkingLevel) {
  return THINKING_LEVEL_LABELS[level] ?? level
}

const currentModel = computed(() => {
  for (const f of props.families) {
    const v = f.variants.find((vr) => vr.id === props.modelValue)
    if (v) return { family: f, variant: v as ModelVariant }
  }
  return null
})

const currentLabel = computed(() => {
  const m = currentModel.value
  if (!m) return ''
  return `${m.family.label} · ${levelLabel(m.variant.level)}`
})

const currentPricing = computed(() => currentModel.value?.variant.pricing ?? '')

const currentTier = computed(() => currentModel.value?.family.tier ?? null)

const tierDot = computed(() => (currentTier.value ? TIER_STYLES[currentTier.value].dot : ''))

const tierTextClass = computed(() => (currentTier.value ? TIER_STYLES[currentTier.value].text : ''))

const chipTitle = computed(() => {
  if (!currentModel.value) return 'Choose model'
  const { family, variant } = currentModel.value
  return `Model: ${family.label} · ${levelLabel(variant.level)} · ${variant.pricing} (${family.tier})`
})
</script>
