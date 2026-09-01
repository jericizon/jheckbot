<template>
  <div
    v-if="open"
    class="fixed inset-y-0 right-0 z-40 w-full sm:w-96 bg-surface border-l border-border shadow-2xl flex flex-col h-full"
    role="dialog"
    aria-modal="true"
    aria-label="CEO chat"
  >
    <header class="shrink-0 flex items-center justify-between border-b border-border px-4 py-3 bg-surface-elevated">
      <div class="flex items-center gap-2 min-w-0">
        <div class="w-7 h-7 rounded-full bg-content flex items-center justify-center shrink-0">
          <svg
            class="w-3.5 h-3.5 text-surface"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M13 10V3L4 14h7v7l9-11h-7z"
            />
          </svg>
        </div>
        <div class="min-w-0">
          <h2 class="text-sm font-semibold text-content truncate">Talk to CEO</h2>
          <p class="text-[10px] text-content-subtle truncate">Plan and run a coding task</p>
        </div>
      </div>
      <button
        @click="$emit('close')"
        class="p-1.5 rounded-md text-content-subtle hover:text-content hover:bg-surface-subtle transition-colors"
        aria-label="Close CEO chat"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </header>

    <div class="flex-1 min-h-0 overflow-hidden">
      <CEOChat :office-id="officeId" :project-id="projectId" inline />
    </div>
  </div>
</template>

<script setup lang="ts">
import CEOChat from './CEOChat.vue'

defineProps<{
  open: boolean
  officeId: string
  projectId?: string
}>()

defineEmits<{ close: [] }>()
</script>
