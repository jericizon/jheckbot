import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { OfficeAgent, OfficeAgentCapability } from '@jheckbot/shared'
import {
  OfficeAgentService,
  OfficeAgentValidationError,
} from '../src/services/OfficeAgentService.js'
import { OfficeAgentRepository } from '../src/repositories/OfficeAgentRepository.js'

vi.mock('../src/db/pool.js', () => ({
  pool: { query: vi.fn(), on: vi.fn(), end: vi.fn() },
}))

function makeAgent(overrides: Partial<OfficeAgent> = {}): OfficeAgent {
  const now = new Date().toISOString()
  return {
    id: 'agent-1',
    officeId: 'office-1',
    name: 'Alfred',
    role: 'Senior Backend Developer',
    status: 'idle',
    enabled: true,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

function makeCapability(overrides: Partial<OfficeAgentCapability> = {}): OfficeAgentCapability {
  return {
    id: 'cap-1',
    agentId: 'agent-1',
    capability: 'PHP',
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

describe('OfficeAgentService', () => {
  let repo: OfficeAgentRepository
  let service: OfficeAgentService
  let mockAgent: OfficeAgent

  beforeEach(() => {
    mockAgent = makeAgent()

    repo = {
      create: vi.fn().mockResolvedValue(mockAgent),
      listByOffice: vi.fn().mockResolvedValue([mockAgent]),
      getById: vi.fn().mockResolvedValue(mockAgent),
      update: vi.fn().mockResolvedValue(mockAgent),
      delete: vi.fn().mockResolvedValue(true),
      listCapabilities: vi.fn().mockResolvedValue([makeCapability()]),
      addCapability: vi.fn().mockResolvedValue(makeCapability()),
      removeCapability: vi.fn().mockResolvedValue(true),
    } as unknown as OfficeAgentRepository

    service = new OfficeAgentService(repo)
  })

  it('creates an agent with defaults for status and enabled', async () => {
    const result = await service.create({
      officeId: 'office-1',
      name: 'Alfred',
      role: 'Senior Backend Developer',
    })

    expect(result).toEqual(mockAgent)
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        officeId: 'office-1',
        name: 'Alfred',
        role: 'Senior Backend Developer',
        status: 'idle',
        enabled: true,
      }),
    )
  })

  it('rejects creation with empty name', async () => {
    await expect(
      service.create({ officeId: 'office-1', name: '', role: 'Dev' }),
    ).rejects.toThrow(OfficeAgentValidationError)
  })

  it('rejects creation with empty role', async () => {
    await expect(
      service.create({ officeId: 'office-1', name: 'Alfred', role: '' }),
    ).rejects.toThrow(OfficeAgentValidationError)
  })

  it('rejects creation with an invalid status', async () => {
    await expect(
      service.create({
        officeId: 'office-1',
        name: 'Alfred',
        role: 'Dev',
        status: 'invalid' as never,
      }),
    ).rejects.toThrow(OfficeAgentValidationError)
  })

  it('lists agents by office', async () => {
    const result = await service.listByOffice('office-1')
    expect(result).toEqual([mockAgent])
    expect(repo.listByOffice).toHaveBeenCalledWith('office-1')
  })

  it('rejects listing with empty office id', async () => {
    await expect(service.listByOffice('')).rejects.toThrow(OfficeAgentValidationError)
  })

  it('gets an agent by id', async () => {
    const result = await service.getById('agent-1')
    expect(result).toEqual(mockAgent)
    expect(repo.getById).toHaveBeenCalledWith('agent-1')
  })

  it('rejects get with empty id', async () => {
    await expect(service.getById('')).rejects.toThrow(OfficeAgentValidationError)
  })

  it('updates an agent and trims name and role', async () => {
    const updated = await service.update('agent-1', { name: ' Alfred v2 ', role: ' Lead Dev ' })
    expect(updated).toEqual(mockAgent)
    expect(repo.update).toHaveBeenCalledWith(
      'agent-1',
      expect.objectContaining({ name: 'Alfred v2', role: 'Lead Dev' }),
    )
  })

  it('returns null when updating a non-existent agent', async () => {
    vi.mocked(repo.getById).mockResolvedValueOnce(null)
    const result = await service.update('missing', { name: 'X' })
    expect(result).toBeNull()
    expect(repo.update).not.toHaveBeenCalled()
  })

  it('rejects update with empty name', async () => {
    await expect(service.update('agent-1', { name: '' })).rejects.toThrow(
      OfficeAgentValidationError,
    )
  })

  it('rejects update with empty role', async () => {
    await expect(service.update('agent-1', { role: '' })).rejects.toThrow(
      OfficeAgentValidationError,
    )
  })

  it('rejects update with an invalid status', async () => {
    await expect(service.update('agent-1', { status: 'nope' as never })).rejects.toThrow(
      OfficeAgentValidationError,
    )
  })

  it('deletes an agent', async () => {
    const result = await service.delete('agent-1')
    expect(result).toBe(true)
    expect(repo.delete).toHaveBeenCalledWith('agent-1')
  })

  it('enables an agent', async () => {
    await service.enable('agent-1')
    expect(repo.update).toHaveBeenCalledWith('agent-1', { enabled: true })
  })

  it('disables an agent', async () => {
    await service.disable('agent-1')
    expect(repo.update).toHaveBeenCalledWith('agent-1', { enabled: false })
  })

  it('enable returns null for a missing agent', async () => {
    vi.mocked(repo.update).mockResolvedValueOnce(null)
    const result = await service.enable('missing')
    expect(result).toBeNull()
    expect(repo.update).toHaveBeenCalledWith('missing', { enabled: true })
  })

  it('lists capabilities', async () => {
    const result = await service.listCapabilities('agent-1')
    expect(result).toHaveLength(1)
    expect(repo.listCapabilities).toHaveBeenCalledWith('agent-1')
  })

  it('adds a capability', async () => {
    const result = await service.addCapability('agent-1', 'Laravel')
    expect(result).toEqual(makeCapability())
    expect(repo.addCapability).toHaveBeenCalledWith('agent-1', 'Laravel')
  })

  it('trims capability when adding', async () => {
    await service.addCapability('agent-1', '  Laravel  ')
    expect(repo.addCapability).toHaveBeenCalledWith('agent-1', 'Laravel')
  })

  it('removes a capability', async () => {
    const result = await service.removeCapability('agent-1', 'PHP')
    expect(result).toBe(true)
    expect(repo.removeCapability).toHaveBeenCalledWith('agent-1', 'PHP')
  })

  it('rejects remove with empty capability', async () => {
    await expect(service.removeCapability('agent-1', '')).rejects.toThrow(
      OfficeAgentValidationError,
    )
  })
})
