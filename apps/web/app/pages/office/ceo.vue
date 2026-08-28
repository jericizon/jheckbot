<template>
  <CEOChat :office-id="officeId" />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import CEOChat from '~/components/office/CEOChat.vue'

const route = useRoute()

const officeId = computed(() => (route.query.office as string) ?? '')

useHead(() => ({
  title: 'Talk to CEO',
}))
</script>
