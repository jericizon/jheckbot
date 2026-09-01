import type { OfficeTask, OfficeTaskDependency, TaskPriority, TaskStatus } from '@jheckbot/shared'
import {
  isValidTaskPriority,
  isValidTaskStatus,
  isValidTaskStatusTransition,
  isValidUuid,
} from '@jheckbot/shared'
import { OfficeTaskRepository } from '../repositories/OfficeTaskRepository.js'
import { OfficeEventService } from './OfficeEventService.js'

export interface CreateOfficeTaskInput {
  officeId: string
  projectId?: string
  parentTaskId?: string
  title: string
  description?: string
  acceptanceCriteria?: string
  status?: TaskStatus
  priority?: TaskPriority
  assignedAgentId?: string
  createdBy?: string
  workflowType?: string
  metadata?: Record<string, unknown>
}

export interface UpdateOfficeTaskInput {
  title?: string
  description?: string | null
  acceptanceCriteria?: string | null
  priority?: TaskPriority
  assignedAgentId?: string | null
  projectId?: string | null
  parentTaskId?: string | null
  createdBy?: string | null
  workflowType?: string | null
  metadata?: Record<string, unknown> | null
}

export class OfficeTaskService {
  constructor(
    private repo: OfficeTaskRepository,
    private eventService?: OfficeEventService,
  ) {}

  async listByOffice(officeId: string): Promise<OfficeTask[]> {
    if (!officeId?.trim()) {
      throw new OfficeTaskValidationError('Office ID is required')
    }
    return this.repo.listByOffice(officeId)
  }

  async getById(id: string): Promise<OfficeTask | null> {
    if (!id?.trim()) {
      throw new OfficeTaskValidationError('Task ID is required')
    }
    return this.repo.getById(id)
  }

  async create(input: CreateOfficeTaskInput): Promise<OfficeTask> {
    if (!input.officeId?.trim()) {
      throw new OfficeTaskValidationError('Office ID is required')
    }
    if (!input.title?.trim()) {
      throw new OfficeTaskValidationError('Title is required')
    }

    const status = input.status ?? 'backlog'
    const priority = input.priority ?? 'medium'

    if (!isValidTaskStatus(status)) {
      throw new OfficeTaskValidationError(`Invalid task status: ${status}`)
    }
    if (!isValidTaskPriority(priority)) {
      throw new OfficeTaskValidationError(`Invalid task priority: ${priority}`)
    }

    const task = await this.repo.create({
      ...input,
      title: input.title.trim(),
      status,
      priority,
    })

    if (this.eventService) {
      await this.eventService.create({
        officeId: task.officeId,
        eventType: 'TASK_CREATED',
        content: `Task created: ${task.title}`,
        metadata: { ...input.metadata, taskId: task.id, status: task.status },
      })
    }

    return task
  }

  async update(id: string, input: UpdateOfficeTaskInput): Promise<OfficeTask | null> {
    if (!id?.trim()) {
      throw new OfficeTaskValidationError('Task ID is required')
    }

    const existing = await this.repo.getById(id)
    if (!existing) return null

    if (input.title !== undefined) {
      const trimmed = input.title.trim()
      if (!trimmed) {
        throw new OfficeTaskValidationError('Title cannot be empty')
      }
    }
    if (input.priority !== undefined && !isValidTaskPriority(input.priority)) {
      throw new OfficeTaskValidationError(`Invalid task priority: ${input.priority}`)
    }

    const task = await this.repo.update(id, {
      ...input,
      title: input.title?.trim(),
    })

    if (task && this.eventService) {
      await this.eventService.create({
        officeId: task.officeId,
        eventType: 'TASK_UPDATED',
        content: `Task updated: ${task.title}`,
        metadata: { taskId: task.id, status: task.status },
      })
    }

    return task
  }

