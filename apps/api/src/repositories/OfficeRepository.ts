import type { Office } from '@jheckbot/shared'
import { pool, type DbExecutor } from '../db/pool.js'

export interface OfficeRecord {
  id: string
  name: string
  project_id: string | null
  user_id: string | null
  status: string
  config: unknown
  created_at: unknown
  updated_at: unknown
}

export interface OfficeCreateData {
  name: string
  projectId?: string
  userId?: string
  status?: string
  config?: Record<string, unknown>
}

function toOffice(row: OfficeRecord): Office {
  return {
    id: row.id,
    name: row.name,
    projectId: row.project_id ?? undefined,
    userId: row.user_id ?? undefined,
    status: row.status as Office['status'],
    config: (typeof row.config === 'object' && row.config !== null
      ? row.config
      : undefined) as Record<string, unknown> | undefined,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
  }
}

export class OfficeRepository {
  async findByProjectId(projectId: string, executor: DbExecutor = pool): Promise<Office | null> {
    const { rows } = await executor.query<OfficeRecord>(
      'SELECT * FROM offices WHERE project_id = $1 ORDER BY created_at ASC LIMIT 1',
      [projectId],
    )
    return rows[0] ? toOffice(rows[0]) : null
  }

  async findById(id: string, executor: DbExecutor = pool): Promise<Office | null> {
    const { rows } = await executor.query<OfficeRecord>(
      'SELECT * FROM offices WHERE id = $1',
      [id],
    )
    return rows[0] ? toOffice(rows[0]) : null
  }

  async create(data: OfficeCreateData, executor: DbExecutor = pool): Promise<Office> {
    const { rows } = await executor.query<OfficeRecord>(
      `INSERT INTO offices (name, project_id, user_id, status, config)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        data.name,
        data.projectId ?? null,
        data.userId ?? null,
        data.status ?? 'active',
        data.config ? JSON.stringify(data.config) : null,
      ],
    )
    return toOffice(rows[0])
  }
}
