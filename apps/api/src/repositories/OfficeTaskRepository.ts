import type { OfficeTask, OfficeTaskDependency, TaskPriority, TaskStatus } from '@jheckbot/shared'
import { pool, type DbExecutor } from '../db/pool.js'

export interface OfficeTaskRecord {
  id: string
  office_id: string
  project_id: string | null
  parent_task_id: string | null
  title: string
  description: string | null
  acceptance_criteria: string | null
  status: string
  priority: string
  assigned_agent_id: string | null
  created_by: string | null
  workflow_type: string | null
  metadata: unknown
  started_at: unknown
  completed_at: unknown
  created_at: unknown
  updated_at: unknown
}

export interface OfficeTaskDependencyRecord {
  task_id: string
  depends_on_task_id: string
  created_at: unknown
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

function coalesceDate(
  value: string | null | undefined,
  existing: string | undefined,
): string | null {
  if (value === null) return null
  if (typeof value === 'string') return value
  return existing ?? null
}

export function toOfficeTask(row: OfficeTaskRecord): OfficeTask {
  return {
    id: row.id,
    officeId: row.office_id,
    projectId: row.project_id ?? undefined,
    parentTaskId: row.parent_task_id ?? undefined,
    title: row.title,
    description: row.description ?? undefined,
    acceptanceCriteria: row.acceptance_criteria ?? undefined,
    status: row.status as TaskStatus,
    priority: row.priority as TaskPriority,
    assignedAgentId: row.assigned_agent_id ?? undefined,
    createdBy: row.created_by ?? undefined,
    workflowType: row.workflow_type ?? undefined,
    metadata: parseRecord(row.metadata),
    startedAt: asOptionalTimestamp(row.started_at),
    completedAt: asOptionalTimestamp(row.completed_at),
    createdAt: asIsoString(row.created_at),
    updatedAt: asIsoString(row.updated_at),
  }
}

export function toOfficeTaskDependency(row: OfficeTaskDependencyRecord): OfficeTaskDependency {
  return {
    taskId: row.task_id,
    dependsOnTaskId: row.depends_on_task_id,
    createdAt: asIsoString(row.created_at),
  }
}

export interface OfficeTaskCreateData {
  officeId: string
  projectId?: string | null
  parentTaskId?: string | null
  title: string
  description?: string | null
  acceptanceCriteria?: string | null
  status?: TaskStatus
  priority?: TaskPriority
  assignedAgentId?: string | null
  createdBy?: string | null
  workflowType?: string | null
  metadata?: Record<string, unknown> | null
  startedAt?: string | null
  completedAt?: string | null
}

export interface OfficeTaskUpdateData {
  officeId?: string
  projectId?: string | null
  parentTaskId?: string | null
  title?: string
  description?: string | null
  acceptanceCriteria?: string | null
  status?: TaskStatus
  priority?: TaskPriority
  assignedAgentId?: string | null
  createdBy?: string | null
  workflowType?: string | null
  metadata?: Record<string, unknown> | null
  startedAt?: string | null
  completedAt?: string | null
}

export class OfficeTaskRepository {
  async create(data: OfficeTaskCreateData, executor: DbExecutor = pool): Promise<OfficeTask> {
    const { rows } = await executor.query<OfficeTaskRecord>(
      `INSERT INTO tasks (
        office_id, project_id, parent_task_id, title, description, acceptance_criteria,
        status, priority, assigned_agent_id, created_by, workflow_type, metadata,
        started_at, completed_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *`,
      [
        data.officeId,
        data.projectId ?? null,
        data.parentTaskId ?? null,
        data.title,
        data.description ?? null,
        data.acceptanceCriteria ?? null,
        data.status ?? 'backlog',
        data.priority ?? 'medium',
        data.assignedAgentId ?? null,
        data.createdBy ?? null,
        data.workflowType ?? null,
        jsonbOrNull(data.metadata),
        data.startedAt ?? null,
        data.completedAt ?? null,
      ],
    )
    return toOfficeTask(rows[0])
  }

  async listByOffice(officeId: string, executor: DbExecutor = pool): Promise<OfficeTask[]> {
    const { rows } = await executor.query<OfficeTaskRecord>(
      'SELECT * FROM tasks WHERE office_id = $1 ORDER BY created_at DESC',
      [officeId],
    )
    return rows.map(toOfficeTask)
  }

  async getById(id: string, executor: DbExecutor = pool): Promise<OfficeTask | null> {
    const { rows } = await executor.query<OfficeTaskRecord>('SELECT * FROM tasks WHERE id = $1', [
      id,
    ])
    return rows[0] ? toOfficeTask(rows[0]) : null
  }

