import type { Office, OfficeAgent } from '@jheckbot/shared'

interface OfficeResult {
  office: Office
  agents: OfficeAgent[]
  created: boolean
}

export function useOffices() {
  const api = useApi()

  return {
    getOrCreateByProject: (projectId: string) =>
      api.get<OfficeResult>(`/api/projects/${projectId}/office`),
  }
}
