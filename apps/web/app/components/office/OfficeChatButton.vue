<template>
  <button
    type="button"
    :disabled="!ceo"
    class="w-full rounded-lg bg-accent text-white dark:text-black py-3 text-sm font-medium hover:bg-accent-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    :aria-label="`Talk to ${ceo?.name || 'CEO'}`"
    @click="$emit('talk-to-ceo')"
  >
    <span class="mr-2" aria-hidden="true">💬</span>
    Talk to {{ ceo?.name || 'CEO' }}
  </button>
</template>

<script setup lang="ts">
import type { OfficeAgent } from '@jheckbot/shared'

defineProps<{
  ceo?: OfficeAgent
}>()

defineEmits<{
  'talk-to-ceo': []
}>()
</script>
