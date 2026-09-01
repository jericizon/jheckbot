import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { OfficeEvent, OfficeTask, OfficeTaskDependency } from '@jheckbot/shared'
import type { CreateOfficeTaskInput } from '../src/services/OfficeTaskService.js'
import type { OfficeEventService } from '../src/services/OfficeEventService.js'
import type { OfficeAgentService } from '../src/services/OfficeAgentService.js'
import type { OfficeTaskService } from '../src/services/OfficeTaskService.js'
import { CEOPlanner, CEOPlanningError } from '../src/services/orchestration/CEOPlanner.js'

function makeTask(overrides: Partial<OfficeTask> = {}): OfficeTask {
  const now = new Date().toISOString()
  return {
    id: 'task-1',
    officeId: 'office-1',
    title: 'Task',
    status: 'backlog',
    priority: 'medium',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

function makeDependency(overrides: Partial<OfficeTaskDependency> = {}): OfficeTaskDependency {
  return {
    taskId: 'task-1',
    dependsOnTaskId: 'task-2',
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

function makeEvent(): OfficeEvent {
  const now = new Date().toISOString()
  return {
    id: 'event-1',
    officeId: 'office-1',
    eventType: 'CEO_PLANNING',
    createdAt: now,
  }
}

describe('CEOPlanner', () => {
  let taskService: OfficeTaskService
  let eventService: OfficeEventService
  let agentService: OfficeAgentService
  let planner: CEOPlanner
  let taskIdCounter: number

  beforeEach(() => {
    taskIdCounter = 0

    taskService = {
      create: vi.fn().mockImplementation((input: CreateOfficeTaskInput) => {
        taskIdCounter += 1
        return Promise.resolve(
          makeTask({
            id: `task-${taskIdCounter}`,
            title: input.title,
            description: input.description,
            priority: input.priority ?? 'medium',
            workflowType: input.workflowType,
            projectId: input.projectId,
            createdBy: input.createdBy,
            metadata: input.metadata,
          }),
        )
      }),
      addDependency: vi.fn().mockImplementation((taskId: string, dependsOnTaskId: string) => {
        return Promise.resolve(makeDependency({ taskId, dependsOnTaskId }))
      }),
    } as unknown as OfficeTaskService

    eventService = {
      create: vi.fn().mockResolvedValue(makeEvent()),
    } as unknown as OfficeEventService

    agentService = {} as unknown as OfficeAgentService

    planner = new CEOPlanner(taskService, eventService, agentService)
  })

  it('rejects an empty request', async () => {
    await expect(planner.plan('', 'office-1')).rejects.toThrow(CEOPlanningError)
  })

  it('rejects a whitespace-only request', async () => {
    await expect(planner.plan('   ', 'office-1')).rejects.toThrow(CEOPlanningError)
  })

  it('rejects a missing officeId', async () => {
    await expect(planner.plan('do something', '')).rejects.toThrow(CEOPlanningError)
  })

  it('creates a simple plan for typo fixes', async () => {
    const plan = await planner.plan('fix typo in README', 'office-1')

    expect(plan.complexity).toBe('simple')
    expect(plan.request).toBe('fix typo in README')
    expect(plan.tasks).toHaveLength(1)
    expect(plan.tasks[0].title).toBe('Implement fix typo in README')
    expect(plan.tasks[0].priority).toBe('low')
    expect(plan.tasks[0].workflowType).toBe('simple')
    expect(plan.dependencies).toHaveLength(0)
    expect(taskService.create).toHaveBeenCalledTimes(1)
    expect(taskService.addDependency).not.toHaveBeenCalled()
  })

  it('creates a medium plan for feature and endpoint requests', async () => {
    const plan = await planner.plan('add endpoint for users', 'office-1')

    expect(plan.complexity).toBe('medium')
    expect(plan.tasks).toHaveLength(3)
    expect(plan.tasks[0].title).toBe('Implement add endpoint for users')
    expect(plan.tasks[1].title).toBe('QA: add endpoint for users')
    expect(plan.tasks[2].title).toBe('Review: add endpoint for users')
    expect(plan.tasks.every((task) => task.priority === 'medium' && task.workflowType === 'medium')).toBe(true)
    expect(plan.dependencies).toHaveLength(2)
    expect(taskService.addDependency).toHaveBeenCalledWith('task-2', 'task-1')
    expect(taskService.addDependency).toHaveBeenCalledWith('task-3', 'task-2')
  })

  it('creates a complex plan with frontend when UI words are present', async () => {
    const plan = await planner.plan('add auth login page', 'office-1')

    expect(plan.complexity).toBe('complex')
    expect(plan.tasks).toHaveLength(5)
    expect(plan.tasks[0].title).toBe('Research/Design: add auth login page')
    expect(plan.tasks[1].title).toBe('Implement Backend: add auth login page')
    expect(plan.tasks[2].title).toBe('Implement Frontend: add auth login page')
    expect(plan.tasks[3].title).toBe('QA: add auth login page')
    expect(plan.tasks[4].title).toBe('Review: add auth login page')
    expect(plan.tasks.every((task) => task.priority === 'high' && task.workflowType === 'complex')).toBe(true)
    expect(plan.dependencies).toHaveLength(5)
    expect(taskService.addDependency).toHaveBeenCalledWith('task-2', 'task-1')
    expect(taskService.addDependency).toHaveBeenCalledWith('task-3', 'task-1')
    expect(taskService.addDependency).toHaveBeenCalledWith('task-4', 'task-2')
    expect(taskService.addDependency).toHaveBeenCalledWith('task-4', 'task-3')
    expect(taskService.addDependency).toHaveBeenCalledWith('task-5', 'task-4')
  })

  it('creates a complex plan without frontend when no UI words are present', async () => {
    const plan = await planner.plan('add payment integration', 'office-1')

    expect(plan.complexity).toBe('complex')
    expect(plan.tasks).toHaveLength(4)
    expect(plan.tasks[0].title).toBe('Research/Design: add payment integration')
    expect(plan.tasks[1].title).toBe('Implement Backend: add payment integration')
    expect(plan.tasks[2].title).toBe('QA: add payment integration')
    expect(plan.tasks[3].title).toBe('Review: add payment integration')
    expect(plan.dependencies).toHaveLength(3)
    expect(taskService.addDependency).toHaveBeenCalledWith('task-2', 'task-1')
    expect(taskService.addDependency).toHaveBeenCalledWith('task-3', 'task-2')
    expect(taskService.addDependency).toHaveBeenCalledWith('task-4', 'task-3')
  })

  it('falls back to a medium plan for unrecognized requests', async () => {
    const plan = await planner.plan('do something useful', 'office-1')

    expect(plan.complexity).toBe('medium')
    expect(plan.tasks).toHaveLength(3)
    expect(plan.tasks[0].title).toBe('Implement do something useful')
    expect(plan.dependencies).toHaveLength(2)
  })

  it('gives complex precedence over medium and simple keywords', async () => {
    const plan = await planner.plan('fix typo in auth flow', 'office-1')

    expect(plan.complexity).toBe('complex')
    expect(plan.tasks).toHaveLength(4)
  })

  it('is case-insensitive', async () => {
    const plan = await planner.plan('Add UI Feature', 'office-1')

    expect(plan.complexity).toBe('medium')
    expect(plan.tasks).toHaveLength(3)
  })

  it('passes projectId through to tasks and events', async () => {
    await planner.plan('add a feature', 'office-1', 'project-1')

    expect(taskService.create).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: 'project-1' }),
    )

    const startCall = vi.mocked(eventService.create).mock.calls.find(
      (call) => call[0].eventType === 'CEO_PLANNING' && call[0].content === 'Planning started',
    )
    expect(startCall?.[0].metadata).toMatchObject({ projectId: 'project-1' })
  })

  it('emits CEO_PLANNING before and after, and passes request metadata through task creation', async () => {
    await planner.plan('add endpoint', 'office-1')

    const calls = vi.mocked(eventService.create).mock.calls
    expect(calls[0][0]).toMatchObject({
      eventType: 'CEO_PLANNING',
      content: 'Planning started',
    })

    const taskCreatedCalls = calls.filter((call) => call[0].eventType === 'TASK_CREATED')
    expect(taskCreatedCalls).toHaveLength(0)

    expect(calls[calls.length - 1][0]).toMatchObject({
      eventType: 'CEO_PLANNING',
      content: 'Planning completed',
    })

    expect(vi.mocked(taskService.create).mock.calls[0][0]).toMatchObject({
      metadata: { request: 'add endpoint', complexity: 'medium' },
    })
  })

  it('returns the created dependencies in the plan', async () => {
    const plan = await planner.plan('add endpoint', 'office-1')

    expect(plan.dependencies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ taskId: 'task-2', dependsOnTaskId: 'task-1' }),
        expect.objectContaining({ taskId: 'task-3', dependsOnTaskId: 'task-2' }),
      ]),
    )
  })
})

