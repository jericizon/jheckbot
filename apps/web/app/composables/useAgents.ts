import type { AgentStatus, OfficeAgent, OfficeAgentCapability } from '@jheckbot/shared'

export interface AgentInput extends Record<string, unknown> {
  name?: string
  role?: string
  description?: string
  provider?: string
  model?: string
  status?: AgentStatus
  enabled?: boolean
}

export interface CreateAgentInput extends AgentInput {
  name: string
  role: string
}

export function useAgents() {
  const api = useApi()

  return {
    listByOffice: (officeId: string) => api.get<OfficeAgent[]>(`/api/offices/${officeId}/agents`),

    create: (officeId: string, data: CreateAgentInput) =>
      api.post<OfficeAgent>(`/api/offices/${officeId}/agents`, data),

    get: (id: string) => api.get<OfficeAgent>(`/api/agents/${id}`),

    update: (id: string, data: AgentInput) => api.patch<OfficeAgent>(`/api/agents/${id}`, data),

    delete: (id: string) => api.delete<void>(`/api/agents/${id}`),

    enable: (id: string) => api.post<OfficeAgent>(`/api/agents/${id}/enable`),

    disable: (id: string) => api.post<OfficeAgent>(`/api/agents/${id}/disable`),

    listCapabilities: (id: string) =>
      api.get<OfficeAgentCapability[]>(`/api/agents/${id}/capabilities`),

    addCapability: (id: string, capability: string) =>
      api.post<OfficeAgentCapability>(`/api/agents/${id}/capabilities`, { capability }),

    removeCapability: (id: string, capability: string) =>
      api.delete<void>(`/api/agents/${id}/capabilities/${encodeURIComponent(capability)}`),
  }
}
