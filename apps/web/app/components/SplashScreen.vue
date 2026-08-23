<template>
  <Transition name="splash">
    <div
      v-if="visible"
      class="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-surface"
      aria-hidden="true"
    >
      <div class="animate-splash-pulse">
        <div class="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-content text-surface">
          <svg class="w-7 h-7" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
        </div>
      </div>
      <p class="mt-4 text-sm font-medium text-content-muted tracking-wide">JheckBot</p>
    </div>
  </Transition>
</template>

<script setup lang="ts">
defineProps<{ visible: boolean }>()
</script>

<style scoped>
.splash-leave-active {
  transition: opacity 0.4s ease-in;
}
.splash-leave-to {
  opacity: 0;
}
</style>
