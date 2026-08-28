<template>
  <section class="w-full" aria-label="Virtual office">
    <div
      v-if="loading"
      class="flex items-center justify-center h-60 sm:h-72 rounded-xl border-2 border-dashed border-border bg-surface-elevated text-sm text-content-subtle"
    >
      Loading office...
    </div>

    <div
      v-else-if="!ceo && employees.length === 0"
      class="flex flex-col items-center justify-center h-60 sm:h-72 rounded-xl border-2 border-dashed border-border bg-surface-elevated text-sm text-content-subtle text-center px-4"
    >
      <span class="text-2xl mb-2" aria-hidden="true">🏢</span>
      No one is in this office yet.
    </div>

    <div
      v-else
      class="relative rounded-xl border-2 border-border bg-surface-elevated p-4 sm:p-6 overflow-hidden min-h-[22rem]"
    >
      <div
        class="absolute inset-0 opacity-[0.08] pointer-events-none"
        style="
          background-image:
            repeating-linear-gradient(0deg, transparent, transparent 1.5rem, rgb(var(--border)) 1.5rem, rgb(var(--border)) 1.625rem),
            repeating-linear-gradient(90deg, transparent, transparent 1.5rem, rgb(var(--border)) 1.5rem, rgb(var(--border)) 1.625rem);
        "
      />

      <div class="relative z-10 flex flex-col items-center gap-8 sm:gap-12">
        <!-- CEO desk -->
        <div class="flex flex-col items-center gap-3">
          <div
            class="relative bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 rounded-lg p-4 sm:p-5 w-44 sm:w-56"
          >
            <div class="flex items-end justify-center gap-3">
              <div class="w-3 h-8 bg-content-subtle/20 rounded-sm" aria-hidden="true" />
              <div
                class="w-16 h-12 bg-surface-subtle border border-border rounded-sm flex items-center justify-center"
                aria-hidden="true"
              >
                <span class="text-xs text-content-subtle font-mono">CEO</span>
              </div>
            </div>
            <div class="mt-3 h-2 w-full bg-content-subtle/10 rounded" aria-hidden="true" />
          </div>

          <OfficeCharacter v-if="ceo" :agent="ceo" is-ceo @select="onSelect" />
          <div v-else class="text-xs text-content-subtle">No CEO assigned</div>
        </div>

        <!-- Employee desks -->
        <div
          class="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8 w-full max-w-3xl justify-items-center"
        >
          <div
            v-for="agent in employees"
            :key="agent.id"
            class="flex flex-col items-center gap-3"
          >
            <div
              class="bg-sky-50 dark:bg-sky-900/10 border border-sky-100 dark:border-sky-900/30 rounded-lg p-3 sm:p-4 w-32 sm:w-40"
            >
              <div class="flex items-end justify-center gap-2">
                <div
                  class="w-2.5 h-6 bg-content-subtle/20 rounded-sm"
                  aria-hidden="true"
                />
                <div
                  class="w-10 h-8 bg-surface-subtle border border-border rounded-sm flex items-center justify-center"
                  aria-hidden="true"
                >
                  <span class="text-[10px] text-content-subtle font-mono uppercase">
                    {{ deskLabel(agent) }}
                  </span>
                </div>
              </div>
              <div
                class="mt-2 h-1.5 w-full bg-content-subtle/10 rounded"
                aria-hidden="true"
              />
            </div>

            <OfficeCharacter :agent="agent" @select="onSelect" />
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { OfficeAgent } from '@jheckbot/shared'
import OfficeCharacter from './OfficeCharacter.vue'

defineProps<{
  agents: OfficeAgent[]
  ceo?: OfficeAgent
  employees: OfficeAgent[]
  loading?: boolean
}>()

const emit = defineEmits<{
  'select-agent': [OfficeAgent]
}>()

function onSelect(agent: OfficeAgent) {
  emit('select-agent', agent)
}

function deskLabel(agent: OfficeAgent) {
  const role = agent.role.toLowerCase()
  if (role.includes('qa')) return 'QA'
  if (role.includes('review')) return 'REV'
  if (role.includes('devops')) return 'OPS'
  if (role.includes('frontend')) return 'FE'
  if (role.includes('backend')) return 'BE'
  if (role.includes('full')) return 'FS'
  return 'DEV'
}
</script>
