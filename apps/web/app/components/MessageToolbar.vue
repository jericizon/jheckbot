<template>
  <div class="flex flex-wrap items-center gap-2 mt-2 px-1">
    <select
      :value="modelValue"
      @change="$emit('update:modelValue', ($event.target as HTMLSelectElement).value)"
      :disabled="disabled"
      class="text-xs text-content-muted bg-transparent border-none focus:outline-none cursor-pointer disabled:opacity-50 shrink-0"
    >
      <optgroup v-for="group in modelGroups" :key="group.label" :label="group.label">
        <option v-for="m in group.models" :key="m.id" :value="m.id" class="bg-surface-elevated text-content">
          {{ m.label }}{{ m.free ? ' (Free)' : '' }}
        </option>
      </optgroup>
    </select>
    <button
      @click="$emit('openSkills')"
      class="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium border bg-transparent border-border text-content-subtle hover:text-content-muted hover:border-content-subtle transition-all shrink-0"
      title="Browse and insert skills"
    >
      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
      <span>Skills</span>
    </button>
    <button
      @click="$emit('update:bypassMode', !bypassMode)"
      :disabled="disabled"
      class="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium border transition-all disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
      :class="bypassMode
        ? 'bg-amber-500/15 border-amber-500/40 text-amber-500'
        : 'bg-transparent border-border text-content-subtle hover:text-content-muted hover:border-content-subtle'"
      :title="bypassMode ? 'Bypass mode ON: Devin will auto-approve all tools without asking' : 'Bypass mode OFF: Devin will ask for permission on risky actions'"
      :aria-pressed="bypassMode"
    >
      <svg v-if="bypassMode" class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8 11V7a4 4 0 118 0m-4 4v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" /></svg>
      <svg v-else class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
      <span>Bypass {{ bypassMode ? 'On' : 'Off' }}</span>
    </button>
    <slot name="actions" />
    <p class="text-xs text-content-subtle shrink-0 ml-auto hidden sm:block">Enter to send, Shift+Enter for new line</p>
  </div>
</template>

<script setup lang="ts">
export interface ModelOption {
  id: string
  label: string
  family: string
  context: string
  pricing: string
  free: boolean
}

const props = withDefaults(defineProps<{
  modelValue: string
  models: ModelOption[]
  bypassMode?: boolean
  disabled?: boolean
}>(), {
  bypassMode: false,
  disabled: false,
})

defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'update:bypassMode', value: boolean): void
  (e: 'openSkills'): void
}>()

const modelGroups = computed(() => {
  const groups: { label: string; models: ModelOption[] }[] = [
    { label: 'Free', models: [] },
    { label: 'Budget', models: [] },
    { label: 'Mid-range', models: [] },
    { label: 'Premium', models: [] },
  ]
  for (const m of props.models) {
    if (m.free) groups[0].models.push(m)
    else if (m.pricing.includes('$0.') || m.pricing.includes('$1.')) groups[1].models.push(m)
    else if (m.pricing.includes('$2.') || m.pricing.includes('$3.')) groups[2].models.push(m)
    else groups[3].models.push(m)
  }
  return groups.filter((g) => g.models.length > 0)
})
</script>
