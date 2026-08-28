import { beforeEach, describe, expect, it, vi } from 'vitest'
import { pool } from '../src/db/pool.js'
import {
  WorkflowRunRepository,
  toOfficeWorkflowRun,
  toOfficeWorkflowStep,
  type OfficeWorkflowRunRecord,
  type OfficeWorkflowStepRecord,
} from '../src/repositories/WorkflowRunRepository.js'

vi.mock('../src/db/pool.js', () => ({
  pool: { query: vi.fn(), on: vi.fn(), end: vi.fn() },
}))

function fakeRunRecord(overrides: Partial<OfficeWorkflowRunRecord> = {}): OfficeWorkflowRunRecord {
  const now = new Date().toISOString()
  return {
    id: 'run-1',
    office_id: 'office-1',
    root_task_id: 'task-0',
    status: 'running',
    started_at: now,
    completed_at: null,
    metadata: null,
    created_at: now,
    updated_at: now,
    ...overrides,
  }
}

function fakeStepRecord(
  overrides: Partial<OfficeWorkflowStepRecord> = {},
): OfficeWorkflowStepRecord {
  const now = new Date().toISOString()
  return {
    id: 'step-1',
    workflow_run_id: 'run-1',
    task_id: 'task-1',
    step_type: 'task',
    status: 'pending',
    sequence: 1,
    metadata: null,
    started_at: null,
    completed_at: null,
    created_at: now,
    updated_at: now,
    ...overrides,
  }
}

describe('WorkflowRunRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates a workflow run and maps the row', async () => {
    const record = fakeRunRecord()
    vi.mocked(pool.query).mockResolvedValue({ rows: [record] } as never)
    const repo = new WorkflowRunRepository()

    const result = await repo.create({
      officeId: 'office-1',
      rootTaskId: 'task-0',
      status: 'running',
      startedAt: new Date().toISOString(),
    })

    expect(result).toEqual(toOfficeWorkflowRun(record))
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO workflow_runs'),
      expect.arrayContaining(['office-1', 'task-0', 'running']),
    )
  })

  it('gets a workflow run by id', async () => {
    const record = fakeRunRecord()
    vi.mocked(pool.query).mockResolvedValue({ rows: [record] } as never)
    const repo = new WorkflowRunRepository()

    const result = await repo.getById('run-1')

    expect(result).toEqual(toOfficeWorkflowRun(record))
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('SELECT * FROM workflow_runs WHERE id = $1'),
      ['run-1'],
    )
  })

  it('returns null when getting a missing workflow run', async () => {
    vi.mocked(pool.query).mockResolvedValue({ rows: [] } as never)
    const repo = new WorkflowRunRepository()

    await expect(repo.getById('missing')).resolves.toBeNull()
  })

  it('lists workflow runs by office', async () => {
    const record = fakeRunRecord()
    vi.mocked(pool.query).mockResolvedValue({ rows: [record] } as never)
    const repo = new WorkflowRunRepository()

    const result = await repo.listByOffice('office-1')

    expect(result).toEqual([toOfficeWorkflowRun(record)])
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE office_id = $1'),
      ['office-1'],
    )
  })

  it('lists workflow runs by root task', async () => {
    const record = fakeRunRecord()
    vi.mocked(pool.query).mockResolvedValue({ rows: [record] } as never)
    const repo = new WorkflowRunRepository()

    const result = await repo.listByTask('task-0')

    expect(result).toEqual([toOfficeWorkflowRun(record)])
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE root_task_id = $1'),
      ['task-0'],
    )
  })

  it('updates a workflow run status and timestamps', async () => {
    const updated = fakeRunRecord({ status: 'completed', completed_at: new Date().toISOString() })
    vi.mocked(pool.query).mockResolvedValue({ rows: [updated] } as never)

    const repo = new WorkflowRunRepository()
    const result = await repo.updateStatus('run-1', 'completed')

    expect(result).toEqual(toOfficeWorkflowRun(updated))
    const [, params] = vi.mocked(pool.query).mock.calls[0]
    expect(params).toContain('completed')
    expect(params).toContain('run-1')
  })

  it('deletes a workflow run', async () => {
    vi.mocked(pool.query).mockResolvedValue({ rowCount: 1 } as never)
    const repo = new WorkflowRunRepository()

    const result = await repo.delete('run-1')

    expect(result).toBe(true)
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM workflow_runs WHERE id = $1'),
      ['run-1'],
    )
  })

  it('creates a workflow step and maps the row', async () => {
    const record = fakeStepRecord()
    vi.mocked(pool.query).mockResolvedValue({ rows: [record] } as never)
    const repo = new WorkflowRunRepository()

    const result = await repo.createStep({
      workflowRunId: 'run-1',
      taskId: 'task-1',
      stepType: 'task',
      sequence: 1,
    })

    expect(result).toEqual(toOfficeWorkflowStep(record))
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO workflow_steps'),
      expect.arrayContaining(['run-1', 'task-1', 'task', 1, 'pending']),
    )
  })

  it('gets a step by id', async () => {
    const record = fakeStepRecord()
    vi.mocked(pool.query).mockResolvedValue({ rows: [record] } as never)
    const repo = new WorkflowRunRepository()

    const result = await repo.getStepById('step-1')

    expect(result).toEqual(toOfficeWorkflowStep(record))
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('SELECT * FROM workflow_steps WHERE id = $1'),
      ['step-1'],
    )
  })

  it('gets a step by task id for the running run', async () => {
    const record = fakeStepRecord()
    vi.mocked(pool.query).mockResolvedValue({ rows: [record] } as never)
    const repo = new WorkflowRunRepository()

    const result = await repo.getStepByTaskId('task-1')

    expect(result).toEqual(toOfficeWorkflowStep(record))
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('JOIN workflow_runs'),
      ['task-1'],
    )
  })

  it('lists steps for a run ordered by sequence', async () => {
    const step1 = fakeStepRecord({ id: 'step-1', sequence: 2 })
    const step2 = fakeStepRecord({ id: 'step-2', sequence: 1 })
    vi.mocked(pool.query).mockResolvedValue({ rows: [step1, step2] } as never)
    const repo = new WorkflowRunRepository()

    const result = await repo.listSteps('run-1')

    expect(result).toEqual([toOfficeWorkflowStep(step1), toOfficeWorkflowStep(step2)])
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE workflow_run_id = $1'),
      ['run-1'],
    )
  })

  it('updates a step status and timestamps', async () => {
    const updated = fakeStepRecord({ status: 'completed', completed_at: new Date().toISOString() })
    vi.mocked(pool.query).mockResolvedValue({ rows: [updated] } as never)

    const repo = new WorkflowRunRepository()
    const result = await repo.updateStepStatus('step-1', 'completed')

    expect(result).toEqual(toOfficeWorkflowStep(updated))
    const [, params] = vi.mocked(pool.query).mock.calls[0]
    expect(params).toContain('completed')
    expect(params).toContain('step-1')
  })
})
