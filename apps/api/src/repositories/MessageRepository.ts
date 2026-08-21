import { pool, type DbExecutor } from '../db/pool.js'

export interface MessageRecord {
  id: string
  conversation_id: string
  role: string
  content: string
  message_type: string
  created_at: string
}

export class MessageRepository {
  async findByConversation(
    conversationId: string,
    limit = 100,
    offset = 0,
    executor: DbExecutor = pool,
  ): Promise<MessageRecord[]> {
    const { rows } = await executor.query<MessageRecord>(
      `SELECT * FROM messages
       WHERE conversation_id = $1
       ORDER BY created_at ASC
       LIMIT $2 OFFSET $3`,
      [conversationId, limit, offset],
    )
    return rows
  }

  async create(
    data: {
      conversationId: string
      role: string
      content: string
      messageType?: string
    },
    executor: DbExecutor = pool,
  ): Promise<MessageRecord> {
    const defaultMessageType =
      data.role === 'user' ? 'prompt' : data.role === 'assistant' ? 'output' : 'status'
    const { rows } = await executor.query<MessageRecord>(
      `INSERT INTO messages (conversation_id, role, content, message_type)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [data.conversationId, data.role, data.content, data.messageType ?? defaultMessageType],
    )
    return rows[0]
  }

  async countByConversation(conversationId: string, executor: DbExecutor = pool): Promise<number> {
    const { rows } = await executor.query<{ count: string }>(
      'SELECT COUNT(*) as count FROM messages WHERE conversation_id = $1',
      [conversationId],
    )
    return Number(rows[0].count)
  }
}
