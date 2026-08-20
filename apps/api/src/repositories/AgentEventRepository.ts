import { pool } from '../db/pool.js'

export interface AgentEventRecord {
  id: string
  conversation_id: string
  event_type: string
  content: string | null
  created_at: string
}

export class AgentEventRepository {
  async create(data: {
    conversationId: string
    eventType: string
    content?: string
  }): Promise<AgentEventRecord> {
    const { rows } = await pool.query<AgentEventRecord>(
      `INSERT INTO agent_events (conversation_id, event_type, content)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [data.conversationId, data.eventType, data.content ?? null],
    )
    return rows[0]
  }

  async findByConversation(conversationId: string, sinceId?: string): Promise<AgentEventRecord[]> {
    if (sinceId) {
      const { rows } = await pool.query<AgentEventRecord>(
        `SELECT * FROM agent_events
         WHERE conversation_id = $1 AND id > $2
         ORDER BY created_at ASC`,
        [conversationId, sinceId],
      )
      return rows
    }
    const { rows } = await pool.query<AgentEventRecord>(
      `SELECT * FROM agent_events
       WHERE conversation_id = $1
       ORDER BY created_at ASC`,
      [conversationId],
    )
    return rows
  }
}
