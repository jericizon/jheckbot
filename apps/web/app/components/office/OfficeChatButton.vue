<template>
  <NuxtLink
    :to="`/office/ceo?office=${ceo?.officeId || officeId}`"
    class="block w-full rounded-lg bg-accent text-white dark:text-black py-3 text-sm font-medium text-center hover:bg-accent-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface transition-colors"
    :class="{ 'opacity-50 cursor-not-allowed pointer-events-none': !canNavigate }"
    :aria-label="`Talk to ${ceo?.name || 'CEO'}`"
  >
    <span class="mr-2" aria-hidden="true">💬</span>
    Talk to {{ ceo?.name || 'CEO' }}
  </NuxtLink>
</template>

<script setup lang="ts">
import type { OfficeAgent } from '@jheckbot/shared'

const props = withDefaults(
  defineProps<{
    ceo?: OfficeAgent
    officeId?: string
  }>(),
  {
    officeId: '',
  },
)

const canNavigate = computed(() => !!(props.ceo?.officeId || props.officeId))
</script>
