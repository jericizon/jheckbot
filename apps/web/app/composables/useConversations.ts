interface Conversation {
  id: string
  project_id: string
  title: string
  status: string
  agent_type: string
  agent_session_id: string | null
  agent_status: string
  is_pinned: boolean
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

interface ActiveConversation {
  id: string
  project_id: string
  project_name: string
  title: string
  agent_status: string
  is_pinned: boolean
}

interface SearchResult {
  conversation_id: string
  project_id: string
  project_name: string
  conversation_title: string
  created_at: string
}

interface ModelVariant {
  id: string
  level: string
  pricing: string
  free: boolean
}

interface ModelFamily {
  id: string
  label: string
  context: string
  tier: 'free' | 'budget' | 'mid' | 'premium'
  variants: ModelVariant[]
}

interface ModelsResponse {
  families: ModelFamily[]
  default: string
}

export function useConversations() {
  const api = useApi()

  return {
    listByProject: (projectId: string) =>
      api.get<Conversation[]>(`/api/projects/${projectId}/conversations`),
    listActive: () => api.get<ActiveConversation[]>('/api/conversations/active'),
    create: (projectId: string, title?: string) =>
      api.post<Conversation>(`/api/projects/${projectId}/conversations`, { title }),
    get: (id: string) => api.get<Conversation>(`/api/conversations/${id}`),
    update: (id: string, data: { title?: string; isPinned?: boolean }) =>
      api.patch<Conversation>(`/api/conversations/${id}`, data),
    archive: (id: string) => api.post<Conversation>(`/api/conversations/${id}/archive`),
    delete: (id: string) => api.delete<void>(`/api/conversations/${id}`),
    messages: (id: string) => api.get<Message[]>(`/api/conversations/${id}/messages`),
    sendMessage: (id: string, content: string, model?: string, bypass?: boolean) =>
      api.post<SendMessageResponse>(`/api/conversations/${id}/messages`, {
        content,
        model,
        bypass,
      }),
    stopAgent: (id: string) => api.post(`/api/conversations/${id}/agent/stop`),
    agentStatus: (id: string) => api.get(`/api/conversations/${id}/agent`),
    search: (q: string) => api.get<SearchResult[]>(`/api/search?q=${encodeURIComponent(q)}`),
    models: () => api.get<ModelsResponse>('/api/models'),
  }
}
