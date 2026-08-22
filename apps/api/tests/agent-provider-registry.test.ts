import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AgentProviderRegistry } from '../src/agent/AgentProviderRegistry.js'
import { DevinAdapter } from '../src/agent/DevinAdapter.js'
import { TmuxManager } from '../src/agent/TmuxManager.js'

vi.mock('node:fs', () => ({ existsSync: vi.fn() }))

function createTmuxMock() {
  return {
    isAvailable: vi.fn().mockReturnValue(true),
    createSession: vi.fn(),
    sessionExists: vi.fn().mockReturnValue(true),
    isPaneAlive: vi.fn().mockReturnValue(true),
    setOption: vi.fn(),
    sendKeys: vi.fn(),
    sendInterrupt: vi.fn(),
    killSession: vi.fn().mockReturnValue(true),
    captureOutput: vi.fn().mockReturnValue([]),
    listSessions: vi.fn().mockReturnValue([]),
  } as unknown as TmuxManager
}

describe('AgentProviderRegistry', () => {
  let registry: AgentProviderRegistry

  beforeEach(() => {
    registry = new AgentProviderRegistry()
  })

  it('lists a registered provider', () => {
    const adapter = new DevinAdapter('devin', createTmuxMock())
    vi.spyOn(adapter, 'isAvailable').mockReturnValue(true)
    registry.register(adapter)

    expect(registry.has('devin')).toBe(true)
    const providers = registry.list()
    expect(providers).toHaveLength(1)
    expect(providers[0]).toMatchObject({
      id: 'devin',
      name: 'Devin',
      available: true,
      supportsResume: true,
      supportsSkills: true,
      requiresConfig: false,
    })
  })

  it('looks up a registered adapter by id', () => {
    const adapter = new DevinAdapter('devin', createTmuxMock())
    registry.register(adapter)
    expect(registry.get('devin').providerId).toBe('devin')
  })

  it('throws for an unknown provider id', () => {
    expect(() => registry.get('missing')).toThrow('Unknown agent provider: missing')
  })
})
