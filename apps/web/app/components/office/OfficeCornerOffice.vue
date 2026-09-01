<template>
  <OfficeCharacter
    :agent="agent"
    :message="reacting ? reactionMessage : message"
    is-ceo
    :busy="busy"
    :walking="reacting"
    @select="$emit('select')"
  />
</template>

<script setup lang="ts">
import type { OfficeAgent } from '@jheckbot/shared'
import OfficeCharacter from './OfficeCharacter.vue'

defineEmits<{ select: [] }>()

withDefaults(
  defineProps<{
    agent: OfficeAgent
    busy?: boolean
    reacting?: boolean
    reactionMessage?: string
    message?: string
  }>(),
  { busy: false, reacting: false, reactionMessage: '' },
)
</script>
