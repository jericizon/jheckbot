import type { EventType, OfficeEvent } from '@jheckbot/shared'
import type { OfficeRepository } from '../../repositories/OfficeRepository.js'
import type { ProjectService } from '../ProjectService.js'
import type { OfficeEventService } from '../OfficeEventService.js'
import type { OfficeTaskService } from '../OfficeTaskService.js'
import type { CEOPlan, CEOPlanner } from './CEOPlanner.js'
import type { OfficeTaskExecutionResult, OfficeTaskExecutionService } from './OfficeTaskExecutionService.js'

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

export interface CEOExecutionSummary {
  taskId: string
  conversationId?: string
  agentId?: string
  status: 'started' | 'failed'
  error?: string
}

export interface CEOSendMessageResult {
  userMessage: OfficeEvent
  ceoResponse: OfficeEvent
  plan: CEOPlan
  execution: CEOExecutionSummary
}

export interface CEOServiceDependencies {
  planner: CEOPlanner
  eventService: OfficeEventService
  executionService: OfficeTaskExecutionService
  taskService: OfficeTaskService
  officeRepo: OfficeRepository
  projectService: ProjectService
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
  constructor(private deps: CEOServiceDependencies) {}

  async sendMessage(input: CEOSendMessageInput): Promise<CEOSendMessageResult> {
    if (!input.officeId?.trim()) {
      throw new CEOServiceError('Office ID is required')
    }
    if (!input.request?.trim()) {
      throw new CEOServiceError('Request is required')
    }

    const officeId = input.officeId
    const request = input.request.trim()

    const office = await this.deps.officeRepo.findById(officeId)
    if (!office) {
      throw new CEOServiceError('Office not found', 404)
    }

    const effectiveProjectId = this.resolveProjectId(input.projectId, office.projectId)
    if (!effectiveProjectId) {
      throw new CEOServiceError('Project ID is required')
    }

    const project = await this.deps.projectService.get(effectiveProjectId)
    if (!project) {
      throw new CEOServiceError('Project not found', 404)
    }
    if (!project.enabled) {
      throw new CEOServiceError('Project is disabled', 400)
    }

    const activeExecution = await this.deps.taskService.findActiveCeoExecution(officeId)
    if (activeExecution) {
      throw new CEOServiceError('An active CEO execution is already in progress', 409)
    }

    const userMessage = await this.deps.eventService.create({
      officeId,
      eventType: 'CEO_MESSAGE',
      content: request,
      metadata: { projectId: effectiveProjectId, sender: 'user', model: input.model ?? null },
    })

    const plan = await this.deps.planner.planSingleTask(request, officeId, effectiveProjectId)
    const task = plan.tasks[0]
    if (!task) {
      throw new CEOServiceError('No task was planned', 500)
    }

    const execution = await this.deps.executionService.start(task.id, { model: input.model })

    const responseContent = this.buildResponse(request, plan, execution)
    const ceoResponse = await this.deps.eventService.create({
      officeId,
      eventType: 'CEO_RESPONSE',
      content: responseContent,
      metadata: {
        projectId: effectiveProjectId,
        sender: 'ceo',
        complexity: plan.complexity,
        taskCount: 1,
        execution,
      },
    })

    return { userMessage, ceoResponse, plan, execution: this.toSummary(execution) }
  }

  async listConversationEvents(officeId: string): Promise<OfficeEvent[]> {
    if (!officeId?.trim()) {
      throw new CEOServiceError('Office ID is required')
    }
    const eventTypes: EventType[] = ['CEO_MESSAGE', 'CEO_RESPONSE', 'CEO_PLANNING']
    return this.deps.eventService.listByOfficeAndTypes(officeId, eventTypes)
  }

  private resolveProjectId(inputProjectId: string | undefined, officeProjectId: string | undefined): string | undefined {
    if (inputProjectId && officeProjectId && inputProjectId !== officeProjectId) {
      throw new CEOServiceError('Project ID does not match office project', 400)
    }
    return inputProjectId ?? officeProjectId
  }

  private buildResponse(request: string, plan: CEOPlan, execution: OfficeTaskExecutionResult): string {
    const task = plan.tasks[0]
    const taskLine = task ? `\n• ${task.title}` : ''
    const statusLine =
      execution.status === 'started'
        ? 'Devin has started working on this task.'
        : 'Devin could not be started.'
    return `I have a plan for "${request}" (${plan.complexity}):${taskLine}\n${statusLine}`
  }

  private toSummary(execution: OfficeTaskExecutionResult): CEOExecutionSummary {
    return {
      taskId: execution.taskId,
      conversationId: execution.conversationId,
      agentId: execution.agentId,
      status: execution.status,
      error: execution.error,
    }
  }
}
