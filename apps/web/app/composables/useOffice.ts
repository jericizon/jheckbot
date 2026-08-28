import { computed, ref, watch } from 'vue'
import { useAgents } from './useAgents'
import type { OfficeAgent } from '@jheckbot/shared'

export const PLACEHOLDER_OFFICE_ID = '00000000-0000-0000-0000-000000000000'

export type OfficePanelMode = 'none' | 'agent' | 'ceo' | 'task' | 'activity'

export function findCeo(agents: OfficeAgent[]): OfficeAgent | undefined {
  const explicit = agents.find((agent) => /ceo/i.test(agent.role))
  if (explicit) return explicit
  return agents.find((agent) => agent.enabled) ?? agents[0]
}

export function findEmployees(agents: OfficeAgent[], ceo?: OfficeAgent): OfficeAgent[] {
  const candidates = ceo ? agents.filter((agent) => agent.id !== ceo.id) : agents
  return candidates.filter((agent) => agent.enabled !== false).slice(0, 3)
}

export function useOffice(initialOfficeId?: string) {
  const agentsApi = useAgents()

  const officeId = ref(initialOfficeId || PLACEHOLDER_OFFICE_ID)
  const agents = ref<OfficeAgent[]>([])
  const loading = ref(false)
  const error = ref('')
  const selectedAgent = ref<OfficeAgent | null>(null)
  const selectedMode = ref<OfficePanelMode>('none')

  const ceo = computed(() => findCeo(agents.value))
  const employees = computed(() => findEmployees(agents.value, ceo.value))

  function setOfficeId(id: string) {
    officeId.value = id || PLACEHOLDER_OFFICE_ID
  }

  function selectAgent(agent: OfficeAgent) {
    selectedAgent.value = agent
    selectedMode.value = 'agent'
  }

  function selectCeo() {
    const c = ceo.value
    if (!c) return
    selectedAgent.value = c
    selectedMode.value = 'ceo'
  }

  function clearSelection() {
    selectedAgent.value = null
    selectedMode.value = 'none'
  }

  async function load() {
    loading.value = true
    error.value = ''
    try {
      agents.value = await agentsApi.listByOffice(officeId.value)
    } catch {
      agents.value = []
      error.value = 'Failed to load office'
    } finally {
      loading.value = false
    }
  }

  watch(officeId, () => load(), { immediate: false })

  return {
    officeId,
    agents,
    loading,
    error,
    ceo,
    employees,
    selectedAgent,
    selectedMode,
    setOfficeId,
    load,
    selectAgent,
    selectCeo,
    clearSelection,
  }
}
