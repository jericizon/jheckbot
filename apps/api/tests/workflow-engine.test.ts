import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { OfficeAgent, OfficeEvent, OfficeTask, OfficeWorkflowRun, OfficeWorkflowStep } from '@jheckbot/shared'
import type { OfficeEventService } from '../src/services/OfficeEventService.js'
import type { OfficeTaskService } from '../src/services/OfficeTaskService.js'
import type { TaskDispatcher } from '../src/services/orchestration/TaskDispatcher.js'
import { WorkflowEngine, WorkflowEngineError } from '../src/services/orchestration/WorkflowEngine.js'
import type { WorkflowRunRepository } from '../src/repositories/WorkflowRunRepository.js'

function makeTask(overrides: Partial<OfficeTask> = {}): OfficeTask {
  const now = new Date().toISOString()
  return {
    id: 'task-1',
    officeId: 'office-1',
    title: 'Implement feature',
    status: 'backlog',
    priority: 'medium',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

function makeRun(overrides: Partial<OfficeWorkflowRun> = {}): OfficeWorkflowRun {
  const now = new Date().toISOString()
  return {
    id: 'run-1',
    officeId: 'office-1',
    rootTaskId: 'task-0',
    status: 'running',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

function makeStep(overrides: Partial<OfficeWorkflowStep> = {}): OfficeWorkflowStep {
  const now = new Date().toISOString()
  return {
    id: 'step-1',
    workflowRunId: 'run-1',
    taskId: 'task-1',
    stepType: 'task',
    status: 'pending',
    sequence: 1,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

function makeAgent(overrides: Partial<OfficeAgent> = {}): OfficeAgent {
  const now = new Date().toISOString()
  return {
    id: 'agent-1',
    officeId: 'office-1',
    name: 'Alfred',
    role: 'Senior Backend Developer',
    status: 'idle',
    enabled: true,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

function makeEvent(eventType: string): OfficeEvent {
  return {
    id: 'event-1',
    officeId: 'office-1',
    eventType: eventType as OfficeEvent['eventType'],
    createdAt: new Date().toISOString(),
  }
}

describe('WorkflowEngine', () => {
  let run: OfficeWorkflowRun
  let steps: OfficeWorkflowStep[]
  let tasks: OfficeTask[]
  let depsMap: Map<string, string[]>
  let runRepo: WorkflowRunRepository
  let taskService: Pick<OfficeTaskService, 'getById' | 'listDependencies' | 'setStatus'>
  let eventService: Pick<OfficeEventService, 'create'>
  let dispatcher: Pick<TaskDispatcher, 'dispatch'>
  let engine: WorkflowEngine
  let runIdCounter: number
  let stepIdCounter: number

  beforeEach(() => {
    vi.clearAllMocks()
    runIdCounter = 0
    stepIdCounter = 0
    run = makeRun()
    steps = []
    tasks = []
    depsMap = new Map()

    runRepo = {
      create: vi.fn().mockImplementation((data) => {
        runIdCounter++
        run = makeRun({ id: `run-${runIdCounter}`, ...data })
        return Promise.resolve(run)
      }),
      getById: vi.fn().mockImplementation(() => Promise.resolve(run)),
      listByOffice: vi.fn(),
      listByTask: vi.fn(),
      updateStatus: vi.fn().mockImplementation((_id, status) => {
        run = { ...run, status }
        return Promise.resolve(run)
      }),
      delete: vi.fn(),
      createStep: vi.fn().mockImplementation((data) => {
        stepIdCounter++
        const step = makeStep({ id: `step-${stepIdCounter}`, ...data })
        steps.push(step)
        return Promise.resolve(step)
      }),
      getStepById: vi.fn(),
      getStepByTaskId: vi.fn().mockImplementation((taskId) => {
        return Promise.resolve(steps.find((s) => s.taskId === taskId) ?? null)
      }),
      listSteps: vi.fn().mockImplementation(() => Promise.resolve([...steps])),
      updateStepStatus: vi.fn().mockImplementation((id, status) => {
        const index = steps.findIndex((s) => s.id === id)
        if (index >= 0) {
          steps[index] = { ...steps[index], status }
        }
        return Promise.resolve(steps[index] ?? null)
      }),
    } as unknown as WorkflowRunRepository

    taskService = {
      getById: vi.fn().mockImplementation((id) => {
        return Promise.resolve(tasks.find((t) => t.id === id) ?? null)
      }),
      listDependencies: vi.fn().mockImplementation((id) => {
        const depIds = depsMap.get(id) ?? []
        return Promise.resolve(
          depIds
            .map((depId) => tasks.find((t) => t.id === depId))
            .filter((t): t is OfficeTask => t !== undefined),
        )
      }),
      setStatus: vi.fn().mockImplementation((id, status) => {
        const index = tasks.findIndex((t) => t.id === id)
        if (index >= 0) {
          tasks[index] = { ...tasks[index], status }
        }
        return Promise.resolve(tasks[index] ?? null)
      }),
    } as unknown as Pick<OfficeTaskService, 'getById' | 'listDependencies' | 'setStatus'>

    eventService = {
      create: vi.fn().mockImplementation((input) => {
        return Promise.resolve(makeEvent(input.eventType))
      }),
    } as unknown as Pick<OfficeEventService, 'create'>

    dispatcher = {
      dispatch: vi.fn().mockImplementation((taskId) => {
        const index = tasks.findIndex((t) => t.id === taskId)
        if (index >= 0) {
          tasks[index] = { ...tasks[index], status: 'assigned' }
        }
        return Promise.resolve({ task: tasks[index]!, agent: makeAgent() })
      }),
    } as unknown as Pick<TaskDispatcher, 'dispatch'>

    engine = new WorkflowEngine(runRepo, taskService, eventService, dispatcher)
  })

  it('rejects an empty office id', async () => {
    await expect(engine.startWorkflow('', 'task-0', [makeTask()])).rejects.toThrow(
      WorkflowEngineError,
    )
  })

  it('rejects an empty root task id', async () => {
    await expect(engine.startWorkflow('office-1', '', [makeTask()])).rejects.toThrow(
      WorkflowEngineError,
    )
  })

  it('rejects an empty plan task list', async () => {
    await expect(engine.startWorkflow('office-1', 'task-0', [])).rejects.toThrow(
      WorkflowEngineError,
    )
  })

  it('creates a workflow run and steps, emits WORKFLOW_STARTED, and returns them', async () => {
    tasks = [makeTask()]

    const result = await engine.startWorkflow('office-1', 'task-0', [tasks[0]])

    expect(result.run.status).toBe('running')
    expect(result.steps).toHaveLength(1)
    expect(result.steps[0].taskId).toBe('task-1')
    expect(result.steps[0].status).toBe('working')
    expect(runRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ officeId: 'office-1', rootTaskId: 'task-0', status: 'running' }),
    )
    expect(runRepo.createStep).toHaveBeenCalledWith(
      expect.objectContaining({ workflowRunId: 'run-1', taskId: 'task-1', sequence: 1 }),
    )
    expect(eventService.create).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'WORKFLOW_STARTED' }),
    )
  })

  it('dispatches only steps with no uncompleted dependencies', async () => {
    const task1 = makeTask({ id: 'task-1', title: 'Implement' })
    const task2 = makeTask({ id: 'task-2', title: 'QA' })
    tasks = [task1, task2]
    depsMap.set('task-2', ['task-1'])

    await engine.startWorkflow('office-1', 'task-0', [task1, task2])

    expect(dispatcher.dispatch).toHaveBeenCalledTimes(1)
    expect(dispatcher.dispatch).toHaveBeenCalledWith('task-1')
    expect(taskService.setStatus).toHaveBeenCalledWith('task-1', 'ready')
    expect(taskService.setStatus).not.toHaveBeenCalledWith('task-2', 'ready')
  })

  it('updates step to working when the task starts', async () => {
    tasks = [makeTask({ status: 'working' })]
    steps = [makeStep({ taskId: 'task-1', status: 'pending' })]

    await engine.onTaskStatusChanged('task-1', 'working')

    expect(runRepo.updateStepStatus).toHaveBeenCalledWith('step-1', 'working')
  })

  it('updates step to blocked and continues dispatching other ready steps', async () => {
    const task1 = makeTask({ id: 'task-1', status: 'working' })
    const task2 = makeTask({ id: 'task-2' })
    tasks = [task1, task2]
    steps = [
      makeStep({ id: 'step-1', taskId: 'task-1', status: 'working' }),
      makeStep({ id: 'step-2', taskId: 'task-2', status: 'pending' }),
    ]

    await engine.onTaskStatusChanged('task-1', 'blocked')

    expect(runRepo.updateStepStatus).toHaveBeenCalledWith('step-1', 'blocked')
    expect(dispatcher.dispatch).toHaveBeenCalledWith('task-2')
    expect(runRepo.updateStepStatus).toHaveBeenCalledWith('step-2', 'working')
  })

  it('dispatches the next ready step when a task completes', async () => {
    const task1 = makeTask({ id: 'task-1', status: 'completed' })
    const task2 = makeTask({ id: 'task-2' })
    tasks = [task1, task2]
    depsMap.set('task-2', ['task-1'])
    steps = [
      makeStep({ id: 'step-1', taskId: 'task-1', status: 'working' }),
      makeStep({ id: 'step-2', taskId: 'task-2', status: 'pending' }),
    ]

    await engine.onTaskStatusChanged('task-1', 'completed')

    expect(runRepo.updateStepStatus).toHaveBeenCalledWith('step-1', 'completed')
    expect(taskService.setStatus).toHaveBeenCalledWith('task-2', 'ready')
    expect(dispatcher.dispatch).toHaveBeenCalledWith('task-2')
    expect(runRepo.updateStepStatus).toHaveBeenCalledWith('step-2', 'working')
  })

  it('marks the workflow completed and emits WORKFLOW_COMPLETED when all steps finish', async () => {
    const task1 = makeTask({ id: 'task-1', status: 'completed' })
    const task2 = makeTask({ id: 'task-2', status: 'completed' })
    tasks = [task1, task2]
    steps = [
      makeStep({ id: 'step-1', taskId: 'task-1', status: 'completed' }),
      makeStep({ id: 'step-2', taskId: 'task-2', status: 'working' }),
    ]

    await engine.onTaskStatusChanged('task-2', 'completed')

    expect(runRepo.updateStepStatus).toHaveBeenCalledWith('step-2', 'completed')
    expect(runRepo.updateStatus).toHaveBeenCalledWith('run-1', 'completed')
    expect(eventService.create).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'WORKFLOW_COMPLETED' }),
    )
  })

  it('marks the workflow failed and emits WORKFLOW_FAILED when a task fails', async () => {
    tasks = [makeTask({ id: 'task-1', status: 'working' })]
    steps = [makeStep({ id: 'step-1', taskId: 'task-1', status: 'working' })]

    await engine.onTaskStatusChanged('task-1', 'failed')

    expect(runRepo.updateStepStatus).toHaveBeenCalledWith('step-1', 'failed')
    expect(runRepo.updateStatus).toHaveBeenCalledWith('run-1', 'failed')
    expect(eventService.create).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'WORKFLOW_FAILED' }),
    )
    expect(dispatcher.dispatch).not.toHaveBeenCalled()
  })

  it('does nothing for a task not in an active workflow', async () => {
    runRepo.getStepByTaskId = vi.fn().mockResolvedValue(null)

    await engine.onTaskStatusChanged('unknown-task', 'completed')

    expect(runRepo.updateStepStatus).not.toHaveBeenCalled()
    expect(runRepo.updateStatus).not.toHaveBeenCalled()
  })

  it('rejects an empty task id in onTaskStatusChanged', async () => {
    await expect(engine.onTaskStatusChanged('', 'completed')).rejects.toThrow(
      WorkflowEngineError,
    )
  })
})
