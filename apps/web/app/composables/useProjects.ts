interface Project {
  id: string
  name: string
  slug: string
  path: string
  description: string | null
  enabled: boolean
  created_at: string
  updated_at: string
}

interface HealthResult {
  projectId: string
  directory: boolean
  accessible: boolean
  gitRepository: boolean
  nodeProject: boolean
  pnpmProject: boolean
  dockerProject: boolean
  devinCli: boolean
  checkedAt: string
}

export function useProjects() {
  const api = useApi()

  return {
    list: () => api.get<Project[]>('/api/projects'),
    get: (id: string) => api.get<Project>(`/api/projects/${id}`),
    create: (data: { name: string; path: string; description?: string }) =>
      api.post<Project>('/api/projects', data),
    update: (id: string, data: { name?: string; description?: string; enabled?: boolean }) =>
      api.patch<Project>(`/api/projects/${id}`, data),
    delete: (id: string) => api.delete<void>(`/api/projects/${id}`),
    validate: (id: string) => api.post<{ valid: boolean; resolvedPath: string; error: string | null }>(`/api/projects/${id}/validate`),
    health: (id: string) => api.post<HealthResult>(`/api/projects/${id}/health`),
    clearAllData: () => api.delete<{ stoppedAgents: number; deletedProjects: number }>('/api/data', { confirm: 'DELETE EVERYTHING' }),
  }
}
