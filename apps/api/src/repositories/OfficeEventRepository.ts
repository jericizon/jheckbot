import type { EventType, OfficeEvent } from '@jheckbot/shared'
import { pool, type DbExecutor } from '../db/pool.js'

export interface OfficeEventRecord {
  id: string
  office_id: string
  event_type: string
  content: string | null
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

export function toOfficeEvent(row: OfficeEventRecord): OfficeEvent {
  return {
    id: row.id,
    officeId: row.office_id,
    eventType: row.event_type as EventType,
    content: row.content ?? undefined,
    metadata: parseRecord(row.metadata),
    createdAt: asIsoString(row.created_at),
  }
}

export interface OfficeEventCreateData {
  officeId: string
  eventType: EventType
  content?: string | null
  metadata?: Record<string, unknown> | null
}

export class OfficeEventRepository {
  async create(data: OfficeEventCreateData, executor: DbExecutor = pool): Promise<OfficeEvent> {
    const { rows } = await executor.query<OfficeEventRecord>(
      `INSERT INTO office_events (office_id, event_type, content, metadata)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [data.officeId, data.eventType, data.content ?? null, jsonbOrNull(data.metadata)],
    )
    return toOfficeEvent(rows[0])
  }

  async getById(id: string, executor: DbExecutor = pool): Promise<OfficeEvent | null> {
    const { rows } = await executor.query<OfficeEventRecord>(
      'SELECT * FROM office_events WHERE id = $1',
      [id],
    )
    if (rows.length === 0) return null
    return toOfficeEvent(rows[0])
  }

  async listByOffice(officeId: string, executor: DbExecutor = pool): Promise<OfficeEvent[]> {
    const { rows } = await executor.query<OfficeEventRecord>(
      'SELECT * FROM office_events WHERE office_id = $1 ORDER BY created_at DESC',
      [officeId],
    )
    return rows.map(toOfficeEvent)
  }

  async listByOfficeAndTypes(
    officeId: string,
    eventTypes: string[],
    executor: DbExecutor = pool,
  ): Promise<OfficeEvent[]> {
    const { rows } = await executor.query<OfficeEventRecord>(
      'SELECT * FROM office_events WHERE office_id = $1 AND event_type = ANY($2::text[]) ORDER BY created_at DESC',
      [officeId, eventTypes],
    )
    return rows.map(toOfficeEvent)
  }

  async officeExists(officeId: string, executor: DbExecutor = pool): Promise<boolean> {
    const { rows } = await executor.query<{ exists: boolean }>(
      'SELECT EXISTS(SELECT 1 FROM offices WHERE id = $1) AS exists',
      [officeId],
    )
    return rows[0]?.exists === true
  }
}