  async delete(id: string): Promise<boolean> {
    if (!id?.trim()) {
      throw new OfficeTaskValidationError('Task ID is required')
    }

    const existing = await this.repo.getById(id)
    if (!existing) return false

    const deleted = await this.repo.delete(id)

    if (deleted && this.eventService) {
      await this.eventService.create({
        officeId: existing.officeId,
        eventType: 'TASK_UPDATED',
        content: `Task deleted: ${existing.title}`,
        metadata: { taskId: existing.id, deleted: true },
      })
    }

    return deleted
  }

  async setStatus(id: string, status: TaskStatus): Promise<OfficeTask | null> {
    if (!id?.trim()) {
      throw new OfficeTaskValidationError('Task ID is required')
    }
    if (!isValidTaskStatus(status)) {
      throw new OfficeTaskValidationError(`Invalid task status: ${status}`)
    }

    const existing = await this.repo.getById(id)
    if (!existing) return null

    if (!isValidTaskStatusTransition(existing.status, status)) {
      throw new OfficeTaskValidationError(
        `Invalid status transition from ${existing.status} to ${status}`,
      )
    }

    if (status !== existing.status && (status === 'ready' || status === 'working')) {
      const dependencies = await this.repo.listDependencies(id)
      const uncompleted = dependencies.filter((dep) => dep.status !== 'completed')
      if (uncompleted.length > 0) {
        throw new OfficeTaskValidationError(
          `Cannot set status to ${status} with uncompleted dependencies`,
        )
      }
    }

    const task = await this.repo.setStatus(id, status)

    if (task && this.eventService) {
      await this.eventService.create({
        officeId: task.officeId,
        eventType: 'TASK_UPDATED',
        content: `Task status changed to ${task.status}: ${task.title}`,
        metadata: { taskId: task.id, status: task.status, previousStatus: existing.status },
      })
    }

    return task
  }

  async listDependencies(id: string): Promise<OfficeTask[]> {
    if (!id?.trim()) {
      throw new OfficeTaskValidationError('Task ID is required')
    }
    return this.repo.listDependencies(id)
  }

  async addDependency(
    taskId: string,
    dependsOnTaskId: string,
  ): Promise<OfficeTaskDependency | null> {
    if (!taskId?.trim()) {
      throw new OfficeTaskValidationError('Task ID is required')
    }
    if (!dependsOnTaskId?.trim()) {
      throw new OfficeTaskValidationError('Dependency task ID is required')
    }

    const task = await this.repo.getById(taskId)
    if (!task) {
      throw new OfficeTaskValidationError('Task not found')
    }
    const dependsOn = await this.repo.getById(dependsOnTaskId)
    if (!dependsOn) {
      throw new OfficeTaskValidationError('Dependency task not found')
    }

    if (taskId === dependsOnTaskId) {
      throw new OfficeTaskValidationError('A task cannot depend on itself')
    }

    const direct = await this.repo.listDependencies(taskId)
    if (direct.some((dep) => dep.id === dependsOnTaskId)) {
      throw new OfficeTaskValidationError('Dependency already exists')
    }

    if (await this.wouldCreateCycle(taskId, dependsOnTaskId)) {
      throw new OfficeTaskValidationError('Circular dependency detected')
    }

    return this.repo.addDependency(taskId, dependsOnTaskId)
  }

  async removeDependency(taskId: string, dependsOnTaskId: string): Promise<boolean> {
    if (!taskId?.trim()) {
      throw new OfficeTaskValidationError('Task ID is required')
    }
    if (!dependsOnTaskId?.trim()) {
      throw new OfficeTaskValidationError('Dependency task ID is required')
    }
    return this.repo.removeDependency(taskId, dependsOnTaskId)
  }

  async getDependents(id: string): Promise<OfficeTask[]> {
    if (!id?.trim()) {
      throw new OfficeTaskValidationError('Task ID is required')
    }
    return this.repo.getDependents(id)
  }

  async findActiveCeoExecution(officeId: string): Promise<OfficeTask | null> {
    if (!officeId?.trim()) {
      throw new OfficeTaskValidationError('Office ID is required')
    }
    if (!isValidUuid(officeId)) {
      throw new OfficeTaskValidationError('Office ID must be a valid UUID')
    }
    return this.repo.findActiveCeoExecution(officeId)
  }