  async update(
    id: string,
    data: OfficeTaskUpdateData,
    executor: DbExecutor = pool,
  ): Promise<OfficeTask | null> {
    const existing = await this.getById(id, executor)
    if (!existing) return null

    const { rows } = await executor.query<OfficeTaskRecord>(
      `UPDATE tasks
       SET office_id = $1, project_id = $2, parent_task_id = $3, title = $4,
           description = $5, acceptance_criteria = $6, status = $7, priority = $8,
           assigned_agent_id = $9, created_by = $10, workflow_type = $11,
           metadata = $12, started_at = $13, completed_at = $14, updated_at = NOW()
       WHERE id = $15
       RETURNING *`,
      [
        data.officeId ?? existing.officeId,
        data.projectId !== undefined ? (data.projectId ?? null) : (existing.projectId ?? null),
        data.parentTaskId !== undefined
          ? (data.parentTaskId ?? null)
          : (existing.parentTaskId ?? null),
        data.title ?? existing.title,
        data.description !== undefined
          ? (data.description ?? null)
          : (existing.description ?? null),
        data.acceptanceCriteria !== undefined
          ? (data.acceptanceCriteria ?? null)
          : (existing.acceptanceCriteria ?? null),
        data.status ?? existing.status,
        data.priority ?? existing.priority,
        data.assignedAgentId !== undefined
          ? (data.assignedAgentId ?? null)
          : (existing.assignedAgentId ?? null),
        data.createdBy !== undefined ? (data.createdBy ?? null) : (existing.createdBy ?? null),
        data.workflowType !== undefined
          ? (data.workflowType ?? null)
          : (existing.workflowType ?? null),
        data.metadata !== undefined ? jsonbOrNull(data.metadata) : jsonbOrNull(existing.metadata),
        coalesceDate(data.startedAt, existing.startedAt),
        coalesceDate(data.completedAt, existing.completedAt),
        id,
      ],
    )
    return rows[0] ? toOfficeTask(rows[0]) : null
  }

  async delete(id: string, executor: DbExecutor = pool): Promise<boolean> {
    const result = await executor.query('DELETE FROM tasks WHERE id = $1', [id])
    return (result.rowCount ?? 0) > 0
  }

  async setStatus(
    id: string,
    status: TaskStatus,
    executor: DbExecutor = pool,
  ): Promise<OfficeTask | null> {
    const { rows } = await executor.query<OfficeTaskRecord>(
      'UPDATE tasks SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [status, id],
    )
    return rows[0] ? toOfficeTask(rows[0]) : null
  }

  async listDependencies(taskId: string, executor: DbExecutor = pool): Promise<OfficeTask[]> {
    const { rows } = await executor.query<OfficeTaskRecord>(
      `SELECT t.*
       FROM task_dependencies td
       JOIN tasks t ON t.id = td.depends_on_task_id
       WHERE td.task_id = $1
       ORDER BY t.created_at DESC`,
      [taskId],
    )
    return rows.map(toOfficeTask)
  }

  async addDependency(
    taskId: string,
    dependsOnTaskId: string,
    executor: DbExecutor = pool,
  ): Promise<OfficeTaskDependency | null> {
    const { rows } = await executor.query<OfficeTaskDependencyRecord>(
      `INSERT INTO task_dependencies (task_id, depends_on_task_id)
       VALUES ($1, $2)
       ON CONFLICT (task_id, depends_on_task_id) DO NOTHING
       RETURNING *`,
      [taskId, dependsOnTaskId],
    )
    if (rows[0]) return toOfficeTaskDependency(rows[0])

    const { rows: existing } = await executor.query<OfficeTaskDependencyRecord>(
      'SELECT * FROM task_dependencies WHERE task_id = $1 AND depends_on_task_id = $2',
      [taskId, dependsOnTaskId],
    )
    return existing[0] ? toOfficeTaskDependency(existing[0]) : null
  }

  async removeDependency(
    taskId: string,
    dependsOnTaskId: string,
    executor: DbExecutor = pool,
  ): Promise<boolean> {
    const result = await executor.query(
      'DELETE FROM task_dependencies WHERE task_id = $1 AND depends_on_task_id = $2',
      [taskId, dependsOnTaskId],
    )
    return (result.rowCount ?? 0) > 0
  }

  async getDependents(taskId: string, executor: DbExecutor = pool): Promise<OfficeTask[]> {
    const { rows } = await executor.query<OfficeTaskRecord>(
      `SELECT t.*
       FROM task_dependencies td
       JOIN tasks t ON t.id = td.task_id
       WHERE td.depends_on_task_id = $1
       ORDER BY t.created_at DESC`,
      [taskId],
    )
    return rows.map(toOfficeTask)
  }
}