describe('CEOPlanner.planSingleTask', () => {
  let taskService: OfficeTaskService
  let eventService: OfficeEventService
  let agentService: OfficeAgentService
  let planner: CEOPlanner

  beforeEach(() => {
    taskService = {
      create: vi.fn().mockImplementation((input: CreateOfficeTaskInput) => {
        return Promise.resolve(
          makeTask({
            id: 'task-1',
            title: input.title,
            description: input.description,
            priority: input.priority ?? 'medium',
            workflowType: input.workflowType,
            projectId: input.projectId,
            createdBy: input.createdBy,
            metadata: input.metadata,
          }),
        )
      }),
    } as unknown as OfficeTaskService

    eventService = {
      create: vi.fn().mockResolvedValue(makeEvent()),
    } as unknown as OfficeEventService

    agentService = {} as unknown as OfficeAgentService

    planner = new CEOPlanner(taskService, eventService, agentService)
  })

  it('creates exactly one implementation task', async () => {
    const plan = await planner.planSingleTask('add a health endpoint', 'office-1', 'project-1')

    expect(plan.complexity).toBe('simple')
    expect(plan.request).toBe('add a health endpoint')
    expect(plan.tasks).toHaveLength(1)
    expect(plan.tasks[0].title).toBe('Implement add a health endpoint')
    expect(plan.tasks[0].description).toBe('Implement the requested change: add a health endpoint')
    expect(plan.tasks[0].priority).toBe('low')
    expect(plan.tasks[0].workflowType).toBe('simple')
    expect(plan.tasks[0].createdBy).toBe('ceo')
    expect(plan.dependencies).toHaveLength(0)
    expect(taskService.create).toHaveBeenCalledTimes(1)
  })

  it('always returns one task even for complex-looking requests', async () => {
    const plan = await planner.planSingleTask('add auth payment component', 'office-1')

    expect(plan.tasks).toHaveLength(1)
    expect(plan.tasks[0].workflowType).toBe('simple')
    expect(plan.tasks[0].createdBy).toBe('ceo')
    expect(plan.tasks[0].metadata).toMatchObject({
      request: 'add auth payment component',
      complexity: 'simple',
      executionMode: 'single',
    })
  })

  it('rejects an empty request', async () => {
    await expect(planner.planSingleTask('', 'office-1')).rejects.toThrow(CEOPlanningError)
  })

  it('rejects an empty officeId', async () => {
    await expect(planner.planSingleTask('add a feature', '')).rejects.toThrow(CEOPlanningError)
  })

  it('emits CEO_PLANNING start and complete with single execution mode', async () => {
    await planner.planSingleTask('add a feature', 'office-1', 'project-1')

    const calls = vi.mocked(eventService.create).mock.calls
    expect(calls[0][0]).toMatchObject({
      eventType: 'CEO_PLANNING',
      content: 'Planning started',
      metadata: { phase: 'start', executionMode: 'single' },
    })
    expect(calls[calls.length - 1][0]).toMatchObject({
      eventType: 'CEO_PLANNING',
      content: 'Planning completed',
      metadata: { phase: 'complete', complexity: 'simple', taskCount: 1, executionMode: 'single' },
    })
  })
})
