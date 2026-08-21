import { beforeEach, describe, expect, it, vi } from 'vitest'
import { pool } from '../src/db/pool.js'
import {
  AgentEventRepository,
  type AgentEventRecord,
} from '../src/repositories/AgentEventRepository.js'
import { ConversationRepository } from '../src/repositories/ConversationRepository.js'
import { MessageRepository } from '../src/repositories/MessageRepository.js'

vi.mock('../src/db/pool.js', () => ({
  pool: { query: vi.fn(), connect: vi.fn(), on: vi.fn(), end: vi.fn() },
}))

function fakeExecutor() {
  return { query: vi.fn().mockResolvedValue({ rows: [] }) }
}

const event: AgentEventRecord = {
  id: 'event-1',
  conversation_id: 'conversation-1',
  event_type: 'output',
  content: 'done',
  event_sequence: '12',
  created_at: new Date().toISOString(),
}

describe('AgentEventRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('uses the transaction executor when creating an event', async () => {
    const executor = fakeExecutor()
    executor.query.mockResolvedValue({ rows: [event] })
    const repository = new AgentEventRepository()

    await expect(
      repository.create(
        {
          conversationId: 'conversation-1',
          eventType: 'output',
          content: 'done',
        },
        executor as never,
      ),
    ).resolves.toEqual(event)

    expect(executor.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO agent_events'),
      ['conversation-1', 'output', 'done'],
    )
    expect(pool.query).not.toHaveBeenCalled()
  })

  it('replays events after a numeric sequence cursor in ascending order', async () => {
    const executor = fakeExecutor()
    executor.query.mockResolvedValue({ rows: [event] })
    const repository = new AgentEventRepository()

    await repository.findByConversation('conversation-1', '11', executor as never)

    const [sql, params] = executor.query.mock.calls[0]
    expect(sql).toContain('event_sequence > $2')
    expect(sql).toContain('ORDER BY event_sequence ASC')
    expect(sql).not.toContain('id > $2')
    expect(params).toEqual(['conversation-1', '11'])
  })

  it('replays from sequence zero for a legacy or unknown cursor', async () => {
    const executor = fakeExecutor()
    const repository = new AgentEventRepository()

    await repository.findByConversation('conversation-1', 'legacy-uuid-cursor', executor as never)

    const [sql, params] = executor.query.mock.calls[0]
    expect(sql).toContain('event_sequence > $2')
    expect(sql).toContain('ORDER BY event_sequence ASC')
    expect(params).toEqual(['conversation-1', '0'])
  })

  it('finds the latest starting status event sequence', async () => {
    const executor = fakeExecutor()
    executor.query.mockResolvedValue({ rows: [{ event_sequence: '7' }] })
    const repository = new AgentEventRepository()

    await expect(repository.findLatestRunStart('conversation-1', executor as never)).resolves.toBe('7')

    const [sql, params] = executor.query.mock.calls[0]
    expect(sql).toContain("event_type = 'status'")
    expect(sql).toContain('"status"\\s*:\\s*"starting"')
    expect(sql).toContain('ORDER BY event_sequence DESC')
    expect(sql).toContain('LIMIT 1')
    expect(params).toEqual(['conversation-1'])
  })

  it('returns null when no starting event exists', async () => {
    const executor = fakeExecutor()
    executor.query.mockResolvedValue({ rows: [] })
    const repository = new AgentEventRepository()

    await expect(repository.findLatestRunStart('conversation-1', executor as never)).resolves.toBeNull()
  })
})

describe('transaction-aware repositories', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('locks a conversation through the transaction executor', async () => {
    const executor = fakeExecutor()
    const repository = new ConversationRepository()

    await repository.findByIdForUpdate('conversation-1', executor as never)

    expect(executor.query).toHaveBeenCalledWith(
      'SELECT * FROM conversations WHERE id = $1 FOR UPDATE',
      ['conversation-1'],
    )
    expect(pool.query).not.toHaveBeenCalled()
  })

  it('counts active agent states through the transaction executor', async () => {
    const executor = fakeExecutor()
    executor.query.mockResolvedValue({ rows: [{ count: '2' }] })
    const repository = new ConversationRepository()

    await expect(repository.countActiveAgents(executor as never)).resolves.toBe(2)

    const [sql] = executor.query.mock.calls[0]
    expect(sql).toContain("agent_status IN ('starting', 'running', 'stopping')")
    expect(pool.query).not.toHaveBeenCalled()
  })

  it('sets agent status through the transaction executor', async () => {
    const executor = fakeExecutor()
    const repository = new ConversationRepository()

    await repository.setAgentStatus('conversation-1', 'starting', executor as never)

    expect(executor.query).toHaveBeenCalledWith(
      'UPDATE conversations SET agent_status = $1, updated_at = NOW() WHERE id = $2',
      ['starting', 'conversation-1'],
    )
    expect(pool.query).not.toHaveBeenCalled()
  })

  it('uses the transaction executor when creating a message', async () => {
    const executor = fakeExecutor()
    const message = {
      id: 'message-1',
      conversation_id: 'conversation-1',
      role: 'user',
      content: 'prompt',
      message_type: 'prompt',
      model: null,
      created_at: new Date().toISOString(),
    }
    executor.query.mockResolvedValue({ rows: [message] })
    const repository = new MessageRepository()

    await expect(
      repository.create(
        {
          conversationId: 'conversation-1',
          role: 'user',
          content: 'prompt',
        },
        executor as never,
      ),
    ).resolves.toEqual(message)

    expect(executor.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO messages'), [
      'conversation-1',
      'user',
      'prompt',
      'prompt',
      null,
    ])
    expect(pool.query).not.toHaveBeenCalled()
  })
})
