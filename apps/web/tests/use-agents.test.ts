import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

function createMockApi() {
  return {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  }
}

describe('useAgents', () => {
  const mockApi = createMockApi()

  beforeEach(() => {
    vi.resetModules()
    ;(globalThis as Record<string, unknown>).useApi = vi.fn(() => mockApi)
  })

  afterEach(() => {
    delete (globalThis as Record<string, unknown>).useApi
    vi.resetAllMocks()
  })

  it('lists agents by office', async () => {
    const expected = [{ id: 'agent-1', name: 'Alfred' }]
    mockApi.get.mockResolvedValueOnce(expected)

    const { useAgents } = await import('../app/composables/useAgents')
    const agents = useAgents()
    const result = await agents.listByOffice('office-1')

    expect(mockApi.get).toHaveBeenCalledWith('/api/offices/office-1/agents')
    expect(result).toEqual(expected)
  })

  it('creates an agent under an office', async () => {
    const expected = { id: 'agent-2', name: 'Alice' }
    mockApi.post.mockResolvedValueOnce(expected)

    const { useAgents } = await import('../app/composables/useAgents')
    const agents = useAgents()
    const result = await agents.create('office-1', { name: 'Alice', role: 'QA Engineer' })

    expect(mockApi.post).toHaveBeenCalledWith('/api/offices/office-1/agents', {
      name: 'Alice',
      role: 'QA Engineer',
    })
    expect(result).toEqual(expected)
  })

  it('fetches, updates, and deletes an agent', async () => {
    const expected = { id: 'agent-3', name: 'Bob' }
    mockApi.get.mockResolvedValueOnce(expected)
    mockApi.patch.mockResolvedValueOnce({ ...expected, role: 'Reviewer' })
    mockApi.delete.mockResolvedValueOnce(undefined)

    const { useAgents } = await import('../app/composables/useAgents')
    const agents = useAgents()

    const fetched = await agents.get('agent-3')
    expect(mockApi.get).toHaveBeenCalledWith('/api/agents/agent-3')
    expect(fetched).toEqual(expected)

    const updated = await agents.update('agent-3', { role: 'Reviewer' })
    expect(mockApi.patch).toHaveBeenCalledWith('/api/agents/agent-3', { role: 'Reviewer' })
    expect(updated).toEqual({ ...expected, role: 'Reviewer' })

    await agents.delete('agent-3')
    expect(mockApi.delete).toHaveBeenCalledWith('/api/agents/agent-3')
  })

  it('toggles agent enabled state', async () => {
    const enabled = { id: 'agent-4', enabled: true }
    const disabled = { id: 'agent-4', enabled: false }
    mockApi.post.mockResolvedValueOnce(enabled)
    mockApi.post.mockResolvedValueOnce(disabled)

    const { useAgents } = await import('../app/composables/useAgents')
    const agents = useAgents()

    const afterEnable = await agents.enable('agent-4')
    expect(mockApi.post).toHaveBeenCalledWith('/api/agents/agent-4/enable')
    expect(afterEnable).toEqual(enabled)

    const afterDisable = await agents.disable('agent-4')
    expect(mockApi.post).toHaveBeenCalledWith('/api/agents/agent-4/disable')
    expect(afterDisable).toEqual(disabled)
  })

  it('manages capabilities', async () => {
    const list = [{ id: 'cap-1', agentId: 'agent-5', capability: 'Laravel' }]
    const added = { id: 'cap-2', agentId: 'agent-5', capability: 'PostgreSQL' }
    mockApi.get.mockResolvedValueOnce(list)
    mockApi.post.mockResolvedValueOnce(added)
    mockApi.delete.mockResolvedValueOnce(undefined)

    const { useAgents } = await import('../app/composables/useAgents')
    const agents = useAgents()

    const caps = await agents.listCapabilities('agent-5')
    expect(mockApi.get).toHaveBeenCalledWith('/api/agents/agent-5/capabilities')
    expect(caps).toEqual(list)

    const newCap = await agents.addCapability('agent-5', 'PostgreSQL')
    expect(mockApi.post).toHaveBeenCalledWith('/api/agents/agent-5/capabilities', {
      capability: 'PostgreSQL',
    })
    expect(newCap).toEqual(added)

    await agents.removeCapability('agent-5', 'PostgreSQL')
    expect(mockApi.delete).toHaveBeenCalledWith('/api/agents/agent-5/capabilities/PostgreSQL')
  })

  it('encodes capability names when removing', async () => {
    mockApi.delete.mockResolvedValueOnce(undefined)

    const { useAgents } = await import('../app/composables/useAgents')
    const agents = useAgents()
    await agents.removeCapability('agent-6', 'C# / .NET')

    expect(mockApi.delete).toHaveBeenCalledWith(
      '/api/agents/agent-6/capabilities/C%23%20%2F%20.NET',
    )
  })
})
