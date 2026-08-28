import type { OfficeAgent, OfficeTask, TaskStatus } from '@jheckbot/shared'
import type { OfficeAgentService } from '../OfficeAgentService.js'
import type { OfficeEventService } from '../OfficeEventService.js'
import type { OfficeTaskService } from '../OfficeTaskService.js'
import type { AgentSelector } from './AgentSelector.js'

const DISPATCHABLE_STATUSES: readonly TaskStatus[] = ['ready', 'assigned']

export interface DispatchResult {
  task: OfficeTask
  agent: OfficeAgent
}

export interface DispatchOptions {
  agentSelector?: Pick<AgentSelector, 'select'>
}

export class TaskDispatchError extends Error {
  statusCode: number
  constructor(message: string, statusCode = 400) {
    super(message)
    this.name = 'TaskDispatchError'
    this.statusCode = statusCode
  }
}

/**
 * Dispatches a ready task to the best available agent and records the event.
 */
export class TaskDispatcher {
  constructor(
    private taskService: OfficeTaskService,
    private agentService: OfficeAgentService,
    private eventService: OfficeEventService,
    private agentSelector: Pick<AgentSelector, 'select'>,
  ) {}

  async dispatch(taskId: string, options: DispatchOptions = {}): Promise<DispatchResult> {
    if (!taskId?.trim()) {
      throw new TaskDispatchError('Task ID is required')
    }

    const task = await this.taskService.getById(taskId)
    if (!task) {
      throw new TaskDispatchError('Task not found', 404)
    }
    if (!task.officeId?.trim()) {
      throw new TaskDispatchError('Task office ID is required')
    }

    if (!DISPATCHABLE_STATUSES.includes(task.status)) {
      throw new TaskDispatchError(
        `Task cannot be dispatched from status '${task.status}'`,
        409,
      )
    }

    const dependencies = await this.taskService.listDependencies(task.id)
    const uncompleted = dependencies.filter((dep) => dep.status !== 'completed')
    if (uncompleted.length > 0) {
      const ids = uncompleted.map((dep) => dep.id).join(', ')
      throw new TaskDispatchError(
        `Cannot dispatch task with uncompleted dependencies: ${ids}`,
        409,
      )
    }

    const selector = options.agentSelector ?? this.agentSelector
    const agent = await selector.select({
      task,
      officeId: task.officeId,
      agentService: this.agentService,
    })
    if (!agent) {
      throw new TaskDispatchError('No available agent for task', 409)
    }

    const updatedTask = await this.assignTask(task, agent.id)
    if (!updatedTask) {
      throw new TaskDispatchError('Failed to assign task', 500)
    }

    const updatedAgent = await this.agentService.update(agent.id, { status: 'working' })
    if (!updatedAgent) {
      throw new TaskDispatchError('Failed to update agent status', 500)
    }

    await this.eventService.create({
      officeId: task.officeId,
      eventType: 'TASK_DISPATCHED',
      content: `Task dispatched to ${agent.name}`,
      metadata: {
        taskId: updatedTask.id,
        agentId: agent.id,
        agentName: agent.name,
        previousStatus: task.status,
      },
    })

    return { task: updatedTask, agent: updatedAgent }
  }

  private async assignTask(task: OfficeTask, agentId: string): Promise<OfficeTask | null> {
    const statusUpdated = await this.taskService.setStatus(task.id, 'assigned')
    if (!statusUpdated) return null
    return this.taskService.update(task.id, { assignedAgentId: agentId })
  }
}
