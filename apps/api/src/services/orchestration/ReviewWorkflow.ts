import type { EventType, OfficeTask, TaskStatus } from '@jheckbot/shared'
import type { OfficeAgentMessageService } from '../OfficeAgentMessageService.js'
import type { OfficeEventService } from '../OfficeEventService.js'
import type { OfficeTaskService } from '../OfficeTaskService.js'

export class ReviewWorkflowError extends Error {
  statusCode: number
  constructor(message: string, statusCode = 400) {
    super(message)
    this.name = 'ReviewWorkflowError'
    this.statusCode = statusCode
  }
}

export class ReviewWorkflow {
  constructor(
    private taskService: Pick<OfficeTaskService, 'getById' | 'setStatus'>,
    private eventService: Pick<OfficeEventService, 'create'>,
    private messageService: Pick<OfficeAgentMessageService, 'create'>,
  ) {}

  async submitForReview(taskId: string): Promise<OfficeTask> {
    if (!taskId?.trim()) {
      throw new ReviewWorkflowError('Task ID is required')
    }

    const task = await this.requireTask(taskId)
    if (task.status !== 'working') {
      throw new ReviewWorkflowError(`Task must be in 'working' status, got: ${task.status}`, 409)
    }

    const updated = await this.setStatus(task, 'review')
    await this.emitEvent(
      task.officeId,
      'TASK_REVIEW_STARTED',
      `Task submitted for review: ${task.title}`,
      {
        taskId: task.id,
        previousStatus: 'working',
      },
    )

    return updated
  }

  async approveReview(taskId: string): Promise<OfficeTask> {
    if (!taskId?.trim()) {
      throw new ReviewWorkflowError('Task ID is required')
    }

    const task = await this.requireTask(taskId)
    if (task.status !== 'review') {
      throw new ReviewWorkflowError(`Task must be in 'review' status, got: ${task.status}`, 409)
    }

    const targetStatus = this.resolveApprovedStatus(task.workflowType)
    const updated = await this.setStatus(task, targetStatus)
    await this.emitEvent(
      task.officeId,
      'TASK_REVIEW_APPROVED',
      `Review approved: ${task.title}`,
      {
        taskId: task.id,
        previousStatus: 'review',
        targetStatus,
        workflowType: task.workflowType ?? null,
      },
    )

    return updated
  }

  async rejectReview(taskId: string, reason?: string): Promise<OfficeTask> {
    if (!taskId?.trim()) {
      throw new ReviewWorkflowError('Task ID is required')
    }

    const task = await this.requireTask(taskId)
    if (task.status !== 'review') {
      throw new ReviewWorkflowError(`Task must be in 'review' status, got: ${task.status}`, 409)
    }

    const updated = await this.setStatus(task, 'working')
    await this.emitEvent(
      task.officeId,
      'TASK_REVIEW_REJECTED',
      `Review rejected: ${task.title}`,
      {
        taskId: task.id,
        reason: reason ?? null,
      },
    )

    return updated
  }

  async sendReviewFeedback(
    taskId: string,
    content: string,
    fromAgentId?: string,
  ): Promise<ReturnType<OfficeAgentMessageService['create']>> {
    if (!taskId?.trim()) {
      throw new ReviewWorkflowError('Task ID is required')
    }
    if (!content?.trim()) {
      throw new ReviewWorkflowError('Feedback content is required')
    }

    const task = await this.requireTask(taskId)
    if (!fromAgentId?.trim()) {
      throw new ReviewWorkflowError('From agent ID is required')
    }

    return this.messageService.create({
      officeId: task.officeId,
      taskId: task.id,
      fromAgentId,
      type: 'FEEDBACK',
      content: content.trim(),
      metadata: { source: 'review' },
    })
  }

  private async requireTask(taskId: string): Promise<OfficeTask> {
    const task = await this.taskService.getById(taskId)
    if (!task) {
      throw new ReviewWorkflowError('Task not found', 404)
    }
    return task
  }

  private async setStatus(task: OfficeTask, status: TaskStatus): Promise<OfficeTask> {
    const updated = await this.taskService.setStatus(task.id, status)
    if (!updated) {
      throw new ReviewWorkflowError(`Failed to set task status to ${status}`, 500)
    }
    return updated
  }

  private resolveApprovedStatus(workflowType: string | undefined | null): TaskStatus {
    return workflowType === 'simple' ? 'completed' : 'qa'
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
