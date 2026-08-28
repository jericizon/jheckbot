import type { OfficeTask, OfficeWorkflowRun, OfficeWorkflowStep, TaskStatus } from '@jheckbot/shared'
import type { WorkflowRunRepository } from '../../repositories/WorkflowRunRepository.js'
import type { OfficeEventService } from '../OfficeEventService.js'
import type { OfficeTaskService } from '../OfficeTaskService.js'
import type { TaskDispatcher } from './TaskDispatcher.js'

export interface StartWorkflowOptions {
  stepType?: string
  metadata?: Record<string, unknown>
}

export interface StartWorkflowResult {
  run: OfficeWorkflowRun
  steps: OfficeWorkflowStep[]
}

export class WorkflowEngineError extends Error {
  statusCode: number
  constructor(message: string, statusCode = 400) {
    super(message)
    this.name = 'WorkflowEngineError'
    this.statusCode = statusCode
  }
}

const TERMINAL_RUN_STATUSES: readonly string[] = ['completed', 'failed', 'cancelled']

const DISPATCHABLE_TASK_STATUSES: readonly TaskStatus[] = [
  'backlog',
  'planning',
  'ready',
  'assigned',
]

/**
 * Minimal state-driven workflow engine.
 *
 * Tracks a workflow run through ordered steps, dispatches ready steps to the
 * task dispatcher, and reacts to task status changes to advance the run.
 */
export class WorkflowEngine {
  constructor(
    private runRepo: WorkflowRunRepository,
    private taskService: Pick<OfficeTaskService, 'getById' | 'listDependencies' | 'setStatus'>,
    private eventService: Pick<OfficeEventService, 'create'>,
    private dispatcher: Pick<TaskDispatcher, 'dispatch'>,
  ) {}

  async startWorkflow(
    officeId: string,
    rootTaskId: string,
    planTasks: OfficeTask[],
    options: StartWorkflowOptions = {},
  ): Promise<StartWorkflowResult> {
    if (!officeId?.trim()) {
      throw new WorkflowEngineError('Office ID is required')
    }
    if (!rootTaskId?.trim()) {
      throw new WorkflowEngineError('Root task ID is required')
    }
    if (!planTasks.length) {
      throw new WorkflowEngineError('Plan tasks are required')
    }

    const run = await this.runRepo.create({
      officeId,
      rootTaskId,
      status: 'running',
      startedAt: new Date().toISOString(),
      metadata: options.metadata ?? null,
    })

    const steps: OfficeWorkflowStep[] = []
    for (let i = 0; i < planTasks.length; i++) {
      const step = await this.runRepo.createStep({
        workflowRunId: run.id,
        taskId: planTasks[i].id,
        stepType: options.stepType ?? 'task',
        sequence: i + 1,
        status: 'pending',
      })
      steps.push(step)
    }

    await this.eventService.create({
      officeId,
      eventType: 'WORKFLOW_STARTED',
      content: 'Workflow started',
      metadata: { workflowRunId: run.id, rootTaskId, taskCount: planTasks.length },
    })

    await this.dispatchNextReadySteps(run)

    const finalRun = await this.runRepo.getById(run.id)
    const finalSteps = await this.runRepo.listSteps(run.id)

    return { run: finalRun ?? run, steps: finalSteps }
  }

  async onTaskStatusChanged(taskId: string, newStatus: TaskStatus): Promise<void> {
    if (!taskId?.trim()) {
      throw new WorkflowEngineError('Task ID is required')
    }

    const step = await this.runRepo.getStepByTaskId(taskId)
    if (!step) return

    const run = await this.runRepo.getById(step.workflowRunId)
    if (!run || TERMINAL_RUN_STATUSES.includes(run.status)) return

    if (newStatus === 'working') {
      await this.runRepo.updateStepStatus(step.id, 'working')
    } else if (newStatus === 'completed') {
      await this.runRepo.updateStepStatus(step.id, 'completed')
      await this.dispatchNextReadySteps(run)
    } else if (newStatus === 'failed') {
      await this.runRepo.updateStepStatus(step.id, 'failed')
      await this.runRepo.updateStatus(run.id, 'failed')
      await this.eventService.create({
        officeId: run.officeId,
        eventType: 'WORKFLOW_FAILED',
        content: `Workflow failed at step ${step.sequence}`,
        metadata: { workflowRunId: run.id, taskId, stepId: step.id },
      })
    } else if (newStatus === 'blocked') {
      await this.runRepo.updateStepStatus(step.id, 'blocked')
      await this.dispatchNextReadySteps(run)
    }
  }

  private async dispatchNextReadySteps(run: OfficeWorkflowRun): Promise<void> {
    const pendingSteps = (await this.runRepo.listSteps(run.id)).filter(
      (s) => s.status === 'pending',
    )

    for (const step of pendingSteps) {
      await this.tryDispatchStep(step)
    }

    await this.checkAllCompleted(run)
  }

  private async tryDispatchStep(step: OfficeWorkflowStep): Promise<boolean> {
    const task = step.taskId ? await this.taskService.getById(step.taskId) : null
    if (!task || !DISPATCHABLE_TASK_STATUSES.includes(task.status)) {
      return false
    }

    const dependencies = await this.taskService.listDependencies(task.id)
    if (dependencies.some((dep) => dep.status !== 'completed')) {
      return false
    }

    if (task.status !== 'ready' && task.status !== 'assigned') {
      try {
        await this.taskService.setStatus(task.id, 'ready')
      } catch {
        return false
      }
    }

    try {
      await this.dispatcher.dispatch(task.id)
      await this.runRepo.updateStepStatus(step.id, 'working')
      return true
    } catch {
      return false
    }
  }

  private async checkAllCompleted(run: OfficeWorkflowRun): Promise<void> {
    if (run.status !== 'running') return

    const steps = await this.runRepo.listSteps(run.id)
    if (steps.length > 0 && steps.every((s) => s.status === 'completed')) {
      const completed = await this.runRepo.updateStatus(run.id, 'completed')
      if (completed) {
        await this.eventService.create({
          officeId: run.officeId,
          eventType: 'WORKFLOW_COMPLETED',
          content: 'Workflow completed',
          metadata: { workflowRunId: run.id },
        })
      }
    }
  }
}
