import type { EventType, OfficeAgent, OfficeTask } from '@jheckbot/shared'
import { isValidUuid } from '@jheckbot/shared'
import type { AgentManager, AgentStreamEvent } from '../../agent/AgentManager.js'
import type { ConversationService } from '../ConversationService.js'
import type { OfficeAgentService } from '../OfficeAgentService.js'
import type { OfficeEventService } from '../OfficeEventService.js'
import type { OfficeTaskService } from '../OfficeTaskService.js'
import type { PromptExecutionService } from '../PromptExecutionService.js'
import type { TaskDispatcher } from './TaskDispatcher.js'

export type OfficeTaskExecutionStatus = 'started' | 'failed'

export interface OfficeTaskExecutionResult {
  taskId: string
  conversationId?: string
  agentId?: string
  status: OfficeTaskExecutionStatus
  error?: string
}

export interface StartOfficeTaskExecutionOptions {
  model?: string
}

interface OfficeTaskExecutionDependencies {
  taskService: Pick<
    OfficeTaskService,
    'getById' | 'setStatus' | 'failExecution' | 'completeExecution' | 'linkExecutionConversation'
  >
  taskDispatcher: Pick<TaskDispatcher, 'dispatch'>
  conversationService: Pick<ConversationService, 'create' | 'get'>
  promptExecutionService: Pick<PromptExecutionService, 'send'>
  agentManager: Pick<AgentManager, 'subscribe'>
  agentService: Pick<OfficeAgentService, 'update'>
  eventService: Pick<OfficeEventService, 'create'>
}

export class OfficeTaskExecutionError extends Error {
  statusCode: number
  constructor(message: string, statusCode = 500) {
    super(message)
    this.name = 'OfficeTaskExecutionError'
    this.statusCode = statusCode
  }
}

const TERMINAL_STATUSES = new Set(['completed', 'failed', 'stopped'])

export class OfficeTaskExecutionService {
  private terminalGuard = new Set<string>()
  private subscriptions = new Map<string, () => void>()

  constructor(private deps: OfficeTaskExecutionDependencies) {}

  async start(
    taskId: string,
    options?: StartOfficeTaskExecutionOptions,
  ): Promise<OfficeTaskExecutionResult> {
    if (!taskId?.trim()) {
      return { taskId: '', status: 'failed', error: 'task_id_required' }
    }
    if (!isValidUuid(taskId)) {
      return { taskId, status: 'failed', error: 'task_id_invalid' }
    }

    const task = await this.deps.taskService.getById(taskId)
    if (!task) {
      return { taskId, status: 'failed', error: 'task_not_found' }
    }
    if (!task.projectId) {
      return { taskId, status: 'failed', error: 'task_no_project' }
    }

    if (task.executionConversationId && !this.isTerminal(task.status)) {
      return {
        taskId: task.id,
        conversationId: task.executionConversationId,
        status: 'started',
      }
    }

    if (this.isTerminal(task.status)) {
      return { taskId: task.id, status: 'failed', error: 'task_already_terminal' }
    }

    let assignedAgentId: string | undefined
    let assignedAgent: OfficeAgent | undefined
    let conversationId: string | undefined

    try {
      const readyTask = await this.deps.taskService.setStatus(task.id, 'ready')
      if (!readyTask) throw new OfficeTaskExecutionError('task_ready_failed')

      const dispatch = await this.deps.taskDispatcher.dispatch(task.id)
      assignedAgent = dispatch.agent
      assignedAgentId = assignedAgent.id

      if (assignedAgent.provider && assignedAgent.provider !== 'devin') {
        throw new OfficeTaskExecutionError('unsupported_agent_provider', 400)
      }
      if (assignedAgent.role.toLowerCase() === 'ceo') {
        throw new OfficeTaskExecutionError('ceo_cannot_execute', 400)
      }

      const workingTask = await this.deps.taskService.setStatus(task.id, 'working')
      if (!workingTask) throw new OfficeTaskExecutionError('task_working_failed')

      const conversation = await this.deps.conversationService.create({
        projectId: task.projectId,
        title: `CEO task: ${task.title}`,
        agentType: 'devin',
        providerConfig: options?.model ? { model: options.model } : undefined,
      })
      conversationId = conversation.id

      const linked = await this.deps.taskService.linkExecutionConversation(task.id, conversation.id)
      if (!linked) throw new OfficeTaskExecutionError('task_link_failed')

      const unsubscribe = this.deps.agentManager.subscribe(conversation.id, (event) => {
        void this.handleAgentEvent(linked.id, conversation.id, event, unsubscribe)
      })
      this.subscriptions.set(conversation.id, unsubscribe)

      await this.deps.promptExecutionService.send({
        conversationId: conversation.id,
        prompt: this.buildImplementationPrompt(linked),
        model: options?.model,
        bypass: false,
      })

      await this.emitOfficeEvent(task.officeId, 'AGENT_STARTED', {
        taskId: task.id,
        agentId: assignedAgent.id,
        conversationId: conversation.id,
      })

      return {
        taskId: task.id,
        conversationId: conversation.id,
        agentId: assignedAgent.id,
        status: 'started',
      }
    } catch (error) {
      const safeError = this.toSafeError(error)
      await this.handleStartupFailure(task, assignedAgentId, safeError)
      return {
        taskId: task.id,
        conversationId,
        agentId: assignedAgentId,
        status: 'failed',
        error: safeError,
      }
    }
  }

