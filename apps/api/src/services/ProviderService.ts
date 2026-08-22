import type { ModelOption } from '@jheckbot/shared'
import type { AgentProviderRegistry } from '../agent/AgentProviderRegistry.js'

export interface ProviderInfo {
  id: string
  name: string
  available: boolean
  supportsResume: boolean
  supportsSkills: boolean
  requiresConfig: boolean
}

export interface ProviderModels {
  models: ModelOption[]
  default: string
}

export class ProviderService {
  constructor(private registry: AgentProviderRegistry) {}

  list(): ProviderInfo[] {
    return this.registry.list()
  }

  getModels(providerId: string): ProviderModels {
    if (!this.registry.has(providerId)) {
      throw new ProviderValidationError('Provider not found', 404)
    }
    const adapter = this.registry.get(providerId)
    return {
      models: adapter.supportedModels(),
      default: adapter.defaultModel(),
    }
  }
}

export class ProviderValidationError extends Error {
  statusCode: number
  constructor(message: string, statusCode = 400) {
    super(message)
    this.name = 'ProviderValidationError'
    this.statusCode = statusCode
  }
}
