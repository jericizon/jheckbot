import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { OfficeAgent, OfficeEvent, OfficeTask } from '@jheckbot/shared'
import type { AgentSelector } from '../src/services/orchestration/AgentSelector.js'
import { TaskDispatchError, TaskDispatcher } from '../src/services/orchestration/TaskDispatcher.js'
import type { OfficeAgentService } from '../src/services/OfficeAgentService.js'
import type { OfficeEventService } from '../src/services/OfficeEventService.js'
import type { OfficeTaskService } from '../src/services/OfficeTaskService.js'

function makeTask(overrides: Partial<OfficeTask> = {}): OfficeTask {
  const now = new Date().toISOString()
  return {
    id: 'task-1',
    officeId: 'office-1',
    title: 'Implement backend feature',
    status: 'ready',
    priority: 'medium',
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

function makeEvent(): OfficeEvent {
  const now = new Date().toISOString()
  return {
    id: 'event-1',
    officeId: 'office-1',
    eventType: 'TASK_DISPATCHED',
    createdAt: now,
  }
}

describe('TaskDispatcher', () => {
  let taskService: OfficeTaskService
  let agentService: OfficeAgentService
  let eventService: OfficeEventService
  let agentSelector: Pick<AgentSelector, 'select'>
  let dispatcher: TaskDispatcher

  beforeEach(() => {
    taskService = {
      getById: vi.fn().mockResolvedValue(makeTask()),
      listDependencies: vi.fn().mockResolvedValue([]),
      setStatus: vi.fn().mockImplementation((_id, status) => {
        return Promise.resolve(makeTask({ status }))
      }),
      update: vi.fn().mockImplementation((_id, input) => {
        return Promise.resolve(makeTask({ ...input, status: 'assigned' } as Partial<OfficeTask>))
      }),
    } as unknown as OfficeTaskService

    agentService = {
      update: vi.fn().mockImplementation((_id, input) => {
        return Promise.resolve(makeAgent(input as Partial<OfficeAgent>))
      }),
    } as unknown as OfficeAgentService

    eventService = {
      create: vi.fn().mockResolvedValue(makeEvent()),
    } as unknown as OfficeEventService

    agentSelector = {
      select: vi.fn().mockResolvedValue(makeAgent()),
    } as unknown as Pick<AgentSelector, 'select'>

    dispatcher = new TaskDispatcher(taskService, agentService, eventService, agentSelector)
  })

  it('rejects an empty task id', async () => {
    await expect(dispatcher.dispatch('')).rejects.toThrow(TaskDispatchError)
    expect(taskService.getById).not.toHaveBeenCalled()
  })

  it('throws when the task is not found', async () => {
    vi.mocked(taskService.getById).mockResolvedValueOnce(null)

    await expect(dispatcher.dispatch('missing-task')).rejects.toThrow(TaskDispatchError)
    expect(taskService.listDependencies).not.toHaveBeenCalled()
    expect(agentSelector.select).not.toHaveBeenCalled()
  })

  it('throws when the task status is not ready or assigned', async () => {
    vi.mocked(taskService.getById).mockResolvedValueOnce(makeTask({ status: 'backlog' }))

    await expect(dispatcher.dispatch('task-1')).rejects.toThrow(TaskDispatchError)
    expect(taskService.listDependencies).not.toHaveBeenCalled()
    expect(agentSelector.select).not.toHaveBeenCalled()
  })

  it('throws when a dependency is not completed', async () => {
    vi.mocked(taskService.listDependencies).mockResolvedValueOnce([
      makeTask({ id: 'dep-1', status: 'backlog' }),
    ])

    await expect(dispatcher.dispatch('task-1')).rejects.toThrow(TaskDispatchError)
    expect(agentSelector.select).not.toHaveBeenCalled()
    expect(taskService.update).not.toHaveBeenCalled()
  })

  it('throws when no agent is available', async () => {
    vi.mocked(agentSelector.select).mockResolvedValueOnce(null)

    await expect(dispatcher.dispatch('task-1')).rejects.toThrow(TaskDispatchError)
    expect(taskService.update).not.toHaveBeenCalled()
    expect(agentService.update).not.toHaveBeenCalled()
    expect(eventService.create).not.toHaveBeenCalled()
  })

  it('dispatches a ready task to the selected agent', async () => {
    const agent = makeAgent({ id: 'agent-1' })
    vi.mocked(agentSelector.select).mockResolvedValueOnce(agent)

    const result = await dispatcher.dispatch('task-1')

    expect(result.task).toEqual(
      expect.objectContaining({ status: 'assigned', assignedAgentId: 'agent-1' }),
    )
    expect(result.agent).toEqual(expect.objectContaining({ id: 'agent-1' }))
    expect(taskService.setStatus).toHaveBeenCalledWith('task-1', 'assigned')
    expect(taskService.update).toHaveBeenCalledWith('task-1', { assignedAgentId: 'agent-1' })
  })

  it('updates the selected agent status to working', async () => {
    const agent = makeAgent({ id: 'agent-1' })
    const workingAgent = makeAgent({ id: 'agent-1', status: 'working' })
    vi.mocked(agentSelector.select).mockResolvedValueOnce(agent)
    vi.mocked(agentService.update).mockResolvedValueOnce(workingAgent)

    const result = await dispatcher.dispatch('task-1')

    expect(result.agent).toEqual(workingAgent)
    expect(agentService.update).toHaveBeenCalledWith('agent-1', { status: 'working' })
  })

  it('emits a TASK_DISPATCHED event with agent info', async () => {
    const agent = makeAgent({ id: 'agent-1', name: 'Alfred' })
    const assignedTask = makeTask({ status: 'assigned', assignedAgentId: 'agent-1' })
    vi.mocked(agentSelector.select).mockResolvedValueOnce(agent)
    vi.mocked(taskService.update).mockResolvedValueOnce(assignedTask)

    await dispatcher.dispatch('task-1')

    expect(eventService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        officeId: 'office-1',
        eventType: 'TASK_DISPATCHED',
        content: 'Task dispatched to Alfred',
        metadata: expect.objectContaining({
          taskId: 'task-1',
          agentId: 'agent-1',
          agentName: 'Alfred',
          previousStatus: 'ready',
        }),
      }),
    )
  })
})
