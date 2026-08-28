import type {
  OfficeWorkflowRun,
  OfficeWorkflowStep,
  WorkflowRunStatus,
  WorkflowStepStatus,
} from '@jheckbot/shared'
import { pool, type DbExecutor } from '../db/pool.js'

export interface OfficeWorkflowRunRecord {
  id: string
  office_id: string
  root_task_id: string | null
  status: string
  started_at: unknown
  completed_at: unknown
  metadata: unknown
  created_at: unknown
  updated_at: unknown
}

export interface OfficeWorkflowStepRecord {
  id: string
  workflow_run_id: string
  task_id: string | null
  step_type: string
  status: string
  sequence: number
  metadata: unknown
  started_at: unknown
  completed_at: unknown
  created_at: unknown
  updated_at: unknown
}

function asIsoString(value: unknown): string {
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'string') return value
  return String(value ?? '')
}

function asOptionalTimestamp(value: unknown): string | undefined {
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'string') return value
  return undefined
}

function parseRecord(value: unknown): Record<string, unknown> | undefined {
  if (typeof value === 'object' && value !== null) return value as Record<string, unknown>
  return undefined
}

function jsonbOrNull(value: Record<string, unknown> | null | undefined): string | null {
  if (value === undefined || value === null) return null
  return JSON.stringify(value)
}

export function toOfficeWorkflowRun(row: OfficeWorkflowRunRecord): OfficeWorkflowRun {
  return {
    id: row.id,
    officeId: row.office_id,
    rootTaskId: row.root_task_id ?? undefined,
    status: row.status as WorkflowRunStatus,
    startedAt: asOptionalTimestamp(row.started_at),
    completedAt: asOptionalTimestamp(row.completed_at),
    metadata: parseRecord(row.metadata),
    createdAt: asIsoString(row.created_at),
    updatedAt: asIsoString(row.updated_at),
  }
}

export function toOfficeWorkflowStep(row: OfficeWorkflowStepRecord): OfficeWorkflowStep {
  return {
    id: row.id,
    workflowRunId: row.workflow_run_id,
    taskId: row.task_id ?? undefined,
    stepType: row.step_type,
    status: row.status as WorkflowStepStatus,
    sequence: row.sequence,
    metadata: parseRecord(row.metadata),
    startedAt: asOptionalTimestamp(row.started_at),
    completedAt: asOptionalTimestamp(row.completed_at),
    createdAt: asIsoString(row.created_at),
    updatedAt: asIsoString(row.updated_at),
  }
}

export interface WorkflowRunCreateData {
  officeId: string
  rootTaskId?: string | null
  status?: WorkflowRunStatus
  startedAt?: string | null
  completedAt?: string | null
  metadata?: Record<string, unknown> | null
}

export interface WorkflowStepCreateData {
  workflowRunId: string
  taskId?: string | null
  stepType: string
  status?: WorkflowStepStatus
  sequence: number
  metadata?: Record<string, unknown> | null
  startedAt?: string | null
  completedAt?: string | null
}

export class WorkflowRunRepository {
  async create(
    data: WorkflowRunCreateData,
    executor: DbExecutor = pool,
  ): Promise<OfficeWorkflowRun> {
    const { rows } = await executor.query<OfficeWorkflowRunRecord>(
      `INSERT INTO workflow_runs (
        office_id, root_task_id, status, started_at, completed_at, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`,
      [
        data.officeId,
        data.rootTaskId ?? null,
        data.status ?? 'pending',
        data.startedAt ?? null,
        data.completedAt ?? null,
        jsonbOrNull(data.metadata),
      ],
    )
    return toOfficeWorkflowRun(rows[0])
  }

  async getById(id: string, executor: DbExecutor = pool): Promise<OfficeWorkflowRun | null> {
    const { rows } = await executor.query<OfficeWorkflowRunRecord>(
      'SELECT * FROM workflow_runs WHERE id = $1',
      [id],
    )
    return rows[0] ? toOfficeWorkflowRun(rows[0]) : null
  }

  async listByOffice(
    officeId: string,
    executor: DbExecutor = pool,
  ): Promise<OfficeWorkflowRun[]> {
    const { rows } = await executor.query<OfficeWorkflowRunRecord>(
      'SELECT * FROM workflow_runs WHERE office_id = $1 ORDER BY created_at DESC',
      [officeId],
    )
    return rows.map(toOfficeWorkflowRun)
  }

