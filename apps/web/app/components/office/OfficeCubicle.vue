<template>
  <OfficeCharacter :agent="agent" :message="message" :busy="busy" />
</template>

<script setup lang="ts">
import type { OfficeAgent } from '@jheckbot/shared'
import OfficeCharacter from './OfficeCharacter.vue'

withDefaults(
  defineProps<{
    agent: OfficeAgent
    busy?: boolean
    message?: string
  }>(),
  { busy: false },
)
</script>
