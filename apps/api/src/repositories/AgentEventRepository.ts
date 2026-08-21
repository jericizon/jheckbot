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

  /**
   * Find the event sequence of the most recent `starting` status event.
   * Used by the SSE endpoint to replay only the current run's events on
   * first connect, avoiding replay of historical completed runs that would
   * cause the frontend to close the stream prematurely.
   */
  async findLatestRunStart(
    conversationId: string,
    executor: DbExecutor = pool,
  ): Promise<string | null> {
    const { rows } = await executor.query<{ event_sequence: string }>(
      `SELECT event_sequence FROM agent_events
       WHERE conversation_id = $1
         AND event_type = 'status'
         AND content ~ '"status"\\s*:\\s*"starting"'
       ORDER BY event_sequence DESC
       LIMIT 1`,
      [conversationId],
    )
    return rows[0]?.event_sequence ?? null
  }
}