  async linkExecutionConversation(
    taskId: string,
    conversationId: string,
  ): Promise<OfficeTask | null> {
    if (!taskId?.trim()) {
      throw new OfficeTaskValidationError('Task ID is required')
    }
    if (!conversationId?.trim()) {
      throw new OfficeTaskValidationError('Conversation ID is required')
    }
    if (!isValidUuid(taskId)) {
      throw new OfficeTaskValidationError('Task ID must be a valid UUID')
    }
    if (!isValidUuid(conversationId)) {
      throw new OfficeTaskValidationError('Conversation ID must be a valid UUID')
    }

    const existing = await this.repo.getById(taskId)
    if (!existing) return null

    return this.repo.linkExecutionConversation(taskId, conversationId)
  }

  async failExecution(id: string, error?: string): Promise<OfficeTask | null> {
    if (!id?.trim()) {
      throw new OfficeTaskValidationError('Task ID is required')
    }
    if (!isValidUuid(id)) {
      throw new OfficeTaskValidationError('Task ID must be a valid UUID')
    }

    const existing = await this.repo.getById(id)
    if (!existing) return null
    if (existing.status === 'failed' || existing.status === 'completed' || existing.status === 'cancelled') {
      return existing
    }

    const failed = await this.repo.setStatus(id, 'failed')
    if (!failed) return null

    if (this.eventService) {
      await this.eventService.create({
        officeId: failed.officeId,
        eventType: 'TASK_UPDATED',
        content: `Task failed: ${failed.title}`,
        metadata: {
          taskId: failed.id,
          status: failed.status,
          previousStatus: existing.status,
        },
      })
      await this.eventService.create({
        officeId: failed.officeId,
        eventType: 'TASK_FAILED',
        content: `Task failed: ${failed.title}`,
        metadata: {
          taskId: failed.id,
          status: failed.status,
          error: error ?? 'failed',
        },
      })
    }

    return failed
  }

  async completeExecution(id: string): Promise<OfficeTask | null> {
    if (!id?.trim()) {
      throw new OfficeTaskValidationError('Task ID is required')
    }
    if (!isValidUuid(id)) {
      throw new OfficeTaskValidationError('Task ID must be a valid UUID')
    }

    const task = await this.repo.getById(id)
    if (!task) return null
    if (!task.executionConversationId || task.status !== 'working') {
      return null
    }

    const completed = await this.repo.update(id, {
      status: 'completed',
      completedAt: new Date().toISOString(),
    })
    if (!completed) return null

    if (this.eventService) {
      await this.eventService.create({
        officeId: completed.officeId,
        eventType: 'TASK_UPDATED',
        content: `Task completed: ${completed.title}`,
        metadata: {
          taskId: completed.id,
          conversationId: completed.executionConversationId,
          status: completed.status,
        },
      })
      await this.eventService.create({
        officeId: completed.officeId,
        eventType: 'TASK_COMPLETED',
        content: `Task completed: ${completed.title}`,
        metadata: {
          taskId: completed.id,
          conversationId: completed.executionConversationId,
          status: completed.status,
        },
      })
    }

    return completed
  }

  private async wouldCreateCycle(
    taskId: string,
    dependsOnTaskId: string,
    visited = new Set<string>(),
  ): Promise<boolean> {
    if (taskId === dependsOnTaskId) return true
    if (visited.has(dependsOnTaskId)) return false
    visited.add(dependsOnTaskId)

    const dependencies = await this.repo.listDependencies(dependsOnTaskId)
    for (const dep of dependencies) {
      if (dep.id === taskId) return true
      if (await this.wouldCreateCycle(taskId, dep.id, visited)) return true
    }
    return false
  }
}

export class OfficeTaskValidationError extends Error {
  statusCode: number
  constructor(message: string, statusCode = 400) {
    super(message)
    this.name = 'OfficeTaskValidationError'
    this.statusCode = statusCode
  }
}
