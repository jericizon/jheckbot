import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { OfficeTask, OfficeTaskDependency, TaskPriority, TaskStatus } from '@jheckbot/shared'
import { OfficeTaskRepository } from '../src/repositories/OfficeTaskRepository.js'
import {
  CreateOfficeTaskInput,
  OfficeTaskService,
  OfficeTaskValidationError,
  UpdateOfficeTaskInput,
} from '../src/services/OfficeTaskService.js'

vi.mock('../src/db/pool.js', () => ({
  pool: { query: vi.fn(), on: vi.fn(), end: vi.fn() },
}))

function makeTask(overrides: Partial<OfficeTask> = {}): OfficeTask {
  const now = new Date().toISOString()
  return {
    id: 'task-1',
    officeId: 'office-1',
    title: 'Implement task backend',
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

describe('OfficeTaskService', () => {
  let repo: OfficeTaskRepository
  let service: OfficeTaskService
  let mockTask: OfficeTask
  let mockDependency: OfficeTaskDependency

  beforeEach(() => {
    mockTask = makeTask()
    mockDependency = makeDependency()

    repo = {
      create: vi.fn().mockResolvedValue(mockTask),
      listByOffice: vi.fn().mockResolvedValue([mockTask]),
      getById: vi.fn().mockResolvedValue(mockTask),
      update: vi.fn().mockResolvedValue(mockTask),
      delete: vi.fn().mockResolvedValue(true),
      setStatus: vi.fn().mockResolvedValue(mockTask),
      listDependencies: vi.fn().mockResolvedValue([]),
      addDependency: vi.fn().mockResolvedValue(mockDependency),
      removeDependency: vi.fn().mockResolvedValue(true),
      getDependents: vi.fn().mockResolvedValue([mockTask]),
    } as unknown as OfficeTaskRepository

    service = new OfficeTaskService(repo)
  })

  it('creates a task with defaults for status and priority', async () => {
    const result = await service.create({
      officeId: 'office-1',
      title: 'Implement task backend',
    })

    expect(result).toEqual(mockTask)
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        officeId: 'office-1',
        title: 'Implement task backend',
        status: 'backlog',
        priority: 'medium',
      }),
    )
  })

  it('rejects creation with empty office id', async () => {
    await expect(service.create({ officeId: '', title: 'Task' })).rejects.toThrow(
      OfficeTaskValidationError,
    )
  })

  it('rejects creation with empty title', async () => {
    await expect(service.create({ officeId: 'office-1', title: '' })).rejects.toThrow(
      OfficeTaskValidationError,
    )
  })

  it('rejects creation with an invalid status', async () => {
    await expect(
      service.create({
        officeId: 'office-1',
        title: 'Task',
        status: 'invalid' as TaskStatus,
      }),
    ).rejects.toThrow(OfficeTaskValidationError)
  })

  it('rejects creation with an invalid priority', async () => {
    await expect(
      service.create({
        officeId: 'office-1',
        title: 'Task',
        priority: 'invalid' as TaskPriority,
      }),
    ).rejects.toThrow(OfficeTaskValidationError)
  })

  it('trims the title when creating', async () => {
    await service.create({ officeId: 'office-1', title: '  Task  ' })
    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ title: 'Task' }))
  })

  it('lists tasks by office', async () => {
    const result = await service.listByOffice('office-1')
    expect(result).toEqual([mockTask])
    expect(repo.listByOffice).toHaveBeenCalledWith('office-1')
  })

  it('rejects listing with empty office id', async () => {
    await expect(service.listByOffice('')).rejects.toThrow(OfficeTaskValidationError)
  })

  it('gets a task by id', async () => {
    const result = await service.getById('task-1')
    expect(result).toEqual(mockTask)
    expect(repo.getById).toHaveBeenCalledWith('task-1')
  })

  it('rejects get with empty id', async () => {
    await expect(service.getById('')).rejects.toThrow(OfficeTaskValidationError)
  })

  it('updates a task and trims the title', async () => {
    const result = await service.update('task-1', { title: ' Updated title ' })
    expect(result).toEqual(mockTask)
    expect(repo.update).toHaveBeenCalledWith(
      'task-1',
      expect.objectContaining({ title: 'Updated title' }),
    )
  })

  it('assigns an agent when updating', async () => {
    await service.update('task-1', { assignedAgentId: 'agent-1' })
    expect(repo.update).toHaveBeenCalledWith(
      'task-1',
      expect.objectContaining({ assignedAgentId: 'agent-1' }),
    )
  })

  it('returns null when updating a non-existent task', async () => {
    vi.mocked(repo.getById).mockResolvedValueOnce(null)
    const result = await service.update('missing', { title: 'X' })
    expect(result).toBeNull()
    expect(repo.update).not.toHaveBeenCalled()
  })

  it('rejects update with empty title', async () => {
    await expect(service.update('task-1', { title: '' })).rejects.toThrow(OfficeTaskValidationError)
  })

  it('rejects update with an invalid priority', async () => {
    await expect(service.update('task-1', { priority: 'invalid' as TaskPriority })).rejects.toThrow(
      OfficeTaskValidationError,
    )
  })

  it('deletes a task', async () => {
    const result = await service.delete('task-1')
    expect(result).toBe(true)
    expect(repo.delete).toHaveBeenCalledWith('task-1')
  })

  it('rejects delete with empty id', async () => {
    await expect(service.delete('')).rejects.toThrow(OfficeTaskValidationError)
  })

  it('sets a task status', async () => {
    const assigned = makeTask({ status: 'assigned' })
    const working = makeTask({ status: 'working' })
    vi.mocked(repo.getById).mockResolvedValueOnce(assigned)
    vi.mocked(repo.setStatus).mockResolvedValueOnce(working)

    const result = await service.setStatus('task-1', 'working')
    expect(result).toEqual(working)
    expect(repo.setStatus).toHaveBeenCalledWith('task-1', 'working')
  })

  it('rejects setStatus with empty id', async () => {
    await expect(service.setStatus('', 'working')).rejects.toThrow(OfficeTaskValidationError)
  })

  it('rejects setStatus with an invalid status', async () => {
    await expect(service.setStatus('task-1', 'invalid' as TaskStatus)).rejects.toThrow(
      OfficeTaskValidationError,
    )
  })

  it('rejects invalid status transitions', async () => {
    await expect(service.setStatus('task-1', 'completed')).rejects.toThrow(
      OfficeTaskValidationError,
    )
  })

  it('rejects setStatus to ready when a dependency is not completed', async () => {
    vi.mocked(repo.listDependencies).mockResolvedValueOnce([
      makeTask({ id: 'task-2', status: 'backlog' }),
    ])

    await expect(service.setStatus('task-1', 'ready')).rejects.toThrow(OfficeTaskValidationError)
  })

  it('rejects setStatus to working when a dependency is not completed', async () => {
    const assigned = makeTask({ status: 'assigned' })
    vi.mocked(repo.getById).mockResolvedValueOnce(assigned)
    vi.mocked(repo.listDependencies).mockResolvedValueOnce([
      makeTask({ id: 'task-2', status: 'working' }),
    ])

    await expect(service.setStatus('task-1', 'working')).rejects.toThrow(OfficeTaskValidationError)
  })

  it('allows setStatus to ready when all dependencies are completed', async () => {
    vi.mocked(repo.listDependencies).mockResolvedValueOnce([
      makeTask({ id: 'task-2', status: 'completed' }),
    ])

    const result = await service.setStatus('task-1', 'ready')
    expect(result).toEqual(mockTask)
    expect(repo.setStatus).toHaveBeenCalledWith('task-1', 'ready')
  })

  it('lists dependencies', async () => {
    const dep = makeTask({ id: 'task-2', title: 'Dependency' })
    vi.mocked(repo.listDependencies).mockResolvedValueOnce([dep])

    const result = await service.listDependencies('task-1')
    expect(result).toEqual([dep])
    expect(repo.listDependencies).toHaveBeenCalledWith('task-1')
  })

  it('adds a dependency', async () => {
    const result = await service.addDependency('task-1', 'task-2')
    expect(result).toEqual(mockDependency)
    expect(repo.addDependency).toHaveBeenCalledWith('task-1', 'task-2')
  })

  it('rejects adding a dependency to itself', async () => {
    await expect(service.addDependency('task-1', 'task-1')).rejects.toThrow(
      OfficeTaskValidationError,
    )
  })

  it('rejects adding a dependency when the task is not found', async () => {
    vi.mocked(repo.getById).mockResolvedValueOnce(null)
    await expect(service.addDependency('missing', 'task-2')).rejects.toThrow(
      OfficeTaskValidationError,
    )
  })

  it('rejects adding a dependency when the dependency task is not found', async () => {
    vi.mocked(repo.getById).mockResolvedValueOnce(mockTask).mockResolvedValueOnce(null)
    await expect(service.addDependency('task-1', 'missing')).rejects.toThrow(
      OfficeTaskValidationError,
    )
  })

  it('rejects duplicate dependencies', async () => {
    vi.mocked(repo.listDependencies).mockResolvedValueOnce([makeTask({ id: 'task-2' })])
    await expect(service.addDependency('task-1', 'task-2')).rejects.toThrow(
      OfficeTaskValidationError,
    )
  })

  it('rejects circular dependencies', async () => {
    const taskA = makeTask({ id: 'task-a', title: 'A' })
    const taskB = makeTask({ id: 'task-b', title: 'B' })

    vi.mocked(repo.getById).mockResolvedValueOnce(taskA).mockResolvedValueOnce(taskB)

    repo.listDependencies = vi.fn().mockImplementation((id: string) => {
      if (id === 'task-a') return Promise.resolve([])
      if (id === 'task-b') return Promise.resolve([makeTask({ id: 'task-c' })])
      if (id === 'task-c') return Promise.resolve([taskA])
      return Promise.resolve([])
    })

    await expect(service.addDependency('task-a', 'task-b')).rejects.toThrow(
      OfficeTaskValidationError,
    )
  })

  it('removes a dependency', async () => {
    const result = await service.removeDependency('task-1', 'task-2')
    expect(result).toBe(true)
    expect(repo.removeDependency).toHaveBeenCalledWith('task-1', 'task-2')
  })

  it('rejects removeDependency with empty ids', async () => {
    await expect(service.removeDependency('', 'task-2')).rejects.toThrow(OfficeTaskValidationError)
    await expect(service.removeDependency('task-1', '')).rejects.toThrow(OfficeTaskValidationError)
  })

  it('lists tasks that depend on the given task', async () => {
    const dependent = makeTask({ id: 'task-3', title: 'Dependent' })
    vi.mocked(repo.getDependents).mockResolvedValueOnce([dependent])

    const result = await service.getDependents('task-1')
    expect(result).toEqual([dependent])
    expect(repo.getDependents).toHaveBeenCalledWith('task-1')
  })
})
