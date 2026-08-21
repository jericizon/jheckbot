interface Conversation {
  id: string
  project_id: string
  title: string
  status: string
  agent_type: string
  agent_session_id: string | null
  agent_status: string
  created_at: string
  updated_at: string
  last_message_at: string | null
}

interface Message {
  id: string
  conversation_id: string
  role: string
  content: string
  message_type: string
  created_at: string
}

interface AgentRun {
  conversationId: string
  projectSlug: string
  sessionName: string
  cwd: string
  status: string
  startedAt: string
  outputBuffer: string
  normalizedSnapshot: string[]
}

interface SendMessageResponse {
  message: Message
  run: AgentRun
}

interface SearchResult {
  conversation_id: string
  project_id: string
  project_name: string
  conversation_title: string
  created_at: string
}

interface ModelOption {
  id: string
  label: string
  family: string
  context: string
  pricing: string
  free: boolean
}

interface ModelsResponse {
  models: ModelOption[]
  default: string
}

export function useConversations() {
  const api = useApi()

  return {
    listByProject: (projectId: string) =>
      api.get<Conversation[]>(`/api/projects/${projectId}/conversations`),
    create: (projectId: string, title?: string) =>
      api.post<Conversation>(`/api/projects/${projectId}/conversations`, { title }),
    get: (id: string) => api.get<Conversation>(`/api/conversations/${id}`),
    update: (id: string, data: { title?: string }) =>
      api.patch<Conversation>(`/api/conversations/${id}`, data),
    archive: (id: string) => api.post<Conversation>(`/api/conversations/${id}/archive`),
    delete: (id: string) => api.delete<void>(`/api/conversations/${id}`),
    messages: (id: string) => api.get<Message[]>(`/api/conversations/${id}/messages`),
    sendMessage: (id: string, content: string, model?: string, bypass?: boolean) =>
      api.post<SendMessageResponse>(`/api/conversations/${id}/messages`, { content, model, bypass }),
    stopAgent: (id: string) => api.post(`/api/conversations/${id}/agent/stop`),
    agentStatus: (id: string) => api.get(`/api/conversations/${id}/agent`),
    search: (q: string) => api.get<SearchResult[]>(`/api/search?q=${encodeURIComponent(q)}`),
    models: () => api.get<ModelsResponse>('/api/models'),
  }
}
