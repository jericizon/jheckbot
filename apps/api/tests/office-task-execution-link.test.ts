import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { OfficeTask } from '@jheckbot/shared'
import { pool } from '../src/db/pool.js'
import {
  OfficeTaskRepository,
  toOfficeTask,
  type OfficeTaskRecord,
} from '../src/repositories/OfficeTaskRepository.js'
import { OfficeEventService } from '../src/services/OfficeEventService.js'
import { OfficeTaskService } from '../src/services/OfficeTaskService.js'

vi.mock('../src/db/pool.js', () => ({
  pool: { query: vi.fn(), on: vi.fn(), end: vi.fn() },
}))

const now = new Date().toISOString()
const officeId = '996c3a36-9ded-44c8-a47e-d87d8f6d006a'
const projectId = '11111111-1111-1111-1111-111111111111'
const taskId = '22222222-2222-2222-2222-222222222222'
const conversationId = '33333333-3333-3333-3333-333333333333'

function fakeTaskRecord(overrides: Partial<OfficeTaskRecord> = {}): OfficeTaskRecord {
  return {
    id: taskId,
    office_id: officeId,
    project_id: projectId,
    parent_task_id: null,
    title: 'Implement task backend',
    description: null,
    acceptance_criteria: null,
    status: 'backlog',
    priority: 'medium',
    assigned_agent_id: null,
    created_by: null,
    workflow_type: null,
    execution_conversation_id: null,
    metadata: null,
    started_at: null,
    completed_at: null,
    created_at: now,
    updated_at: now,
    ...overrides,
  }
}

function makeTask(overrides: Partial<OfficeTask> = {}): OfficeTask {
  return {
    id: taskId,
    officeId,
    projectId,
    title: 'Implement task backend',
    status: 'backlog',
    priority: 'medium',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

describe('Task execution link mapping', () => {
  it('maps execution_conversation_id to executionConversationId', () => {
    const record = fakeTaskRecord({ execution_conversation_id: conversationId })
    expect(toOfficeTask(record).executionConversationId).toBe(conversationId)
  })

  it('maps null execution_conversation_id to undefined', () => {
    const record = fakeTaskRecord({ execution_conversation_id: null })
    expect(toOfficeTask(record).executionConversationId).toBeUndefined()
  })
})

describe('OfficeTaskRepository execution link', () => {
  let repo: OfficeTaskRepository

  beforeEach(() => {
    vi.clearAllMocks()
    repo = new OfficeTaskRepository()
  })

  it('findActiveCeoExecution returns the active CEO simple task', async () => {
    const record = fakeTaskRecord({
      created_by: 'ceo',
      workflow_type: 'simple',
      status: 'working',
      execution_conversation_id: conversationId,
    })
    vi.mocked(pool.query).mockResolvedValueOnce({ rows: [record] } as never)

    const task = await repo.findActiveCeoExecution(officeId)

    expect(task).toEqual(toOfficeTask(record))
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining("created_by = 'ceo'"),
      [officeId],
    )
  })

  it('findActiveCeoExecution returns null when no active CEO task', async () => {
    vi.mocked(pool.query).mockResolvedValueOnce({ rows: [] } as never)

    const task = await repo.findActiveCeoExecution(officeId)

    expect(task).toBeNull()
  })

  it('linkExecutionConversation updates the foreign key and returns the task', async () => {
    const record = fakeTaskRecord({ execution_conversation_id: conversationId })
    vi.mocked(pool.query).mockResolvedValueOnce({ rows: [record] } as never)

    const task = await repo.linkExecutionConversation(taskId, conversationId)

    expect(task).toEqual(toOfficeTask(record))
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('execution_conversation_id = $1'),
      [conversationId, taskId],
    )
  })

  it('linkExecutionConversation returns null when no row is updated', async () => {
    vi.mocked(pool.query).mockResolvedValueOnce({ rows: [] } as never)

    const task = await repo.linkExecutionConversation(taskId, conversationId)

    expect(task).toBeNull()
  })
})

