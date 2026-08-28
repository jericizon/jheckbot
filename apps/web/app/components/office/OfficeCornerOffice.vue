<template>
  <div class="flex flex-col items-center gap-1.5">
    <!-- Larger corner-office tile -->
    <div
      class="relative w-28 sm:w-36 bg-gradient-to-b from-amber-100 to-amber-300 dark:from-amber-800 dark:to-amber-900 border-2 border-amber-600 dark:border-amber-500 rounded-lg shadow-lg overflow-hidden animate-unit-bob"
    >
      <!-- Roof / upper partition -->
      <div class="h-3 sm:h-4 bg-gradient-to-b from-amber-500 to-amber-700 dark:from-amber-600 dark:to-amber-800 border-b-2 border-amber-800 dark:border-amber-900" />

      <!-- Big desk with dual monitors -->
      <div class="px-3 py-2 flex items-end justify-center gap-2">
        <div class="w-10 h-7 bg-sky-200 dark:bg-sky-700 border border-amber-800 dark:border-amber-900 rounded-sm flex items-center justify-center">
          <span class="text-[10px] font-mono font-bold text-amber-900 dark:text-amber-100">CEO</span>
        </div>
        <div class="w-3 h-5 bg-amber-900/70 dark:bg-amber-800/70 rounded-t" aria-hidden="true" />
      </div>

      <!-- Signage plate -->
      <div class="mx-auto mb-1.5 px-2 py-0.5 bg-amber-700 dark:bg-amber-600 rounded text-[9px] font-bold text-white dark:text-amber-50 uppercase tracking-wide text-center">
        Corner Office
      </div>

      <!-- Flag -->
      <div class="absolute -top-3 left-1/2 -translate-x-1/2 flex flex-col items-center" aria-hidden="true">
        <div class="w-0.5 h-3 bg-amber-900 dark:bg-amber-800" />
        <div class="w-2.5 h-1.5 bg-red-500 dark:bg-red-600 -mt-0.5" />
      </div>
    </div>

    <OfficeCharacter :agent="agent" is-ceo @select="$emit('select', agent)" />
  </div>
</template>

<script setup lang="ts">
import type { OfficeAgent } from '@jheckbot/shared'
import OfficeCharacter from './OfficeCharacter.vue'

defineProps<{ agent: OfficeAgent }>()
defineEmits<{ select: [OfficeAgent] }>()
</script>
