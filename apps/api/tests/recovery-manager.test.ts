import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { OfficeAgent, OfficeEvent, OfficeTask } from '@jheckbot/shared'
import { RecoveryError, RecoveryManager } from '../src/services/orchestration/RecoveryManager.js'
import type { OfficeAgentService } from '../src/services/OfficeAgentService.js'
import type { OfficeEventService } from '../src/services/OfficeEventService.js'
import type { OfficeTaskService } from '../src/services/OfficeTaskService.js'

function makeTask(overrides: Partial<OfficeTask> = {}): OfficeTask {
  const now = new Date().toISOString()
  return {
    id: 'task-1',
    officeId: 'office-1',
    projectId: 'project-1',
    parentTaskId: undefined,
    title: 'Implement backend feature',
    description: 'Original description',
    status: 'backlog',
    priority: 'medium',
    assignedAgentId: undefined,
    createdBy: undefined,
    workflowType: 'medium',
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
    status: 'error',
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
    eventType: 'TASK_FAILED',
    createdAt: now,
  }
}

describe('RecoveryManager', () => {
  let taskService: OfficeTaskService
  let agentService: OfficeAgentService
  let eventService: OfficeEventService
  let manager: RecoveryManager

  beforeEach(() => {
    taskService = {
      getById: vi.fn(),
      create: vi.fn(),
      setStatus: vi.fn(),
      update: vi.fn(),
      listByOffice: vi.fn(),
    } as unknown as OfficeTaskService

    agentService = {
      getById: vi.fn(),
    } as unknown as OfficeAgentService

    eventService = {
      create: vi.fn().mockResolvedValue(makeEvent()),
    } as unknown as OfficeEventService

    manager = new RecoveryManager(taskService, agentService, eventService)
  })

  describe('handleTaskFailure', () => {
    it('rejects an empty task id', async () => {
      await expect(manager.handleTaskFailure('')).rejects.toThrow(RecoveryError)
      expect(taskService.getById).not.toHaveBeenCalled()
    })

    it('throws when the task is not found', async () => {
      vi.mocked(taskService.getById).mockResolvedValueOnce(null)

      await expect(manager.handleTaskFailure('missing')).rejects.toThrow(RecoveryError)
      expect(taskService.create).not.toHaveBeenCalled()
    })

    it('throws when the task is not failed', async () => {
      vi.mocked(taskService.getById).mockResolvedValueOnce(makeTask({ status: 'working' }))

      await expect(manager.handleTaskFailure('task-1')).rejects.toThrow(RecoveryError)
      expect(taskService.create).not.toHaveBeenCalled()
    })

    it('creates a fix task and emits failure and recovery events', async () => {
      const failedTask = makeTask({
        id: 'task-1',
        status: 'failed',
        title: 'Implement backend feature',
        description: 'Original description',
        priority: 'high',
        workflowType: 'medium',
      })
      const fixTask = makeTask({
        id: 'fix-1',
        parentTaskId: 'task-1',
        title: 'Fix: Implement backend feature',
        description: 'Fix failure for: Original description',
        status: 'backlog',
        priority: 'high',
        workflowType: 'medium',
      })

      vi.mocked(taskService.getById).mockResolvedValueOnce(failedTask)
      vi.mocked(taskService.create).mockResolvedValueOnce(fixTask)

      const result = await manager.handleTaskFailure('task-1')

      expect(result).toEqual(fixTask)
      expect(taskService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          officeId: 'office-1',
          projectId: 'project-1',
          parentTaskId: 'task-1',
          title: 'Fix: Implement backend feature',
          description: 'Fix failure for: Original description',
          priority: 'high',
          status: 'backlog',
          workflowType: 'medium',
        }),
      )
      expect(eventService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          officeId: 'office-1',
          eventType: 'TASK_FAILED',
          metadata: expect.objectContaining({ taskId: 'task-1' }),
        }),
      )
      expect(eventService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          officeId: 'office-1',
          eventType: 'RECOVERY_STARTED',
          metadata: expect.objectContaining({
            fixTaskId: 'fix-1',
            originalTaskId: 'task-1',
          }),
        }),
      )
    })

    it('falls back to the title when the original task has no description', async () => {
      const failedTask = makeTask({
        id: 'task-1',
        status: 'failed',
        title: 'Implement backend feature',
        description: undefined,
      })

      vi.mocked(taskService.getById).mockResolvedValueOnce(failedTask)
      vi.mocked(taskService.create).mockResolvedValueOnce(makeTask({ id: 'fix-1' }))

      await manager.handleTaskFailure('task-1')

      expect(taskService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          description: 'Fix failure for: Implement backend feature',
        }),
      )
    })
  })

  describe('retryTask', () => {
    it('rejects an empty task id', async () => {
      await expect(manager.retryTask('')).rejects.toThrow(RecoveryError)
      expect(taskService.getById).not.toHaveBeenCalled()
    })

    it('throws when the task is not found', async () => {
      vi.mocked(taskService.getById).mockResolvedValueOnce(null)

      await expect(manager.retryTask('missing')).rejects.toThrow(RecoveryError)
      expect(taskService.setStatus).not.toHaveBeenCalled()
    })

    it('throws when the task is not failed', async () => {
      vi.mocked(taskService.getById).mockResolvedValueOnce(makeTask({ status: 'working' }))

      await expect(manager.retryTask('task-1')).rejects.toThrow(RecoveryError)
      expect(taskService.setStatus).not.toHaveBeenCalled()
    })

    it('sets a failed task to working and emits a TASK_RETRY event', async () => {
      const failedTask = makeTask({ id: 'task-1', status: 'failed' })
      const workingTask = makeTask({ id: 'task-1', status: 'working' })

      vi.mocked(taskService.getById).mockResolvedValueOnce(failedTask)
      vi.mocked(taskService.setStatus).mockResolvedValueOnce(workingTask)

      const result = await manager.retryTask('task-1')

      expect(result).toEqual(workingTask)
      expect(taskService.setStatus).toHaveBeenCalledWith('task-1', 'working')
      expect(eventService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          officeId: 'office-1',
          eventType: 'TASK_RETRY',
          metadata: expect.objectContaining({ taskId: 'task-1' }),
        }),
      )
    })

    it('throws when setStatus cannot transition the task', async () => {
      const failedTask = makeTask({ id: 'task-1', status: 'failed' })

      vi.mocked(taskService.getById).mockResolvedValueOnce(failedTask)
      vi.mocked(taskService.setStatus).mockResolvedValueOnce(null)

      await expect(manager.retryTask('task-1')).rejects.toThrow(RecoveryError)
    })
  })

  describe('handleAgentFailure', () => {
    it('rejects an empty agent id', async () => {
      await expect(manager.handleAgentFailure('')).rejects.toThrow(RecoveryError)
      expect(agentService.getById).not.toHaveBeenCalled()
    })

    it('throws when the agent is not found', async () => {
      vi.mocked(agentService.getById).mockResolvedValueOnce(null)

      await expect(manager.handleAgentFailure('missing')).rejects.toThrow(RecoveryError)
      expect(taskService.listByOffice).not.toHaveBeenCalled()
    })

    it('returns an empty array when the agent has no affected tasks', async () => {
      const agent = makeAgent()
      vi.mocked(agentService.getById).mockResolvedValueOnce(agent)
      vi.mocked(taskService.listByOffice).mockResolvedValueOnce([
        makeTask({ id: 'task-2', status: 'working', assignedAgentId: 'agent-2' }),
      ])

      const result = await manager.handleAgentFailure('agent-1')

      expect(result).toEqual([])
      expect(taskService.setStatus).not.toHaveBeenCalled()
      expect(eventService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          officeId: 'office-1',
          eventType: 'AGENT_FAILED',
          metadata: expect.objectContaining({
            agentId: 'agent-1',
            affectedTaskIds: [],
          }),
        }),
      )
    })

    it('reassigns assigned tasks to ready and unassigns the agent', async () => {
      const agent = makeAgent()
      const assignedTask = makeTask({
        id: 'task-2',
        status: 'assigned',
        assignedAgentId: 'agent-1',
      })
      const readyTask = makeTask({
        id: 'task-2',
        status: 'ready',
        assignedAgentId: 'agent-1',
      })
      const unassignedTask = makeTask({
        id: 'task-2',
        status: 'ready',
        assignedAgentId: undefined,
      })

      vi.mocked(agentService.getById).mockResolvedValueOnce(agent)
      vi.mocked(taskService.listByOffice).mockResolvedValueOnce([assignedTask])
      vi.mocked(taskService.setStatus).mockResolvedValueOnce(readyTask)
      vi.mocked(taskService.update).mockResolvedValueOnce(unassignedTask)

      const result = await manager.handleAgentFailure('agent-1')

      expect(result).toEqual([unassignedTask])
      expect(taskService.setStatus).toHaveBeenCalledWith('task-2', 'ready')
      expect(taskService.update).toHaveBeenCalledWith('task-2', { assignedAgentId: null })
    })

    it('reassigns working tasks to blocked and unassigns the agent', async () => {
      const agent = makeAgent()
      const workingTask = makeTask({
        id: 'task-3',
        status: 'working',
        assignedAgentId: 'agent-1',
      })
      const blockedTask = makeTask({
        id: 'task-3',
        status: 'blocked',
        assignedAgentId: 'agent-1',
      })
      const unassignedTask = makeTask({
        id: 'task-3',
        status: 'blocked',
        assignedAgentId: undefined,
      })

      vi.mocked(agentService.getById).mockResolvedValueOnce(agent)
      vi.mocked(taskService.listByOffice).mockResolvedValueOnce([workingTask])
      vi.mocked(taskService.setStatus).mockResolvedValueOnce(blockedTask)
      vi.mocked(taskService.update).mockResolvedValueOnce(unassignedTask)

      const result = await manager.handleAgentFailure('agent-1')

      expect(result).toEqual([unassignedTask])
      expect(taskService.setStatus).toHaveBeenCalledWith('task-3', 'blocked')
      expect(taskService.update).toHaveBeenCalledWith('task-3', { assignedAgentId: null })
    })

    it('reassigns even when the agent status is not error', async () => {
      const agent = makeAgent({ status: 'working' })
      const assignedTask = makeTask({
        id: 'task-2',
        status: 'assigned',
        assignedAgentId: 'agent-1',
      })
      const readyTask = makeTask({
        id: 'task-2',
        status: 'ready',
        assignedAgentId: undefined,
      })

      vi.mocked(agentService.getById).mockResolvedValueOnce(agent)
      vi.mocked(taskService.listByOffice).mockResolvedValueOnce([assignedTask])
      vi.mocked(taskService.setStatus).mockResolvedValueOnce(readyTask)
      vi.mocked(taskService.update).mockResolvedValueOnce(readyTask)

      const result = await manager.handleAgentFailure('agent-1')

      expect(result).toEqual([readyTask])
      expect(taskService.setStatus).toHaveBeenCalledWith('task-2', 'ready')
    })

    it('emits an AGENT_FAILED event with all affected task ids', async () => {
      const agent = makeAgent()
      const t1 = makeTask({
        id: 'task-2',
        status: 'assigned',
        assignedAgentId: 'agent-1',
      })
      const t2 = makeTask({
        id: 'task-3',
        status: 'working',
        assignedAgentId: 'agent-1',
      })

      vi.mocked(agentService.getById).mockResolvedValueOnce(agent)
      vi.mocked(taskService.listByOffice).mockResolvedValueOnce([t1, t2])
      vi.mocked(taskService.setStatus)
        .mockResolvedValueOnce(makeTask({ id: 'task-2', status: 'ready' }))
        .mockResolvedValueOnce(makeTask({ id: 'task-3', status: 'blocked' }))
      vi.mocked(taskService.update)
        .mockResolvedValueOnce(
          makeTask({ id: 'task-2', status: 'ready', assignedAgentId: undefined }),
        )
        .mockResolvedValueOnce(
          makeTask({ id: 'task-3', status: 'blocked', assignedAgentId: undefined }),
        )

      await manager.handleAgentFailure('agent-1')

      expect(eventService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          officeId: 'office-1',
          eventType: 'AGENT_FAILED',
          metadata: expect.objectContaining({
            agentId: 'agent-1',
            affectedTaskIds: ['task-2', 'task-3'],
          }),
        }),
      )
    })

    it('throws when a task cannot be reset', async () => {
      const agent = makeAgent()
      const assignedTask = makeTask({
        id: 'task-2',
        status: 'assigned',
        assignedAgentId: 'agent-1',
      })

      vi.mocked(agentService.getById).mockResolvedValueOnce(agent)
      vi.mocked(taskService.listByOffice).mockResolvedValueOnce([assignedTask])
      vi.mocked(taskService.setStatus).mockResolvedValueOnce(null)

      await expect(manager.handleAgentFailure('agent-1')).rejects.toThrow(RecoveryError)
    })
  })
})
