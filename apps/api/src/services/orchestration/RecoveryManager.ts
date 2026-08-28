import type { EventType, OfficeAgent, OfficeTask } from '@jheckbot/shared'
import type { OfficeAgentService } from '../OfficeAgentService.js'
import type { OfficeEventService } from '../OfficeEventService.js'
import type { CreateOfficeTaskInput, OfficeTaskService } from '../OfficeTaskService.js'

export class RecoveryError extends Error {
  statusCode: number
  constructor(message: string, statusCode = 400) {
    super(message)
    this.name = 'RecoveryError'
    this.statusCode = statusCode
  }
}

/**
 * Handles task and agent failures by creating fix tasks, retrying failed tasks,
 * and reassigning work away from failed agents.
 */
export class RecoveryManager {
  constructor(
    private taskService: OfficeTaskService,
    private agentService: OfficeAgentService,
    private eventService: OfficeEventService,
  ) {}

  async handleTaskFailure(taskId: string): Promise<OfficeTask> {
    if (!taskId?.trim()) {
      throw new RecoveryError('Task ID is required')
    }

    const task = await this.taskService.getById(taskId)
    if (!task) {
      throw new RecoveryError('Task not found', 404)
    }
    if (task.status !== 'failed') {
      throw new RecoveryError(`Task is not in failed status: ${task.status}`, 409)
    }

    const fixTask = await this.taskService.create({
      officeId: task.officeId,
      projectId: task.projectId,
      parentTaskId: task.id,
      title: `Fix: ${task.title}`,
      description: `Fix failure for: ${task.description ?? task.title}`,
      priority: task.priority,
      status: 'backlog',
      workflowType: task.workflowType,
    } as CreateOfficeTaskInput)

    await this.emitEvent(task.officeId, 'TASK_FAILED', `Task failed: ${task.title}`, {
      taskId: task.id,
      title: task.title,
    })

    await this.emitEvent(task.officeId, 'RECOVERY_STARTED', `Recovery started for failed task`, {
      fixTaskId: fixTask.id,
      originalTaskId: task.id,
      title: fixTask.title,
    })

    return fixTask
  }

  async retryTask(taskId: string): Promise<OfficeTask> {
    if (!taskId?.trim()) {
      throw new RecoveryError('Task ID is required')
    }

    const task = await this.taskService.getById(taskId)
    if (!task) {
      throw new RecoveryError('Task not found', 404)
    }
    if (task.status !== 'failed') {
      throw new RecoveryError(`Task is not in failed status: ${task.status}`, 409)
    }

    const updated = await this.taskService.setStatus(task.id, 'working')
    if (!updated) {
      throw new RecoveryError('Failed to retry task', 500)
    }

    await this.emitEvent(task.officeId, 'TASK_RETRY', `Task retry started: ${task.title}`, {
      taskId: task.id,
      title: task.title,
    })

    return updated
  }

  async handleAgentFailure(agentId: string): Promise<OfficeTask[]> {
    if (!agentId?.trim()) {
      throw new RecoveryError('Agent ID is required')
    }

    const agent = await this.agentService.getById(agentId)
    if (!agent) {
      throw new RecoveryError('Agent not found', 404)
    }

    const officeTasks = await this.taskService.listByOffice(agent.officeId)
    const affected = officeTasks.filter(
      (task) =>
        task.assignedAgentId === agentId &&
        (task.status === 'assigned' || task.status === 'working'),
    )

    const results: OfficeTask[] = []
    for (const task of affected) {
      const targetStatus = task.status === 'assigned' ? 'ready' : 'blocked'

      const statusUpdated = await this.taskService.setStatus(task.id, targetStatus)
      if (!statusUpdated) {
        throw new RecoveryError(`Failed to reset status for task ${task.id}`, 500)
      }

      const unassigned = await this.taskService.update(task.id, { assignedAgentId: null })
      if (!unassigned) {
        throw new RecoveryError(`Failed to unassign task ${task.id}`, 500)
      }

      results.push(unassigned)
    }

    await this.emitEvent(agent.officeId, 'AGENT_FAILED', `Agent failure handled: ${agent.name}`, {
      agentId: agent.id,
      agentName: agent.name,
      affectedTaskIds: results.map((task) => task.id),
    })

    return results
  }

  private async emitEvent(
    officeId: string,
    eventType: EventType,
    content: string,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    await this.eventService.create({ officeId, eventType, content, metadata })
  }
}
