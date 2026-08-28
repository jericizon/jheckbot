<template>
  <form
    @submit.prevent="submit"
    class="space-y-3 rounded-lg border border-border bg-surface-elevated p-4"
  >
    <div>
      <label class="block text-xs text-content-subtle mb-1">Name</label>
      <input
        v-model="form.name"
        type="text"
        required
        placeholder="e.g. Alfred"
        class="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-content placeholder-content-subtle focus:border-content-subtle focus:outline-none transition-colors"
      />
    </div>

    <div>
      <label class="block text-xs text-content-subtle mb-1">Role</label>
      <input
        v-model="form.role"
        type="text"
        required
        placeholder="e.g. Senior Backend Developer"
        class="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-content placeholder-content-subtle focus:border-content-subtle focus:outline-none transition-colors"
      />
    </div>

    <div>
      <label class="block text-xs text-content-subtle mb-1">Description</label>
      <textarea
        v-model="form.description"
        rows="3"
        placeholder="What does this agent do?"
        class="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-content placeholder-content-subtle focus:border-content-subtle focus:outline-none transition-colors resize-none"
      />
    </div>

    <div class="grid grid-cols-2 gap-3">
      <div>
        <label class="block text-xs text-content-subtle mb-1">Provider</label>
        <input
          v-model="form.provider"
          type="text"
          placeholder="e.g. devin"
          class="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-content placeholder-content-subtle focus:border-content-subtle focus:outline-none transition-colors"
        />
      </div>
      <div>
        <label class="block text-xs text-content-subtle mb-1">Model</label>
        <input
          v-model="form.model"
          type="text"
          placeholder="e.g. claude-opus-5"
          class="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-content placeholder-content-subtle focus:border-content-subtle focus:outline-none transition-colors"
        />
      </div>
    </div>

    <div>
      <label class="block text-xs text-content-subtle mb-1">Status</label>
      <select
        v-model="form.status"
        class="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-content focus:border-content-subtle focus:outline-none transition-colors"
      >
        <option v-for="status in AGENT_STATUSES" :key="status" :value="status">
          {{ status }}
        </option>
      </select>
    </div>

    <div class="flex items-center gap-2 pt-1">
      <button
        type="submit"
        :disabled="loading || !form.name.trim() || !form.role.trim()"
        class="flex-1 rounded-lg bg-content text-surface py-2 text-sm font-medium hover:opacity-80 disabled:opacity-50 transition-opacity active:scale-[0.98]"
      >
        {{
          loading ? (isNew ? 'Creating...' : 'Saving...') : isNew ? 'Create Agent' : 'Save Changes'
        }}
      </button>
      <button
        v-if="isNew"
        type="button"
        @click="$emit('cancel')"
        :disabled="loading"
        class="rounded-lg border border-border px-4 py-2 text-sm font-medium text-content-muted hover:text-content hover:border-content-subtle transition-colors disabled:opacity-50"
      >
        Cancel
      </button>
    </div>
  </form>
</template>

<script setup lang="ts">
import { AGENT_STATUSES } from '@jheckbot/shared'
import type { AgentStatus, OfficeAgent } from '@jheckbot/shared'
import type { AgentInput } from '~/composables/useAgents'

interface AgentFormModel {
  name: string
  role: string
  description: string
  provider: string
  model: string
  status: AgentStatus
}

const props = withDefaults(
  defineProps<{
    agent?: Partial<OfficeAgent>
    isNew?: boolean
    loading?: boolean
  }>(),
  {
    isNew: false,
    loading: false,
  },
)

const emit = defineEmits<{
  submit: [data: AgentInput]
  cancel: []
}>()

function toFormModel(agent?: Partial<OfficeAgent>): AgentFormModel {
  return {
    name: agent?.name ?? '',
    role: agent?.role ?? '',
    description: agent?.description ?? '',
    provider: agent?.provider ?? '',
    model: agent?.model ?? '',
    status: agent?.status ?? 'idle',
  }
}

const form = reactive<AgentFormModel>(toFormModel(props.agent))

watch(
  () => props.agent,
  (agent) => {
    Object.assign(form, toFormModel(agent))
  },
  { deep: true, immediate: true },
)

function submit() {
  const data: AgentInput = {
    name: form.name.trim(),
    role: form.role.trim(),
    description: form.description.trim() || undefined,
    provider: form.provider.trim() || undefined,
    model: form.model.trim() || undefined,
    status: form.status,
  }
  emit('submit', data)
}
</script>
