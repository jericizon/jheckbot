import type { EventType, OfficeEvent } from '@jheckbot/shared'
import type { OfficeEventService } from '../OfficeEventService.js'
import type { OfficeAgentService } from '../OfficeAgentService.js'
import type { WorkflowEngine } from './WorkflowEngine.js'
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
  model?: string
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
    private agentService: OfficeAgentService,
    private workflowEngine?: WorkflowEngine,
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

    const exists = await this.eventService.officeExists(officeId)
    if (!exists) {
      throw new CEOServiceError('Office not found', 404)
    }

    const userMessage = await this.eventService.create({
      officeId,
      eventType: 'CEO_MESSAGE',
      content: request,
      metadata: { projectId: input.projectId ?? null, sender: 'user', model: input.model ?? null },
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

    // Kick off the conference-room meeting in the background so the API
    // response returns immediately while agents gather and talk live.
    this.holdMeeting(officeId, plan, userMessage, input.projectId).catch(() => {
      // Non-fatal: the meeting is best-effort visual feedback.
    })

    return { userMessage, ceoResponse, plan }
  }

  private async holdMeeting(
    officeId: string,
    plan: CEOPlan,
    userMessage: OfficeEvent,
    projectId?: string,
  ): Promise<void> {
    const agents = await this.agentService.listByOffice(officeId)
    const ceo = agents.find((a) => a.role.toLowerCase() === 'ceo' && a.status === 'idle')
    const support = agents.find((a) => a.role.toLowerCase() === 'support' && a.status === 'idle')
    const qa = agents.find((a) => a.role.toLowerCase().includes('qa') && a.status === 'idle')

    // Phase 1: CEO plans alone in the thinking room.
    if (ceo) {
      await this.agentService.update(ceo.id, { status: 'communicating' })
    }
    await this.eventService.create({
      officeId,
      eventType: 'CEO_DELEGATING',
      content: 'CEO is planning the approach',
      metadata: { projectId: projectId ?? null, request: plan.request, phase: 'planning' },
    })
    await this.delay(2000)

    if (ceo) {
      await this.eventService.create({
        officeId,
        eventType: 'AGENT_MESSAGE',
        content: `I have a plan for "${plan.request}". Complexity is ${plan.complexity} with ${plan.tasks.length} task${plan.tasks.length === 1 ? '' : 's'}.`,
        metadata: { projectId: projectId ?? null, fromAgentId: ceo.id, phase: 'planning' },
      })
    }
    await this.delay(1500)

    // Phase 2: Support is called in for implementation work.
    if (support) {
      await this.agentService.update(support.id, { status: 'communicating' })
      await this.eventService.create({
        officeId,
        eventType: 'CEO_DELEGATING',
        content: 'Calling Support to start implementation',
        metadata: { projectId: projectId ?? null, request: plan.request, phase: 'work', agentId: support.id },
      })
      await this.delay(1500)

      const implTasks = plan.tasks.filter(
        (t) => !t.title.toLowerCase().includes('qa') && !t.title.toLowerCase().includes('review'),
      )
      if (ceo) {
        await this.eventService.create({
          officeId,
          eventType: 'AGENT_MESSAGE',
          content: `Support, please handle the implementation: ${implTasks.map((t) => t.title).join(', ')}.`,
          metadata: { projectId: projectId ?? null, fromAgentId: ceo.id, toAgentId: support.id, phase: 'work' },
        })
      }
      await this.delay(1000)

      await this.eventService.create({
        officeId,
        eventType: 'AGENT_MESSAGE',
        content: "On it. I'll get the implementation done.",
        metadata: { projectId: projectId ?? null, fromAgentId: support.id, toAgentId: ceo?.id, phase: 'work' },
      })
      await this.delay(1500)
    }

    // Phase 3: QA is called in for finalizing.
    if (qa) {
      await this.agentService.update(qa.id, { status: 'communicating' })
      await this.eventService.create({
        officeId,
        eventType: 'CEO_DELEGATING',
        content: 'Calling QA for finalizing',
        metadata: { projectId: projectId ?? null, request: plan.request, phase: 'finalizing', agentId: qa.id },
      })
      await this.delay(1500)

      if (ceo) {
        await this.eventService.create({
          officeId,
          eventType: 'AGENT_MESSAGE',
          content: 'QA, please verify and review the work.',
          metadata: { projectId: projectId ?? null, fromAgentId: ceo.id, toAgentId: qa.id, phase: 'finalizing' },
        })
      }
      await this.delay(1000)

      await this.eventService.create({
        officeId,
        eventType: 'AGENT_MESSAGE',
        content: "I'll verify everything is correct.",
        metadata: { projectId: projectId ?? null, fromAgentId: qa.id, toAgentId: ceo?.id, phase: 'finalizing' },
      })
      await this.delay(1500)
    }

    // Wrap up: everyone returns to idle before task dispatch.
    if (ceo) await this.agentService.update(ceo.id, { status: 'idle' })
    if (support) await this.agentService.update(support.id, { status: 'idle' })
    if (qa) await this.agentService.update(qa.id, { status: 'idle' })

    await this.eventService.create({
      officeId,
      eventType: 'CEO_WAITING',
      content: 'Planning complete. Dispatching tasks.',
      metadata: { projectId: projectId ?? null, request: plan.request },
    })

    if (this.workflowEngine && plan.tasks.length > 0) {
      const rootTask = plan.tasks[0]
      await this.workflowEngine.startWorkflow(officeId, rootTask.id, plan.tasks, {
        stepType: 'task',
        metadata: { request: plan.request, projectId: projectId ?? null, userMessageId: userMessage.id },
      })
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
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
