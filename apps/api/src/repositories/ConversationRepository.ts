import { pool, type DbExecutor } from '../db/pool.js'

export interface ConversationRecord {
  id: string
  project_id: string
  title: string
  status: string
  agent_type: string
  agent_session_id: string | null
  agent_status: string
  created_at: string
  updated_at: string
  last_message_at: string | null
}

export interface SearchResult {
  conversation_id: string
  project_id: string
  project_name: string
  conversation_title: string
  created_at: string
}

export class ConversationRepository {
  async findByProject(
    projectId: string,
    executor: DbExecutor = pool,
  ): Promise<ConversationRecord[]> {
    const { rows } = await executor.query<ConversationRecord>(
      `SELECT * FROM conversations WHERE project_id = $1 ORDER BY last_message_at DESC NULLS LAST, created_at DESC`,
      [projectId],
    )
    return rows
  }

  async findById(id: string, executor: DbExecutor = pool): Promise<ConversationRecord | null> {
    const { rows } = await executor.query<ConversationRecord>(
      'SELECT * FROM conversations WHERE id = $1',
      [id],
    )
    return rows[0] ?? null
  }

  async findByIdForUpdate(
    id: string,
    executor: DbExecutor = pool,
  ): Promise<ConversationRecord | null> {
    const { rows } = await executor.query<ConversationRecord>(
      'SELECT * FROM conversations WHERE id = $1 FOR UPDATE',
      [id],
    )
    return rows[0] ?? null
  }

  async create(
    data: {
      projectId: string
      title?: string
    },
    executor: DbExecutor = pool,
  ): Promise<ConversationRecord> {
    const { rows } = await executor.query<ConversationRecord>(
      `INSERT INTO conversations (project_id, title)
       VALUES ($1, $2)
       RETURNING *`,
      [data.projectId, data.title ?? 'New Conversation'],
    )
    return rows[0]
  }

  async update(
    id: string,
    data: { title?: string; status?: string; agentSessionId?: string; agentStatus?: string },
    executor: DbExecutor = pool,
  ): Promise<ConversationRecord | null> {
    const existing = await this.findById(id, executor)
    if (!existing) return null

    const { rows } = await executor.query<ConversationRecord>(
      `UPDATE conversations
       SET title = $1, status = $2, agent_session_id = $3, agent_status = $4,
           updated_at = NOW()
       WHERE id = $5
       RETURNING *`,
      [
        data.title ?? existing.title,
        data.status ?? existing.status,
        data.agentSessionId ?? existing.agent_session_id,
        data.agentStatus ?? existing.agent_status,
        id,
      ],
    )
    return rows[0] ?? null
  }

  async delete(id: string, executor: DbExecutor = pool): Promise<boolean> {
    const result = await executor.query('DELETE FROM conversations WHERE id = $1', [id])
    return (result.rowCount ?? 0) > 0
  }

  async touchLastMessage(id: string, executor: DbExecutor = pool): Promise<void> {
    await executor.query(
      'UPDATE conversations SET last_message_at = NOW(), updated_at = NOW() WHERE id = $1',
      [id],
    )
  }

  async setAgentStatus(
    id: string,
    agentStatus: string,
    executor: DbExecutor = pool,
  ): Promise<void> {
    await executor.query(
      'UPDATE conversations SET agent_status = $1, updated_at = NOW() WHERE id = $2',
      [agentStatus, id],
    )
  }

  async updateAgentStatus(
    id: string,
    agentStatus: string,
    executor: DbExecutor = pool,
  ): Promise<void> {
    await this.setAgentStatus(id, agentStatus, executor)
  }

  async updateAgentSessionId(
    id: string,
    sessionId: string,
    executor: DbExecutor = pool,
  ): Promise<void> {
    await executor.query(
      'UPDATE conversations SET agent_session_id = $1, updated_at = NOW() WHERE id = $2',
      [sessionId, id],
    )
  }

  async countActiveAgents(executor: DbExecutor = pool): Promise<number> {
    const { rows } = await executor.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM conversations
       WHERE agent_status IN ('starting', 'running', 'stopping')`,
    )
    return Number(rows[0].count)
  }

  async search(query: string, executor: DbExecutor = pool): Promise<SearchResult[]> {
    const { rows } = await executor.query<SearchResult>(
      `SELECT c.id AS conversation_id, c.project_id, p.name AS project_name,
              c.title AS conversation_title, c.created_at
       FROM conversations c
       JOIN projects p ON c.project_id = p.id
       WHERE c.status != 'deleted'
         AND (c.title ILIKE '%' || $1 || '%'
              OR EXISTS (
                SELECT 1 FROM messages m WHERE m.conversation_id = c.id AND m.content ILIKE '%' || $1 || '%'
              )
              OR p.name ILIKE '%' || $1 || '%')
       ORDER BY c.last_message_at DESC NULLS LAST, c.created_at DESC
       LIMIT 50`,
      [query],
    )
    return rows
  }
}