  async listByTask(
    taskId: string,
    executor: DbExecutor = pool,
  ): Promise<OfficeWorkflowRun[]> {
    const { rows } = await executor.query<OfficeWorkflowRunRecord>(
      'SELECT * FROM workflow_runs WHERE root_task_id = $1 ORDER BY created_at DESC',
      [taskId],
    )
    return rows.map(toOfficeWorkflowRun)
  }

  async updateStatus(
    id: string,
    status: WorkflowRunStatus,
    executor: DbExecutor = pool,
  ): Promise<OfficeWorkflowRun | null> {
    const { rows } = await executor.query<OfficeWorkflowRunRecord>(
      `UPDATE workflow_runs
       SET status = $1,
           started_at = COALESCE(started_at, CASE WHEN $1 = 'running' THEN NOW() END),
           completed_at = CASE WHEN $1 IN ('completed','failed','cancelled') THEN NOW() ELSE completed_at END,
           updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [status, id],
    )
    return rows[0] ? toOfficeWorkflowRun(rows[0]) : null
  }

  async delete(id: string, executor: DbExecutor = pool): Promise<boolean> {
    const result = await executor.query('DELETE FROM workflow_runs WHERE id = $1', [id])
    return (result.rowCount ?? 0) > 0
  }

  async createStep(
    data: WorkflowStepCreateData,
    executor: DbExecutor = pool,
  ): Promise<OfficeWorkflowStep> {
    const { rows } = await executor.query<OfficeWorkflowStepRecord>(
      `INSERT INTO workflow_steps (
        workflow_run_id, task_id, step_type, status, sequence, metadata,
        started_at, completed_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        data.workflowRunId,
        data.taskId ?? null,
        data.stepType,
        data.status ?? 'pending',
        data.sequence,
        jsonbOrNull(data.metadata),
        data.startedAt ?? null,
        data.completedAt ?? null,
      ],
    )
    return toOfficeWorkflowStep(rows[0])
  }

  async getStepById(
    id: string,
    executor: DbExecutor = pool,
  ): Promise<OfficeWorkflowStep | null> {
    const { rows } = await executor.query<OfficeWorkflowStepRecord>(
      'SELECT * FROM workflow_steps WHERE id = $1',
      [id],
    )
    return rows[0] ? toOfficeWorkflowStep(rows[0]) : null
  }

  async getStepByTaskId(
    taskId: string,
    executor: DbExecutor = pool,
  ): Promise<OfficeWorkflowStep | null> {
    const { rows } = await executor.query<OfficeWorkflowStepRecord>(
      `SELECT s.*
       FROM workflow_steps s
       JOIN workflow_runs r ON r.id = s.workflow_run_id
       WHERE s.task_id = $1 AND r.status = 'running'
       ORDER BY s.created_at DESC
       LIMIT 1`,
      [taskId],
    )
    return rows[0] ? toOfficeWorkflowStep(rows[0]) : null
  }

  async listSteps(
    workflowRunId: string,
    executor: DbExecutor = pool,
  ): Promise<OfficeWorkflowStep[]> {
    const { rows } = await executor.query<OfficeWorkflowStepRecord>(
      'SELECT * FROM workflow_steps WHERE workflow_run_id = $1 ORDER BY sequence ASC, created_at ASC',
      [workflowRunId],
    )
    return rows.map(toOfficeWorkflowStep)
  }

  async updateStepStatus(
    id: string,
    status: WorkflowStepStatus,
    executor: DbExecutor = pool,
  ): Promise<OfficeWorkflowStep | null> {
    const { rows } = await executor.query<OfficeWorkflowStepRecord>(
      `UPDATE workflow_steps
       SET status = $1,
           started_at = COALESCE(started_at, CASE WHEN $1 = 'working' THEN NOW() END),
           completed_at = CASE WHEN $1 IN ('completed','failed','cancelled') THEN NOW() ELSE completed_at END,
           updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [status, id],
    )
    return rows[0] ? toOfficeWorkflowStep(rows[0]) : null
  }
}
