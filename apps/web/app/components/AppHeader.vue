<template>
  <header
    :class="[
      'flex items-center gap-2 sm:gap-3 border-b border-border shrink-0 px-3 sm:px-4 py-3',
      sticky ? 'sticky top-0 bg-surface-elevated z-40' : '',
    ]"
  >
    <slot name="leading" />
    <div v-if="$slots.default" class="flex-1 min-w-0">
      <slot />
    </div>
    <div v-if="$slots.actions" class="flex items-center gap-1 sm:gap-1.5 shrink-0">
      <slot name="actions" />
    </div>
  </header>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  sticky?: boolean
}>(), {
  sticky: false,
})
</script>
