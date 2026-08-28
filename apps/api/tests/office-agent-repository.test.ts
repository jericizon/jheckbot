import { beforeEach, describe, expect, it, vi } from 'vitest'
import { pool } from '../src/db/pool.js'
import {
  OfficeAgentRepository,
  toOfficeAgent,
  toOfficeAgentCapability,
  type OfficeAgentRecord,
  type OfficeAgentCapabilityRecord,
} from '../src/repositories/OfficeAgentRepository.js'

vi.mock('../src/db/pool.js', () => ({
  pool: { query: vi.fn(), on: vi.fn(), end: vi.fn() },
}))

function fakeAgentRecord(overrides: Partial<OfficeAgentRecord> = {}): OfficeAgentRecord {
  const now = new Date().toISOString()
  return {
    id: 'agent-1',
    office_id: 'office-1',
    name: 'Alfred',
    role: 'Senior Backend Developer',
    description: 'Backend specialist',
    avatar: null,
    personality: 'Methodical',
    instructions: 'Follow conventions',
    responsibilities: 'Implement APIs',
    provider: 'devin',
    model: 'claude-sonnet-5',
    skills: ['PHP', 'Laravel'],
    tools: ['git', 'docker'],
    permissions: { canDeploy: true },
    project_access: ['project-1'],
    status: 'idle',
    enabled: true,
    created_at: now,
    updated_at: now,
    ...overrides,
  }
}

function fakeCapabilityRecord(
  overrides: Partial<OfficeAgentCapabilityRecord> = {},
): OfficeAgentCapabilityRecord {
  return {
    id: 'cap-1',
    agent_id: 'agent-1',
    capability: 'PHP',
    created_at: new Date().toISOString(),
    ...overrides,
  }
}

describe('OfficeAgentRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates an agent and maps the row to the shared domain type', async () => {
    const record = fakeAgentRecord()
    vi.mocked(pool.query).mockResolvedValue({ rows: [record] } as never)
    const repo = new OfficeAgentRepository()

    const result = await repo.create({
      officeId: 'office-1',
      name: 'Alfred',
      role: 'Senior Backend Developer',
      skills: ['PHP', 'Laravel'],
      tools: ['git', 'docker'],
      permissions: { canDeploy: true },
      projectAccess: ['project-1'],
    })

    expect(result).toEqual(toOfficeAgent(record))
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO agents'),
      expect.arrayContaining([
        'office-1',
        'Alfred',
        'Senior Backend Developer',
        'idle',
        true,
        JSON.stringify(['PHP', 'Laravel']),
        JSON.stringify(['git', 'docker']),
        JSON.stringify({ canDeploy: true }),
        JSON.stringify(['project-1']),
      ]),
    )
  })

  it('lists agents by office in descending creation order', async () => {
    const record = fakeAgentRecord()
    vi.mocked(pool.query).mockResolvedValue({ rows: [record] } as never)
    const repo = new OfficeAgentRepository()

    const result = await repo.listByOffice('office-1')

    expect(result).toEqual([toOfficeAgent(record)])
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE office_id = $1'),
      ['office-1'],
    )
  })

  it('gets an agent by id', async () => {
    const record = fakeAgentRecord()
    vi.mocked(pool.query).mockResolvedValue({ rows: [record] } as never)
    const repo = new OfficeAgentRepository()

    const result = await repo.getById('agent-1')

    expect(result).toEqual(toOfficeAgent(record))
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('SELECT * FROM agents WHERE id = $1'),
      ['agent-1'],
    )
  })

  it('returns null when getting an agent that does not exist', async () => {
    vi.mocked(pool.query).mockResolvedValue({ rows: [] } as never)
    const repo = new OfficeAgentRepository()

    await expect(repo.getById('missing')).resolves.toBeNull()
  })

  it('updates an agent and preserves existing fields when omitted', async () => {
    const existing = fakeAgentRecord()
    const updated = fakeAgentRecord({ name: 'Alfred v2', status: 'working' })
    vi.mocked(pool.query)
      .mockResolvedValueOnce({ rows: [existing] } as never)
      .mockResolvedValueOnce({ rows: [updated] } as never)

    const repo = new OfficeAgentRepository()
    const result = await repo.update('agent-1', { name: 'Alfred v2', status: 'working' })

    expect(result).toEqual(toOfficeAgent(updated))
    const [, params] = vi.mocked(pool.query).mock.calls[1]
    expect(params).toContain('Alfred v2')
    expect(params).toContain('working')
  })

  it('returns null when updating a missing agent', async () => {
    vi.mocked(pool.query).mockResolvedValue({ rows: [] } as never)
    const repo = new OfficeAgentRepository()

    await expect(repo.update('missing', { name: 'X' })).resolves.toBeNull()
  })

  it('deletes an agent', async () => {
    vi.mocked(pool.query).mockResolvedValue({ rowCount: 1 } as never)
    const repo = new OfficeAgentRepository()

    const result = await repo.delete('agent-1')

    expect(result).toBe(true)
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM agents WHERE id = $1'),
      ['agent-1'],
    )
  })

  it('lists capabilities for an agent', async () => {
    const record = fakeCapabilityRecord()
    vi.mocked(pool.query).mockResolvedValue({ rows: [record] } as never)
    const repo = new OfficeAgentRepository()

    const result = await repo.listCapabilities('agent-1')

    expect(result).toEqual([toOfficeAgentCapability(record)])
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('SELECT * FROM agent_capabilities WHERE agent_id = $1'),
      ['agent-1'],
    )
  })

  it('adds a capability and returns it', async () => {
    const record = fakeCapabilityRecord()
    vi.mocked(pool.query).mockResolvedValue({ rows: [record] } as never)
    const repo = new OfficeAgentRepository()

    const result = await repo.addCapability('agent-1', 'Laravel')

    expect(result).toEqual(toOfficeAgentCapability(record))
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO agent_capabilities'),
      ['agent-1', 'Laravel'],
    )
  })

  it('addCapability returns the existing record on conflict', async () => {
    const record = fakeCapabilityRecord()
    vi.mocked(pool.query)
      .mockResolvedValueOnce({ rows: [] } as never)
      .mockResolvedValueOnce({ rows: [record] } as never)
    const repo = new OfficeAgentRepository()

    const result = await repo.addCapability('agent-1', 'PHP')

    expect(result).toEqual(toOfficeAgentCapability(record))
  })

  it('removes a capability', async () => {
    vi.mocked(pool.query).mockResolvedValue({ rowCount: 1 } as never)
    const repo = new OfficeAgentRepository()

    const result = await repo.removeCapability('agent-1', 'PHP')

    expect(result).toBe(true)
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM agent_capabilities WHERE agent_id = $1 AND capability = $2'),
      ['agent-1', 'PHP'],
    )
  })
})
