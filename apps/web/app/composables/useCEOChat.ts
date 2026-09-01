import type { OfficeEvent } from '@jheckbot/shared'

export interface CEOChatMessage {
  id: string
  sender: 'user' | 'ceo'
  content: string
  createdAt: string
}

export function useCEOChat() {
  const api = useApi()

  return {
    listEvents: (officeId: string) =>
      api.get<OfficeEvent[]>(`/api/offices/${officeId}/ceo/events`),

    sendMessage: (officeId: string, request: string, projectId?: string, model?: string) =>
      api.post<{
        userMessage: OfficeEvent
        ceoResponse: OfficeEvent
        plan: {
          request: string
          complexity: string
          tasks: { id: string; title: string; status: string }[]
          dependencies: { taskId: string; dependsOnTaskId: string }[]
        }
        execution: {
          taskId: string
          conversationId?: string
          agentId?: string
          status: 'started' | 'failed'
          error?: string
        }
      }>(`/api/offices/${officeId}/ceo/messages`, {
        request,
        projectId,
        model,
      }),
  }
}
