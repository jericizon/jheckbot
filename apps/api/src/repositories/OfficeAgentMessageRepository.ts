import type { MessageType, OfficeAgentMessage } from '@jheckbot/shared'
import { pool, type DbExecutor } from '../db/pool.js'

export interface OfficeAgentMessageRecord {
  id: string
  office_id: string
  task_id: string | null
  from_agent_id: string | null
  to_agent_id: string | null
  type: string
  content: string
  metadata: unknown
  created_at: unknown
}

function asIsoString(value: unknown): string {
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'string') return value
  return String(value ?? '')
}

function parseRecord(value: unknown): Record<string, unknown> | undefined {
  if (typeof value === 'object' && value !== null) return value as Record<string, unknown>
  return undefined
}

function jsonbOrNull(value: Record<string, unknown> | null | undefined): string | null {
  if (value === undefined || value === null) return null
  return JSON.stringify(value)
}

export function toOfficeAgentMessage(row: OfficeAgentMessageRecord): OfficeAgentMessage {
  return {
    id: row.id,
    officeId: row.office_id,
    taskId: row.task_id ?? undefined,
    fromAgentId: row.from_agent_id ?? undefined,
    toAgentId: row.to_agent_id ?? undefined,
    type: row.type as MessageType,
    content: row.content,
    metadata: parseRecord(row.metadata),
    createdAt: asIsoString(row.created_at),
  }
}

export interface OfficeAgentMessageCreateData {
  officeId: string
  taskId?: string | null
  fromAgentId?: string | null
  toAgentId?: string | null
  type: MessageType
  content: string
  metadata?: Record<string, unknown> | null
}

export class OfficeAgentMessageRepository {
  async create(
    data: OfficeAgentMessageCreateData,
    executor: DbExecutor = pool,
  ): Promise<OfficeAgentMessage> {
    const { rows } = await executor.query<OfficeAgentMessageRecord>(
      `INSERT INTO agent_messages (
        office_id, task_id, from_agent_id, to_agent_id, type, content, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [
        data.officeId,
        data.taskId ?? null,
        data.fromAgentId ?? null,
        data.toAgentId ?? null,
        data.type,
        data.content,
        jsonbOrNull(data.metadata),
      ],
    )
    return toOfficeAgentMessage(rows[0])
  }

  async listByOffice(officeId: string, executor: DbExecutor = pool): Promise<OfficeAgentMessage[]> {
    const { rows } = await executor.query<OfficeAgentMessageRecord>(
      'SELECT * FROM agent_messages WHERE office_id = $1 ORDER BY created_at DESC',
      [officeId],
    )
    return rows.map(toOfficeAgentMessage)
  }

  async listByTask(taskId: string, executor: DbExecutor = pool): Promise<OfficeAgentMessage[]> {
    const { rows } = await executor.query<OfficeAgentMessageRecord>(
      'SELECT * FROM agent_messages WHERE task_id = $1 ORDER BY created_at DESC',
      [taskId],
    )
    return rows.map(toOfficeAgentMessage)
  }

  async listByAgent(agentId: string, executor: DbExecutor = pool): Promise<OfficeAgentMessage[]> {
    const { rows } = await executor.query<OfficeAgentMessageRecord>(
      `SELECT * FROM agent_messages
       WHERE from_agent_id = $1 OR to_agent_id = $1
       ORDER BY created_at DESC`,
      [agentId],
    )
    return rows.map(toOfficeAgentMessage)
  }

  async getById(id: string, executor: DbExecutor = pool): Promise<OfficeAgentMessage | null> {
    const { rows } = await executor.query<OfficeAgentMessageRecord>(
      'SELECT * FROM agent_messages WHERE id = $1',
      [id],
    )
    return rows[0] ? toOfficeAgentMessage(rows[0]) : null
  }

  async markRead(id: string, executor: DbExecutor = pool): Promise<OfficeAgentMessage | null> {
    const { rows } = await executor.query<OfficeAgentMessageRecord>(
      `UPDATE agent_messages
       SET metadata = COALESCE(metadata, '{}'::jsonb) || '{"read":true}'::jsonb
       WHERE id = $1
       RETURNING *`,
      [id],
    )
    return rows[0] ? toOfficeAgentMessage(rows[0]) : null
  }

  async getThread(
    rootId: string,
    executor: DbExecutor = pool,
  ): Promise<{ root: OfficeAgentMessage; replies: OfficeAgentMessage[] } | null> {
    const root = await this.getById(rootId, executor)
    if (!root) return null

    const condition = root.taskId ? 'task_id = $1' : 'office_id = $1'
    const value = root.taskId ?? root.officeId

    const { rows } = await executor.query<OfficeAgentMessageRecord>(
      `SELECT * FROM agent_messages
       WHERE ${condition}
         AND id != $2
         AND created_at >= $3
       ORDER BY created_at ASC`,
      [value, root.id, root.createdAt],
    )

    return { root, replies: rows.map(toOfficeAgentMessage) }
  }
}
