import { beforeEach, describe, expect, it, vi } from 'vitest'
import { pool } from '../src/db/pool.js'
import {
  OfficeTaskRepository,
  toOfficeTask,
  toOfficeTaskDependency,
  type OfficeTaskRecord,
  type OfficeTaskDependencyRecord,
} from '../src/repositories/OfficeTaskRepository.js'

vi.mock('../src/db/pool.js', () => ({
  pool: { query: vi.fn(), on: vi.fn(), end: vi.fn() },
}))

function fakeTaskRecord(overrides: Partial<OfficeTaskRecord> = {}): OfficeTaskRecord {
  const now = new Date().toISOString()
  return {
    id: 'task-1',
    office_id: 'office-1',
    project_id: null,
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

function fakeDependencyRecord(
  overrides: Partial<OfficeTaskDependencyRecord> = {},
): OfficeTaskDependencyRecord {
  return {
    task_id: 'task-1',
    depends_on_task_id: 'task-2',
    created_at: new Date().toISOString(),
    ...overrides,
  }
}

describe('OfficeTaskRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates a task and maps the row to the shared domain type', async () => {
    const record = fakeTaskRecord()
    vi.mocked(pool.query).mockResolvedValue({ rows: [record] } as never)
    const repo = new OfficeTaskRepository()

    const result = await repo.create({
      officeId: 'office-1',
      title: 'Implement task backend',
    })

    expect(result).toEqual(toOfficeTask(record))
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO tasks'),
      expect.arrayContaining(['office-1', 'Implement task backend', 'backlog', 'medium']),
    )
  })

  it('lists tasks by office in descending creation order', async () => {
    const record = fakeTaskRecord()
    vi.mocked(pool.query).mockResolvedValue({ rows: [record] } as never)
    const repo = new OfficeTaskRepository()

    const result = await repo.listByOffice('office-1')

    expect(result).toEqual([toOfficeTask(record)])
    expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('WHERE office_id = $1'), [
      'office-1',
    ])
  })

  it('gets a task by id', async () => {
    const record = fakeTaskRecord()
    vi.mocked(pool.query).mockResolvedValue({ rows: [record] } as never)
    const repo = new OfficeTaskRepository()

    const result = await repo.getById('task-1')

    expect(result).toEqual(toOfficeTask(record))
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('SELECT * FROM tasks WHERE id = $1'),
      ['task-1'],
    )
  })

  it('returns null when getting a task that does not exist', async () => {
    vi.mocked(pool.query).mockResolvedValue({ rows: [] } as never)
    const repo = new OfficeTaskRepository()

    await expect(repo.getById('missing')).resolves.toBeNull()
  })

  it('updates a task and preserves existing fields when omitted', async () => {
    const existing = fakeTaskRecord()
    const updated = fakeTaskRecord({ title: 'Updated title' })
    vi.mocked(pool.query)
      .mockResolvedValueOnce({ rows: [existing] } as never)
      .mockResolvedValueOnce({ rows: [updated] } as never)

    const repo = new OfficeTaskRepository()
    const result = await repo.update('task-1', { title: 'Updated title' })

    expect(result).toEqual(toOfficeTask(updated))
    const [, params] = vi.mocked(pool.query).mock.calls[1]
    expect(params).toContain('Updated title')
    expect(params).toContain('task-1')
  })

  it('returns null when updating a missing task', async () => {
    vi.mocked(pool.query).mockResolvedValue({ rows: [] } as never)
    const repo = new OfficeTaskRepository()

    await expect(repo.update('missing', { title: 'X' })).resolves.toBeNull()
  })

  it('deletes a task', async () => {
    vi.mocked(pool.query).mockResolvedValue({ rowCount: 1 } as never)
    const repo = new OfficeTaskRepository()

    const result = await repo.delete('task-1')

    expect(result).toBe(true)
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM tasks WHERE id = $1'),
      ['task-1'],
    )
  })

  it('sets a task status', async () => {
    const updated = fakeTaskRecord({ status: 'working' })
    vi.mocked(pool.query).mockResolvedValue({ rows: [updated] } as never)
    const repo = new OfficeTaskRepository()

    const result = await repo.setStatus('task-1', 'working')

    expect(result).toEqual(toOfficeTask(updated))
    expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('UPDATE tasks SET status'), [
      'working',
      'task-1',
    ])
  })

  it('lists dependencies for a task', async () => {
    const dep = fakeTaskRecord({ id: 'task-2', title: 'Dependency' })
    vi.mocked(pool.query).mockResolvedValue({ rows: [dep] } as never)
    const repo = new OfficeTaskRepository()

    const result = await repo.listDependencies('task-1')

    expect(result).toEqual([toOfficeTask(dep)])
    expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('JOIN tasks'), ['task-1'])
  })

  it('adds a dependency and returns it', async () => {
    const record = fakeDependencyRecord()
    vi.mocked(pool.query).mockResolvedValue({ rows: [record] } as never)
    const repo = new OfficeTaskRepository()

    const result = await repo.addDependency('task-1', 'task-2')

    expect(result).toEqual(toOfficeTaskDependency(record))
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO task_dependencies'),
      ['task-1', 'task-2'],
    )
  })

  it('addDependency returns the existing record on conflict', async () => {
    const record = fakeDependencyRecord()
    vi.mocked(pool.query)
      .mockResolvedValueOnce({ rows: [] } as never)
      .mockResolvedValueOnce({ rows: [record] } as never)
    const repo = new OfficeTaskRepository()

    const result = await repo.addDependency('task-1', 'task-2')

    expect(result).toEqual(toOfficeTaskDependency(record))
  })

  it('removes a dependency', async () => {
    vi.mocked(pool.query).mockResolvedValue({ rowCount: 1 } as never)
    const repo = new OfficeTaskRepository()

    const result = await repo.removeDependency('task-1', 'task-2')

    expect(result).toBe(true)
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM task_dependencies'),
      ['task-1', 'task-2'],
    )
  })

  it('lists tasks that depend on the given task', async () => {
    const dependent = fakeTaskRecord({ id: 'task-3', title: 'Dependent task' })
    vi.mocked(pool.query).mockResolvedValue({ rows: [dependent] } as never)
    const repo = new OfficeTaskRepository()

    const result = await repo.getDependents('task-2')

    expect(result).toEqual([toOfficeTask(dependent)])
    expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('depends_on_task_id = $1'), [
      'task-2',
    ])
  })
})