  private buildImplementationPrompt(task: OfficeTask): string {
    const lines = [
      'Implement the following task.',
      `Title: ${task.title}`,
      `Description: ${task.description ?? 'N/A'}`,
    ]
    if (task.acceptanceCriteria) {
      lines.push(`Acceptance criteria: ${task.acceptanceCriteria}`)
    }
    return lines.join('\n')
  }

  private isTerminal(status: string): boolean {
    return status === 'completed' || status === 'failed' || status === 'cancelled'
  }

  private async handleStartupFailure(
    task: OfficeTask,
    agentId: string | undefined,
    error: string,
  ): Promise<void> {
    if (!this.isTerminal(task.status)) {
      await this.deps.taskService.failExecution(task.id, error)
    }

    if (agentId) {
      try {
        await this.deps.agentService.update(agentId, { status: 'error' })
      } catch {
        // Best effort: worker may already be terminal.
      }
    }
  }

  private async handleAgentEvent(
    taskId: string,
    conversationId: string,
    event: AgentStreamEvent,
    unsubscribe: () => void,
  ): Promise<void> {
    if (event.event_type !== 'status' || !event.content) return
    if (this.terminalGuard.has(conversationId)) return

    let payload: { status?: string; error?: string } = {}
    try {
      payload = JSON.parse(event.content) as { status?: string; error?: string }
    } catch {
      return
    }

    const status = payload.status
    if (!status || !TERMINAL_STATUSES.has(status)) return

    this.terminalGuard.add(conversationId)
    unsubscribe()
    this.subscriptions.delete(conversationId)

    const task = await this.deps.taskService.getById(taskId)
    if (!task) return

    if (status === 'completed') {
      await this.deps.taskService.completeExecution(taskId)
      if (task.assignedAgentId) {
        try {
          await this.deps.agentService.update(task.assignedAgentId, { status: 'idle' })
        } catch {
          // Best effort.
        }
      }
      await this.emitOfficeEvent(task.officeId, 'AGENT_COMPLETED', {
        taskId,
        conversationId,
        agentId: task.assignedAgentId,
      })
    } else {
      // failed or stopped
      await this.deps.taskService.failExecution(taskId, status)

      const agentStatus = status === 'failed' ? 'error' : 'idle'
      if (task.assignedAgentId) {
        try {
          await this.deps.agentService.update(task.assignedAgentId, { status: agentStatus })
        } catch {
          // Best effort.
        }
      }

      await this.emitOfficeEvent(task.officeId, 'AGENT_FAILED', {
        taskId,
        conversationId,
        agentId: task.assignedAgentId,
        status,
      })
    }
  }

  private toSafeError(error: unknown): string {
    if (error instanceof OfficeTaskExecutionError) return error.message
    const err = error instanceof Error ? error : new Error(String(error))
    if (err.name === 'TaskDispatchError') return 'task_dispatch_failed'
    if (err.name === 'ConversationValidationError') return 'conversation_create_failed'
    if (err.name === 'PromptExecutionError') return 'prompt_execution_failed'
    if (err.name === 'AgentManagerError') return 'agent_start_failed'
    return 'devin_start_failed'
  }

  private async emitOfficeEvent(
    officeId: string,
    eventType: string,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.deps.eventService.create({
        officeId,
        eventType: eventType as EventType,
        content: `${eventType}: ${String(metadata.taskId ?? metadata.conversationId ?? '')}`,
        metadata,
      })
    } catch {
      // Office events are best-effort; do not break execution.
    }
  }
}
