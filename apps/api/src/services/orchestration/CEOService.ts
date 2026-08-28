import type { EventType, OfficeEvent } from '@jheckbot/shared'
import type { OfficeEventService } from '../OfficeEventService.js'
import type { CEOPlan, CEOPlanner } from './CEOPlanner.js'

export interface CEOChatMessage {
  id: string
  sender: 'user' | 'ceo'
  content: string
  createdAt: string
  metadata?: Record<string, unknown>
}

export interface CEOSendMessageInput {
  officeId: string
  request: string
  projectId?: string
}

export interface CEOSendMessageResult {
  userMessage: OfficeEvent
  ceoResponse: OfficeEvent
  plan: CEOPlan
}

export class CEOServiceError extends Error {
  statusCode: number
  constructor(message: string, statusCode = 400) {
    super(message)
    this.name = 'CEOServiceError'
    this.statusCode = statusCode
  }
}

export class CEOService {
  constructor(
    private planner: CEOPlanner,
    private eventService: OfficeEventService,
  ) {}

  async sendMessage(input: CEOSendMessageInput): Promise<CEOSendMessageResult> {
    if (!input.officeId?.trim()) {
      throw new CEOServiceError('Office ID is required')
    }
    if (!input.request?.trim()) {
      throw new CEOServiceError('Request is required')
    }

    const officeId = input.officeId
    const request = input.request.trim()

    const userMessage = await this.eventService.create({
      officeId,
      eventType: 'CEO_MESSAGE',
      content: request,
      metadata: { projectId: input.projectId ?? null, sender: 'user' },
    })

    const plan = await this.planner.plan(request, officeId, input.projectId)

    const responseContent = this.buildResponse(request, plan)
    const ceoResponse = await this.eventService.create({
      officeId,
      eventType: 'CEO_RESPONSE',
      content: responseContent,
      metadata: {
        projectId: input.projectId ?? null,
        sender: 'ceo',
        complexity: plan.complexity,
        taskCount: plan.tasks.length,
      },
    })

    return { userMessage, ceoResponse, plan }
  }

  async listConversationEvents(officeId: string): Promise<OfficeEvent[]> {
    if (!officeId?.trim()) {
      throw new CEOServiceError('Office ID is required')
    }
    const eventTypes: EventType[] = ['CEO_MESSAGE', 'CEO_RESPONSE', 'CEO_PLANNING']
    return this.eventService.listByOfficeAndTypes(officeId, eventTypes)
  }

  private buildResponse(request: string, plan: CEOPlan): string {
    const taskList = plan.tasks.map((t) => `• ${t.title}`).join('\n')
    return `I have a plan for "${request}" (${plan.complexity}):\n${taskList}`
  }
}