describe('OfficeTaskService execution link', () => {
  let repo: OfficeTaskRepository
  let eventService: OfficeEventService
  let service: OfficeTaskService

  beforeEach(() => {
    const mockTask = makeTask()
    eventService = { create: vi.fn() } as unknown as OfficeEventService
    repo = {
      getById: vi.fn().mockResolvedValue(mockTask),
      update: vi.fn().mockResolvedValue(mockTask),
      findActiveCeoExecution: vi.fn().mockResolvedValue(null),
      linkExecutionConversation: vi.fn().mockResolvedValue(mockTask),
      setStatus: vi.fn().mockResolvedValue(mockTask),
    } as unknown as OfficeTaskRepository
    service = new OfficeTaskService(repo, eventService)
  })

  it('findActiveCeoExecution validates and delegates to the repository', async () => {
    const task = makeTask()
    vi.mocked(repo.findActiveCeoExecution).mockResolvedValueOnce(task)

    const result = await service.findActiveCeoExecution(officeId)

    expect(result).toEqual(task)
    expect(repo.findActiveCeoExecution).toHaveBeenCalledWith(officeId)
  })

  it('findActiveCeoExecution rejects an empty office ID', async () => {
    await expect(service.findActiveCeoExecution('')).rejects.toThrow('Office ID is required')
  })

  it('findActiveCeoExecution rejects a non-UUID office ID', async () => {
    await expect(service.findActiveCeoExecution('not-a-uuid')).rejects.toThrow(
      'Office ID must be a valid UUID',
    )
  })

  it('linkExecutionConversation validates and delegates to the repository', async () => {
    const task = makeTask({ executionConversationId: conversationId })
    vi.mocked(repo.linkExecutionConversation).mockResolvedValueOnce(task)

    const result = await service.linkExecutionConversation(taskId, conversationId)

    expect(result).toEqual(task)
    expect(repo.getById).toHaveBeenCalledWith(taskId)
    expect(repo.linkExecutionConversation).toHaveBeenCalledWith(taskId, conversationId)
  })

  it('linkExecutionConversation rejects empty or non-UUID IDs', async () => {
    await expect(service.linkExecutionConversation('', conversationId)).rejects.toThrow(
      'Task ID is required',
    )
    await expect(service.linkExecutionConversation(taskId, '')).rejects.toThrow(
      'Conversation ID is required',
    )
    await expect(service.linkExecutionConversation('bad', conversationId)).rejects.toThrow(
      'Task ID must be a valid UUID',
    )
    await expect(service.linkExecutionConversation(taskId, 'bad')).rejects.toThrow(
      'Conversation ID must be a valid UUID',
    )
  })

  it('linkExecutionConversation returns null when the task is missing', async () => {
    vi.mocked(repo.getById).mockResolvedValueOnce(null)

    const result = await service.linkExecutionConversation(
      '44444444-4444-4444-4444-444444444444',
      conversationId,
    )

    expect(result).toBeNull()
    expect(repo.linkExecutionConversation).not.toHaveBeenCalled()
  })

  it('completeExecution only completes a working, execution-backed task', async () => {
    const working = makeTask({
      status: 'working',
      executionConversationId: conversationId,
    })
    const completed = makeTask({
      status: 'completed',
      executionConversationId: conversationId,
    })
    vi.mocked(repo.getById).mockResolvedValueOnce(working)
    vi.mocked(repo.update).mockResolvedValueOnce(completed)

    const result = await service.completeExecution(taskId)

    expect(result).toEqual(completed)
    expect(repo.update).toHaveBeenCalledWith(
      taskId,
      expect.objectContaining({ status: 'completed', completedAt: expect.any(String) }),
    )
    expect(eventService.create).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'TASK_UPDATED' }),
    )
    expect(eventService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'TASK_COMPLETED',
        metadata: expect.objectContaining({ conversationId }),
      }),
    )
  })

  it('completeExecution returns null when the task is missing', async () => {
    vi.mocked(repo.getById).mockResolvedValueOnce(null)

    const result = await service.completeExecution(
      '44444444-4444-4444-4444-444444444444',
    )

    expect(result).toBeNull()
    expect(repo.update).not.toHaveBeenCalled()
  })

  it('completeExecution returns null when the task has no execution link', async () => {
    const notLinked = makeTask({ status: 'working' })
    vi.mocked(repo.getById).mockResolvedValueOnce(notLinked)

    const result = await service.completeExecution(taskId)

    expect(result).toBeNull()
    expect(repo.update).not.toHaveBeenCalled()
  })

  it('completeExecution returns null when the task is not working', async () => {
    const notWorking = makeTask({
      status: 'assigned',
      executionConversationId: conversationId,
    })
    vi.mocked(repo.getById).mockResolvedValueOnce(notWorking)

    const result = await service.completeExecution(taskId)

    expect(result).toBeNull()
    expect(repo.update).not.toHaveBeenCalled()
  })

  it('failExecution sets the task to failed and emits TASK_FAILED', async () => {
    const working = makeTask({
      status: 'working',
      executionConversationId: conversationId,
    })
    const failed = makeTask({
      status: 'failed',
      executionConversationId: conversationId,
    })
    vi.mocked(repo.getById).mockResolvedValueOnce(working)
    vi.mocked(repo.setStatus).mockResolvedValueOnce(failed)

    const result = await service.failExecution(taskId, 'agent_failed')

    expect(result).toEqual(failed)
    expect(repo.setStatus).toHaveBeenCalledWith(taskId, 'failed')
    expect(eventService.create).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'TASK_FAILED' }),
    )
  })

  it('failExecution returns null when the task is missing', async () => {
    vi.mocked(repo.getById).mockResolvedValueOnce(null)

    const result = await service.failExecution(
      '44444444-4444-4444-4444-444444444444',
    )

    expect(result).toBeNull()
    expect(repo.setStatus).not.toHaveBeenCalled()
  })

  it('failExecution does not modify an already terminal task', async () => {
    const alreadyFailed = makeTask({
      status: 'failed',
      executionConversationId: conversationId,
    })
    vi.mocked(repo.getById).mockResolvedValueOnce(alreadyFailed)

    const result = await service.failExecution(taskId)

    expect(result).toEqual(alreadyFailed)
    expect(repo.setStatus).not.toHaveBeenCalled()
  })
})
