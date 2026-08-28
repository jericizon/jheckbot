import type { AgentAdapter } from './AgentAdapter.js'

export interface AgentProviderInfo {
  id: string
  name: string
  available: boolean
  supportsResume: boolean
  supportsSkills: boolean
  requiresConfig: boolean
}

export class AgentProviderRegistry {
  private adapters = new Map<string, AgentAdapter>()

  register(adapter: AgentAdapter): void {
    this.adapters.set(adapter.providerId, adapter)
  }

  has(id: string): boolean {
    return this.adapters.has(id)
  }

  get(id: string): AgentAdapter {
    const adapter = this.adapters.get(id)
    if (!adapter) throw new AgentProviderRegistryError(`Unknown agent provider: ${id}`)
    return adapter
  }

  list(): AgentProviderInfo[] {
    return Array.from(this.adapters.values()).map((adapter) => ({
      id: adapter.providerId,
      name: adapter.displayName,
      available: adapter.isAvailable(),
      supportsResume: typeof adapter.discoverSessionId === 'function',
      supportsSkills: adapter.hasSkills(),
      requiresConfig: adapter.providerId === 'custom',
    }))
  }
}

export class AgentProviderRegistryError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AgentProviderRegistryError'
  }
}
