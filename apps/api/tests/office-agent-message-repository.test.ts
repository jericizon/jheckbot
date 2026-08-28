import { beforeEach, describe, expect, it, vi } from 'vitest'
import { pool } from '../src/db/pool.js'
import {
  OfficeAgentMessageRepository,
  toOfficeAgentMessage,
  type OfficeAgentMessageRecord,
} from '../src/repositories/OfficeAgentMessageRepository.js'

vi.mock('../src/db/pool.js', () => ({
  pool: { query: vi.fn(), on: vi.fn(), end: vi.fn() },
}))

function fakeMessageRecord(overrides: Partial<OfficeAgentMessageRecord> = {}): OfficeAgentMessageRecord {
  const now = new Date().toISOString()
  return {
    id: 'message-1',
    office_id: 'office-1',
    task_id: 'task-1',
    from_agent_id: 'agent-1',
    to_agent_id: 'agent-2',
    type: 'HANDOFF',
    content: 'Handing this off to you.',
    metadata: { priority: 'high' },
    created_at: now,
    ...overrides,
  }
}

describe('OfficeAgentMessageRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates a message and maps the row to the shared domain type', async () => {
    const record = fakeMessageRecord()
    vi.mocked(pool.query).mockResolvedValue({ rows: [record] } as never)
    const repo = new OfficeAgentMessageRepository()

    const result = await repo.create({
      officeId: 'office-1',
      taskId: 'task-1',
      fromAgentId: 'agent-1',
      toAgentId: 'agent-2',
      type: 'HANDOFF',
      content: 'Handing this off to you.',
      metadata: { priority: 'high' },
    })

    expect(result).toEqual(toOfficeAgentMessage(record))
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO agent_messages'),
      expect.arrayContaining([
        'office-1',
        'task-1',
        'agent-1',
        'agent-2',
        'HANDOFF',
        'Handing this off to you.',
        JSON.stringify({ priority: 'high' }),
      ]),
    )
  })

  it('creates a message with minimal fields and null defaults', async () => {
    const record = fakeMessageRecord({
      task_id: null,
      from_agent_id: null,
      to_agent_id: null,
      metadata: null,
    })
    vi.mocked(pool.query).mockResolvedValue({ rows: [record] } as never)
    const repo = new OfficeAgentMessageRepository()

    const result = await repo.create({
      officeId: 'office-1',
      type: 'PROGRESS',
      content: 'Making progress.',
    })

    expect(result).toEqual(toOfficeAgentMessage(record))
    const [, params] = vi.mocked(pool.query).mock.calls[0]
    expect(params).toContain(null)
  })

  it('lists messages by office in descending creation order', async () => {
    const record = fakeMessageRecord()
    vi.mocked(pool.query).mockResolvedValue({ rows: [record] } as never)
    const repo = new OfficeAgentMessageRepository()

    const result = await repo.listByOffice('office-1')

    expect(result).toEqual([toOfficeAgentMessage(record)])
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE office_id = $1'),
      ['office-1'],
    )
  })

  it('lists messages by task', async () => {
    const record = fakeMessageRecord()
    vi.mocked(pool.query).mockResolvedValue({ rows: [record] } as never)
    const repo = new OfficeAgentMessageRepository()

    const result = await repo.listByTask('task-1')

    expect(result).toEqual([toOfficeAgentMessage(record)])
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE task_id = $1'),
      ['task-1'],
    )
  })

  it('lists messages by agent as sender or recipient', async () => {
    const record = fakeMessageRecord()
    vi.mocked(pool.query).mockResolvedValue({ rows: [record] } as never)
    const repo = new OfficeAgentMessageRepository()

    const result = await repo.listByAgent('agent-1')

    expect(result).toEqual([toOfficeAgentMessage(record)])
    const [sql, params] = vi.mocked(pool.query).mock.calls[0]
    expect(sql).toContain('from_agent_id = $1 OR to_agent_id = $1')
    expect(params).toEqual(['agent-1'])
  })

  it('gets a message by id', async () => {
    const record = fakeMessageRecord()
    vi.mocked(pool.query).mockResolvedValue({ rows: [record] } as never)
    const repo = new OfficeAgentMessageRepository()

    const result = await repo.getById('message-1')

    expect(result).toEqual(toOfficeAgentMessage(record))
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('SELECT * FROM agent_messages WHERE id = $1'),
      ['message-1'],
    )
  })

  it('returns null when getting a missing message', async () => {
    vi.mocked(pool.query).mockResolvedValue({ rows: [] } as never)
    const repo = new OfficeAgentMessageRepository()

    await expect(repo.getById('missing')).resolves.toBeNull()
  })

  it('marks a message as read by updating metadata', async () => {
    const record = fakeMessageRecord({
      metadata: { priority: 'high', read: true },
    })
    vi.mocked(pool.query).mockResolvedValue({ rows: [record] } as never)
    const repo = new OfficeAgentMessageRepository()

    const result = await repo.markRead('message-1')

    expect(result).toEqual(toOfficeAgentMessage(record))
    const [sql] = vi.mocked(pool.query).mock.calls[0]
    expect(sql).toContain('UPDATE agent_messages')
    expect(sql).toContain('"read":true')
  })

  it('returns null when marking a missing message as read', async () => {
    vi.mocked(pool.query).mockResolvedValue({ rows: [] } as never)
    const repo = new OfficeAgentMessageRepository()

    await expect(repo.markRead('missing')).resolves.toBeNull()
  })

  it('gets a thread for a message with a task', async () => {
    const root = fakeMessageRecord({ id: 'root-1', task_id: 'task-1', created_at: '2026-01-01T00:00:00.000Z' })
    const reply = fakeMessageRecord({
      id: 'reply-1',
      task_id: 'task-1',
      created_at: '2026-01-01T00:01:00.000Z',
    })
    vi.mocked(pool.query)
      .mockResolvedValueOnce({ rows: [root] } as never)
      .mockResolvedValueOnce({ rows: [reply] } as never)

    const repo = new OfficeAgentMessageRepository()
    const result = await repo.getThread('root-1')

    expect(result).toEqual({
      root: toOfficeAgentMessage(root),
      replies: [toOfficeAgentMessage(reply)],
    })
    const [listSql, listParams] = vi.mocked(pool.query).mock.calls[1]
    expect(listSql).toContain('task_id = $1')
    expect(listParams).toEqual(['task-1', 'root-1', root.created_at])
  })

  it('gets a thread for a message without a task using the office', async () => {
    const root = fakeMessageRecord({
      id: 'root-1',
      task_id: null,
      created_at: '2026-01-01T00:00:00.000Z',
    })
    const reply = fakeMessageRecord({
      id: 'reply-1',
      task_id: null,
      created_at: '2026-01-01T00:01:00.000Z',
    })
    vi.mocked(pool.query)
      .mockResolvedValueOnce({ rows: [root] } as never)
      .mockResolvedValueOnce({ rows: [reply] } as never)

    const repo = new OfficeAgentMessageRepository()
    const result = await repo.getThread('root-1')

    expect(result).toEqual({
      root: toOfficeAgentMessage(root),
      replies: [toOfficeAgentMessage(reply)],
    })
    const [listSql, listParams] = vi.mocked(pool.query).mock.calls[1]
    expect(listSql).toContain('office_id = $1')
    expect(listParams).toEqual(['office-1', 'root-1', root.created_at])
  })

  it('returns null when getting a thread for a missing message', async () => {
    vi.mocked(pool.query).mockResolvedValue({ rows: [] } as never)
    const repo = new OfficeAgentMessageRepository()

    await expect(repo.getThread('missing')).resolves.toBeNull()
  })
})
