<template>
  <div class="pb-20">
    <AppHeader sticky>
      <template #leading>
        <button
          @click="goBack"
          class="p-2 -ml-2 rounded-lg text-content-muted hover:text-content transition-colors"
          aria-label="Back"
        >
          <svg
            class="w-5 h-5"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            viewBox="0 0 24 24"
          >
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      </template>
      <h1 class="text-lg font-semibold truncate">{{ agent?.name || 'Agent' }}</h1>
      <template #actions>
        <button
          v-if="agent"
          @click="toggleEnabled"
          :disabled="toggling"
          class="rounded-lg px-3 py-1.5 text-xs font-medium transition-colors border"
          :class="
            agent.enabled
              ? 'border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10'
              : 'border-content-subtle text-content-subtle hover:text-content hover:border-content'
          "
        >
          {{ toggling ? '...' : agent.enabled ? 'Enabled' : 'Disabled' }}
        </button>
      </template>
    </AppHeader>

    <div class="px-4 py-4 max-w-2xl mx-auto space-y-4">
      <div v-if="loading" class="space-y-2">
        <div class="rounded-lg border border-border bg-surface-elevated p-4 animate-pulse">
          <div class="h-4 w-32 bg-surface-subtle rounded" />
          <div class="h-3 w-48 bg-surface-subtle rounded mt-2" />
        </div>
      </div>

      <div v-else-if="!agent" class="text-content-subtle text-sm py-8 text-center">
        Agent not found.
      </div>

      <template v-else>
        <AgentForm :agent="agent" :loading="saving" @submit="saveAgent" />
        <p v-if="saveError" class="text-sm text-red-500">{{ saveError }}</p>

        <AgentCapabilities
          :capabilities="capabilities"
          :loading="capLoading"
          :error="capError"
          @add="addCapability"
          @remove="removeCapability"
        />

        <div class="pt-2">
          <button
            @click="showDeleteModal = true"
            class="w-full rounded-lg border border-red-500/30 text-red-500 py-2.5 text-sm font-medium hover:bg-red-500/10 transition-colors"
          >
            Delete Agent
          </button>
          <p v-if="deleteError" class="text-sm text-red-500 mt-2">{{ deleteError }}</p>
        </div>
      </template>
    </div>

    <ConfirmModal
      :open="showDeleteModal"
      title="Delete Agent"
      :message="
        agent
          ? `Delete \u201C${agent.name}\u201D? This cannot be undone.`
          : 'Delete this agent? This cannot be undone.'
      "
      confirm-label="Delete"
      loading-label="Deleting..."
      :loading="deleting"
      :error="deleteError"
      variant="danger"
      @confirm="deleteAgent"
      @cancel="showDeleteModal = false"
    />
  </div>
</template>

<script setup lang="ts">
import { useAgents, type AgentInput } from '~/composables/useAgents'
import AgentForm from '~/components/agents/AgentForm.vue'
import AgentCapabilities from '~/components/agents/AgentCapabilities.vue'
import type { OfficeAgent, OfficeAgentCapability } from '@jheckbot/shared'

const route = useRoute()
const agentsApi = useAgents()

const id = computed(() => route.params.id as string)

const agent = ref<OfficeAgent | null>(null)
const capabilities = ref<OfficeAgentCapability[]>([])
const loading = ref(true)
const saving = ref(false)
const saveError = ref('')
const toggling = ref(false)
const deleting = ref(false)
const deleteError = ref('')
const showDeleteModal = ref(false)
const capLoading = ref(false)
const capError = ref('')

async function load() {
  loading.value = true
  try {
    const [a, caps] = await Promise.all([
      agentsApi.get(id.value),
      agentsApi.listCapabilities(id.value),
    ])
    agent.value = a
    capabilities.value = caps
  } catch {
    agent.value = null
    capabilities.value = []
  } finally {
    loading.value = false
  }
}

async function saveAgent(data: AgentInput) {
  if (!agent.value) return
  saving.value = true
  saveError.value = ''
  try {
    const updated = await agentsApi.update(id.value, data)
    if (updated) agent.value = updated
  } catch (err: unknown) {
    saveError.value = (err as { data?: { error?: string } })?.data?.error || 'Failed to save agent'
  } finally {
    saving.value = false
  }
}

async function toggleEnabled() {
  if (!agent.value) return
  toggling.value = true
  try {
    const updated = agent.value.enabled
      ? await agentsApi.disable(id.value)
      : await agentsApi.enable(id.value)
    if (updated) agent.value = updated
  } catch (err: unknown) {
    saveError.value =
      (err as { data?: { error?: string } })?.data?.error || 'Failed to toggle status'
  } finally {
    toggling.value = false
  }
}

async function deleteAgent() {
  deleting.value = true
  deleteError.value = ''
  try {
    await agentsApi.delete(id.value)
    showDeleteModal.value = false
    await goBack()
  } catch (err: unknown) {
    deleteError.value =
      (err as { data?: { error?: string } })?.data?.error || 'Failed to delete agent'
  } finally {
    deleting.value = false
  }
}

async function addCapability(capability: string) {
  if (!agent.value) return
  capLoading.value = true
  capError.value = ''
  try {
    const added = await agentsApi.addCapability(id.value, capability)
    if (added) capabilities.value.unshift(added)
  } catch (err: unknown) {
    capError.value =
      (err as { data?: { error?: string } })?.data?.error || 'Failed to add capability'
  } finally {
    capLoading.value = false
  }
}

async function removeCapability(capability: string) {
  if (!agent.value) return
  capLoading.value = true
  capError.value = ''
  try {
    await agentsApi.removeCapability(id.value, capability)
    capabilities.value = capabilities.value.filter((c) => c.capability !== capability)
  } catch (err: unknown) {
    capError.value =
      (err as { data?: { error?: string } })?.data?.error || 'Failed to remove capability'
  } finally {
    capLoading.value = false
  }
}

function goBack() {
  const officeId = agent.value?.officeId || ''
  const query = officeId ? `?office=${encodeURIComponent(officeId)}` : ''
  navigateTo(`/agents${query}`)
}

onMounted(load)
</script>
