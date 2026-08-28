<template>
  <div class="rounded-lg border border-border bg-surface-elevated p-4 space-y-3">
    <h2 class="text-sm font-medium text-content">Capabilities</h2>

    <div class="flex gap-2">
      <input
        v-model="newCapability"
        type="text"
        placeholder="Add a capability..."
        :disabled="loading"
        @keydown.enter.prevent="add"
        class="flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-content placeholder-content-subtle focus:border-content-subtle focus:outline-none transition-colors disabled:opacity-50"
      />
      <button
        @click="add"
        :disabled="!newCapability.trim() || loading"
        class="rounded-lg bg-content text-surface px-4 py-2 text-sm font-medium hover:opacity-80 disabled:opacity-50 transition-opacity active:scale-[0.98]"
      >
        Add
      </button>
    </div>

    <p v-if="error" class="text-sm text-red-500">{{ error }}</p>

    <div v-if="capabilities.length === 0" class="text-sm text-content-subtle py-2">
      No capabilities yet.
    </div>
    <div v-else class="flex flex-wrap gap-2">
      <div
        v-for="cap in capabilities"
        :key="cap.id"
        class="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 text-xs text-content"
      >
        <span>{{ cap.capability }}</span>
        <button
          @click="remove(cap.capability)"
          :disabled="loading"
          class="text-content-subtle hover:text-red-500 transition-colors disabled:opacity-50"
          aria-label="Remove capability"
        >
          <svg
            class="w-3.5 h-3.5"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            viewBox="0 0 24 24"
          >
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { OfficeAgentCapability } from '@jheckbot/shared'

const props = defineProps<{
  capabilities: OfficeAgentCapability[]
  loading?: boolean
  error?: string
}>()

const emit = defineEmits<{
  add: [capability: string]
  remove: [capability: string]
}>()

const newCapability = ref('')

watch(
  () => props.capabilities,
  () => {
    newCapability.value = ''
  },
  { deep: true },
)

function add() {
  const capability = newCapability.value.trim()
  if (!capability || props.loading) return
  emit('add', capability)
}

function remove(capability: string) {
  if (props.loading) return
  emit('remove', capability)
}
</script>
