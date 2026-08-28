import type { EventType, OfficeTask, TaskStatus } from '@jheckbot/shared'
import type { OfficeAgentMessageService } from '../OfficeAgentMessageService.js'
import type { OfficeEventService } from '../OfficeEventService.js'
import type { OfficeTaskService } from '../OfficeTaskService.js'

const QA_TARGET_TESTING_WORKFLOWS: readonly string[] = ['medium', 'complex']

export class QAWorkflowError extends Error {
  statusCode: number
  constructor(message: string, statusCode = 400) {
    super(message)
    this.name = 'QAWorkflowError'
    this.statusCode = statusCode
  }
}

export interface QAWorkflowServices {
  taskService: Pick<OfficeTaskService, 'getById' | 'setStatus'>
  eventService: Pick<OfficeEventService, 'create'>
  messageService: Pick<OfficeAgentMessageService, 'create'>
}

export class QAWorkflow {
  constructor(
    private taskService: Pick<OfficeTaskService, 'getById' | 'setStatus'>,
    private eventService: Pick<OfficeEventService, 'create'>,
    private messageService: Pick<OfficeAgentMessageService, 'create'>,
  ) {}

  async submitForQA(taskId: string): Promise<OfficeTask> {
    if (!taskId?.trim()) {
      throw new QAWorkflowError('Task ID is required')
    }

    const task = await this.requireTask(taskId)
    if (task.status !== 'working') {
      throw new QAWorkflowError(`Task must be in 'working' status, got: ${task.status}`, 409)
    }

    const updated = await this.setStatus(task, 'qa')
    await this.emitEvent(task.officeId, 'TASK_QA_STARTED', `Task submitted for QA: ${task.title}`, {
      taskId: task.id,
      previousStatus: 'working',
    })

    return updated
  }

  async approveQA(taskId: string): Promise<OfficeTask> {
    if (!taskId?.trim()) {
      throw new QAWorkflowError('Task ID is required')
    }

    const task = await this.requireTask(taskId)
    if (task.status !== 'qa') {
      throw new QAWorkflowError(`Task must be in 'qa' status, got: ${task.status}`, 409)
    }

    const targetStatus = this.resolveApprovedStatus(task.workflowType)
    const updated = await this.setStatus(task, targetStatus)
    await this.emitEvent(task.officeId, 'TASK_QA_APPROVED', `QA approved: ${task.title}`, {
      taskId: task.id,
      previousStatus: 'qa',
      targetStatus,
      workflowType: task.workflowType ?? null,
    })

    return updated
  }

  async rejectQA(taskId: string, reason?: string): Promise<OfficeTask> {
    if (!taskId?.trim()) {
      throw new QAWorkflowError('Task ID is required')
    }

    const task = await this.requireTask(taskId)
    if (task.status !== 'qa') {
      throw new QAWorkflowError(`Task must be in 'qa' status, got: ${task.status}`, 409)
    }

    const updated = await this.setStatus(task, 'failed')
    await this.emitEvent(task.officeId, 'TASK_QA_REJECTED', `QA rejected: ${task.title}`, {
      taskId: task.id,
      reason: reason ?? null,
    })

    return updated
  }

  async sendQAFeedback(
    taskId: string,
    content: string,
    fromAgentId?: string,
  ): Promise<ReturnType<OfficeAgentMessageService['create']>> {
    if (!taskId?.trim()) {
      throw new QAWorkflowError('Task ID is required')
    }
    if (!content?.trim()) {
      throw new QAWorkflowError('Feedback content is required')
    }

    const task = await this.requireTask(taskId)
    if (!fromAgentId?.trim()) {
      throw new QAWorkflowError('From agent ID is required')
    }

    return this.messageService.create({
      officeId: task.officeId,
      taskId: task.id,
      fromAgentId,
      type: 'FEEDBACK',
      content: content.trim(),
      metadata: { source: 'qa' },
    })
  }

  private async requireTask(taskId: string): Promise<OfficeTask> {
    const task = await this.taskService.getById(taskId)
    if (!task) {
      throw new QAWorkflowError('Task not found', 404)
    }
    return task
  }

  private async setStatus(task: OfficeTask, status: TaskStatus): Promise<OfficeTask> {
    const updated = await this.taskService.setStatus(task.id, status)
    if (!updated) {
      throw new QAWorkflowError(`Failed to set task status to ${status}`, 500)
    }
    return updated
  }

  private resolveApprovedStatus(workflowType: string | undefined | null): TaskStatus {
    return QA_TARGET_TESTING_WORKFLOWS.includes(workflowType ?? '') ? 'testing' : 'completed'
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
