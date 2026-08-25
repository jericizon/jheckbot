<template>
  <div class="flex items-center gap-2 mt-2 px-1 overflow-x-auto">
    <input
      v-model="filterQuery"
      type="search"
      :disabled="disabled"
      placeholder="Search models..."
      aria-label="Search models"
      class="w-36 text-xs text-content-muted bg-transparent border border-border rounded-full px-2.5 py-1 placeholder-content-subtle focus:outline-none focus:border-content-subtle disabled:opacity-50 shrink-0"
    />
    <select
      :value="currentFamilyId"
      @change="onFamilyChange(($event.target as HTMLSelectElement).value)"
      :disabled="disabled"
      class="text-xs text-content-muted bg-transparent border-none focus:outline-none cursor-pointer disabled:opacity-50 shrink-0"
      aria-label="Model family"
    >
      <optgroup v-for="group in filteredFamilyGroups" :key="group.label" :label="group.label">
        <option
          v-for="f in group.families"
          :key="f.id"
          :value="f.id"
          class="bg-surface-elevated text-content"
        >
          {{ f.label }}{{ f.context ? ` · ${f.context}` : '' }}
        </option>
      </optgroup>
    </select>
    <select
      v-if="currentFamily && currentFamily.variants.length > 1"
      :value="currentVariantId"
      @change="$emit('update:modelValue', ($event.target as HTMLSelectElement).value)"
      :disabled="disabled"
      class="text-xs text-content-muted bg-transparent border-none focus:outline-none cursor-pointer disabled:opacity-50 shrink-0"
      aria-label="Thinking level"
    >
      <option
        v-for="v in levelOptions"
        :key="v.id"
        :value="v.id"
        class="bg-surface-elevated text-content"
      >
        {{ levelLabel(v.level) }}{{ v.free ? ' (Free)' : '' }}
      </option>
    </select>
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
  THINKING_LEVEL_ORDER,
  type ModelFamily,
  type ModelVariant,
  type ThinkingLevel,
} from '@jheckbot/shared'

export type { ModelFamily, ModelVariant }

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

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'update:bypassMode', value: boolean): void
  (e: 'openSkills'): void
}>()

const TIER_LABELS: Record<ModelFamily['tier'], string> = {
  free: 'Free',
  budget: 'Budget',
  mid: 'Mid-range',
  premium: 'Premium',
}
const TIER_ORDER: ModelFamily['tier'][] = ['free', 'budget', 'mid', 'premium']

const familyGroups = computed(() => {
  const byTier = new Map<ModelFamily['tier'], ModelFamily[]>()
  for (const f of props.families) {
    const list = byTier.get(f.tier) ?? []
    list.push(f)
    byTier.set(f.tier, list)
  }
  return TIER_ORDER.filter((tier) => byTier.has(tier)).map((tier) => ({
    label: TIER_LABELS[tier],
    families: byTier.get(tier)!,
  }))
})

const filterQuery = ref('')
const filteredFamilyGroups = computed(() => {
  const q = filterQuery.value.trim().toLowerCase()
  if (!q) return familyGroups.value
  return familyGroups.value
    .map((group) => ({
      ...group,
      families: group.families.filter((f) =>
        [f.id, f.label, f.context, group.label].join(' ').toLowerCase().includes(q),
      ),
    }))
    .filter((group) => group.families.length > 0)
})

// Locate the family + variant backing the current modelValue.
const currentFamily = computed<ModelFamily | undefined>(() => {
  for (const f of props.families) {
    if (f.variants.some((v) => v.id === props.modelValue)) return f
  }
  return undefined
})

const currentFamilyId = computed(() => currentFamily.value?.id ?? '')
const currentVariantId = computed(() => props.modelValue)

const levelRank = (level: ThinkingLevel) => {
  const idx = THINKING_LEVEL_ORDER.indexOf(level)
  return idx === -1 ? THINKING_LEVEL_ORDER.length : idx
}

const levelOptions = computed<ModelVariant[]>(() => {
  if (!currentFamily.value) return []
  return [...currentFamily.value.variants].sort((a, b) => levelRank(a.level) - levelRank(b.level))
})

function levelLabel(level: ThinkingLevel) {
  return THINKING_LEVEL_LABELS[level] ?? level
}

// When the family changes, keep the current thinking level when the new family
// supports it; otherwise fall back to the family's first (lowest-effort) level.
function onFamilyChange(familyId: string) {
  const family = props.families.find((f) => f.id === familyId)
  if (!family) return
  const currentLevel = currentFamily.value?.variants.find((v) => v.id === props.modelValue)?.level
  const match = family.variants.find((v) => v.level === currentLevel)
  const fallback = levelOptionsFor(family)[0]
  emit('update:modelValue', (match ?? fallback)?.id ?? family.variants[0]?.id ?? props.modelValue)
  filterQuery.value = ''
}

function levelOptionsFor(family: ModelFamily) {
  return [...family.variants].sort((a, b) => levelRank(a.level) - levelRank(b.level))
}
</script>
