<template>
  <div class="pb-20">
    <AppHeader sticky>
      <div class="w-full flex items-center justify-between gap-2">
        <h1 class="text-lg font-semibold">Agents</h1>
        <span class="text-xs text-content-subtle font-mono truncate max-w-[50%]" :title="officeId">
          {{ officeId }}
        </span>
      </div>
      <template #actions>
        <NuxtLink
          :to="`/office?office=${officeId}`"
          class="text-[11px] font-medium text-accent hover:text-accent-hover transition-colors"
          aria-label="Open office view"
        >
          Office
        </NuxtLink>
      </template>
    </AppHeader>

    <div class="px-4 py-4 max-w-2xl mx-auto">
      <p class="text-xs text-content-subtle mb-3">
        Pass <code class="font-mono">?office=&lt;id&gt;</code> to target a real office.
      </p>

      <button
        @click="showAdd = !showAdd"
        class="w-full rounded-lg border border-dashed border-border py-3 text-sm text-content-muted hover:border-content-subtle hover:text-content transition-colors"
      >
        + Add Agent
      </button>

      <div
        v-if="showAdd"
        class="rounded-lg border border-border bg-surface-elevated p-4 mt-3 space-y-3 animate-slide-up"
      >
        <AgentForm
          :is-new="true"
          :loading="creating"
          @submit="addAgent"
          @cancel="showAdd = false"
        />
        <p v-if="addError" class="text-sm text-red-500">{{ addError }}</p>
      </div>

      <div v-if="loading" class="space-y-2 mt-4">
        <div
          v-for="i in 3"
          :key="i"
          class="rounded-lg border border-border bg-surface-elevated p-3 animate-pulse"
        >
          <div class="h-4 w-32 bg-surface-subtle rounded" />
          <div class="h-3 w-48 bg-surface-subtle rounded mt-2" />
        </div>
      </div>

      <div v-else-if="agents.length === 0" class="text-content-subtle text-sm py-8 text-center">
        No agents found for this office.
      </div>

      <div v-else class="space-y-2 mt-4">
        <NuxtLink v-for="agent in agents" :key="agent.id" :to="`/agents/${agent.id}`" class="block">
          <AgentCard :agent="agent" />
        </NuxtLink>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useAgents, type AgentInput, type CreateAgentInput } from '~/composables/useAgents'
import AgentCard from '~/components/agents/AgentCard.vue'
import AgentForm from '~/components/agents/AgentForm.vue'
import type { OfficeAgent } from '@jheckbot/shared'

const PLACEHOLDER_OFFICE_ID = '00000000-0000-0000-0000-000000000000'

const route = useRoute()
const agentsApi = useAgents()

const officeId = computed(() => (route.query.office as string) || PLACEHOLDER_OFFICE_ID)

const agents = ref<OfficeAgent[]>([])
const loading = ref(true)
const showAdd = ref(false)
const creating = ref(false)
const addError = ref('')

async function load() {
  loading.value = true
  try {
    agents.value = await agentsApi.listByOffice(officeId.value)
  } catch {
    agents.value = []
  } finally {
    loading.value = false
  }
}

async function addAgent(data: AgentInput) {
  if (!data.name?.trim() || !data.role?.trim()) {
    addError.value = 'Name and role are required'
    return
  }

  creating.value = true
  addError.value = ''
  try {
    await agentsApi.create(officeId.value, data as CreateAgentInput)
    showAdd.value = false
    await load()
  } catch (err: unknown) {
    addError.value = (err as { data?: { error?: string } })?.data?.error || 'Failed to create agent'
  } finally {
    creating.value = false
  }
}

watch(officeId, load)
onMounted(load)
</script>
