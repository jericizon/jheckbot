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

interface BranchResult {
  projectId: string
  branch: string | null
  checkedAt: string
}

interface FileChange {
  path: string
  status: 'modified' | 'added' | 'deleted' | 'renamed' | 'untracked' | 'ignored'
  staged: boolean
}

interface ChangesResult {
  projectId: string
  branch: string | null
  changes: FileChange[]
  checkedAt: string
}

interface FileDiffResult {
  projectId: string
  path: string
  status: FileChange['status']
  staged: boolean
  diff: string
  checkedAt: string
}

interface GenerateCommitResult {
  projectId: string
  message: string
  fileCount: number
  checkedAt: string
}

interface CommitResult {
  projectId: string
  branch: string
  commitHash: string
  pushed: boolean
  commitMessage: string
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
    branch: (id: string) => api.get<BranchResult>(`/api/projects/${id}/branch`),
    changes: (id: string) => api.get<ChangesResult>(`/api/projects/${id}/changes`),
    diff: (id: string, path: string) => api.get<FileDiffResult>(`/api/projects/${id}/diff`, { path }),
    generateCommit: (id: string) => api.post<GenerateCommitResult>(`/api/projects/${id}/commit/generate`),
    commit: (id: string, message: string) => api.post<CommitResult>(`/api/projects/${id}/commit`, { message }),
    clearAllData: () => api.delete<{ stoppedAgents: number; deletedProjects: number }>('/api/data', { confirm: 'DELETE EVERYTHING' }),
  }
}
