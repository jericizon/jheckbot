import { pool, type DbExecutor } from '../db/pool.js'

export interface AgentEventRecord {
  id: string
  conversation_id: string
  event_type: string
  content: string | null
  event_sequence: string
  created_at: string
}

function normalizeSequenceCursor(cursor: string): string {
  return /^\d+$/.test(cursor) ? cursor : '0'
}

export class AgentEventRepository {
  async create(
    data: {
      conversationId: string
      eventType: string
      content?: string
    },
    executor: DbExecutor = pool,
  ): Promise<AgentEventRecord> {
    const { rows } = await executor.query<AgentEventRecord>(
      `INSERT INTO agent_events (conversation_id, event_type, content)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [data.conversationId, data.eventType, data.content ?? null],
    )
    return rows[0]
  }

  async findByConversation(
    conversationId: string,
    sinceSequence?: string,
    executor: DbExecutor = pool,
  ): Promise<AgentEventRecord[]> {
    if (sinceSequence !== undefined) {
      const cursor = normalizeSequenceCursor(sinceSequence)
      const { rows } = await executor.query<AgentEventRecord>(
        `SELECT * FROM agent_events
         WHERE conversation_id = $1 AND event_sequence > $2
         ORDER BY event_sequence ASC`,
        [conversationId, cursor],
      )
      return rows
    }
    const { rows } = await executor.query<AgentEventRecord>(
      `SELECT * FROM agent_events
       WHERE conversation_id = $1
       ORDER BY event_sequence ASC`,
      [conversationId],
    )
    return rows
  }
}
