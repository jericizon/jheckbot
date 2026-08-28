import type { OfficeAgent, OfficeAgentCapability, AgentStatus } from '@jheckbot/shared'
import { isValidAgentStatus } from '@jheckbot/shared'
import { OfficeAgentRepository } from '../repositories/OfficeAgentRepository.js'
import { OfficeEventService } from './OfficeEventService.js'

export interface CreateOfficeAgentInput {
  officeId: string
  name: string
  role: string
  description?: string
  avatar?: string
  personality?: string
  instructions?: string
  responsibilities?: string
  provider?: string
  model?: string
  skills?: string[]
  tools?: string[]
  permissions?: Record<string, unknown>
  projectAccess?: string[]
  status?: AgentStatus
  enabled?: boolean
}

export type UpdateOfficeAgentInput = Partial<Omit<CreateOfficeAgentInput, 'officeId'>>

export class OfficeAgentService {
  constructor(
    private repo: OfficeAgentRepository,
    private eventService?: OfficeEventService,
  ) {}

  async listByOffice(officeId: string): Promise<OfficeAgent[]> {
    if (!officeId?.trim()) {
      throw new OfficeAgentValidationError('Office ID is required')
    }
    return this.repo.listByOffice(officeId)
  }

  async getById(id: string): Promise<OfficeAgent | null> {
    if (!id?.trim()) {
      throw new OfficeAgentValidationError('Agent ID is required')
    }
    return this.repo.getById(id)
  }

  async create(input: CreateOfficeAgentInput): Promise<OfficeAgent> {
    if (!input.officeId?.trim()) {
      throw new OfficeAgentValidationError('Office ID is required')
    }
    if (!input.name?.trim()) {
      throw new OfficeAgentValidationError('Name is required')
    }
    if (!input.role?.trim()) {
      throw new OfficeAgentValidationError('Role is required')
    }
    if (input.status && !isValidAgentStatus(input.status)) {
      throw new OfficeAgentValidationError(`Invalid agent status: ${input.status}`)
    }

    const agent = await this.repo.create({
      ...input,
      name: input.name.trim(),
      role: input.role.trim(),
      status: input.status ?? 'idle',
      enabled: input.enabled ?? true,
    })

    if (this.eventService) {
      await this.eventService.create({
        officeId: agent.officeId,
        eventType: 'AGENT_UPDATED',
        content: `Agent created: ${agent.name}`,
        metadata: { agentId: agent.id, status: agent.status },
      })
    }

    return agent
  }

  async update(id: string, input: UpdateOfficeAgentInput): Promise<OfficeAgent | null> {
    if (!id?.trim()) {
      throw new OfficeAgentValidationError('Agent ID is required')
    }

    const existing = await this.repo.getById(id)
    if (!existing) return null

    if (input.name !== undefined && !input.name.trim()) {
      throw new OfficeAgentValidationError('Name cannot be empty')
    }
    if (input.role !== undefined && !input.role.trim()) {
      throw new OfficeAgentValidationError('Role cannot be empty')
    }
    if (input.status !== undefined && !isValidAgentStatus(input.status)) {
      throw new OfficeAgentValidationError(`Invalid agent status: ${input.status}`)
    }

    const agent = await this.repo.update(id, {
      ...input,
      name: input.name?.trim(),
      role: input.role?.trim(),
    })

    if (agent && this.eventService) {
      await this.eventService.create({
        officeId: agent.officeId,
        eventType: 'AGENT_UPDATED',
        content: `Agent updated: ${agent.name}`,
        metadata: { agentId: agent.id, status: agent.status },
      })
    }

    return agent
  }

  async delete(id: string): Promise<boolean> {
    if (!id?.trim()) {
      throw new OfficeAgentValidationError('Agent ID is required')
    }

    const existing = await this.repo.getById(id)
    if (!existing) return false

    const deleted = await this.repo.delete(id)

    if (deleted && this.eventService) {
      await this.eventService.create({
        officeId: existing.officeId,
        eventType: 'AGENT_UPDATED',
        content: `Agent deleted: ${existing.name}`,
        metadata: { agentId: existing.id, deleted: true },
      })
    }

    return deleted
  }

  async enable(id: string): Promise<OfficeAgent | null> {
    if (!id?.trim()) {
      throw new OfficeAgentValidationError('Agent ID is required')
    }
    return this.setEnabled(id, true)
  }

  async disable(id: string): Promise<OfficeAgent | null> {
    if (!id?.trim()) {
      throw new OfficeAgentValidationError('Agent ID is required')
    }
    return this.setEnabled(id, false)
  }

  private async setEnabled(id: string, enabled: boolean): Promise<OfficeAgent | null> {
    const agent = await this.repo.update(id, { enabled })

    if (agent && this.eventService) {
      await this.eventService.create({
        officeId: agent.officeId,
        eventType: 'AGENT_UPDATED',
        content: `Agent ${enabled ? 'enabled' : 'disabled'}: ${agent.name}`,
        metadata: { agentId: agent.id, enabled },
      })
    }

    return agent
  }

  async listCapabilities(agentId: string): Promise<OfficeAgentCapability[]> {
    if (!agentId?.trim()) {
      throw new OfficeAgentValidationError('Agent ID is required')
    }
    return this.repo.listCapabilities(agentId)
  }

  async addCapability(agentId: string, capability: string): Promise<OfficeAgentCapability | null> {
    if (!agentId?.trim()) {
      throw new OfficeAgentValidationError('Agent ID is required')
    }
    if (!capability?.trim()) {
      throw new OfficeAgentValidationError('Capability is required')
    }
    return this.repo.addCapability(agentId, capability.trim())
  }

  async removeCapability(agentId: string, capability: string): Promise<boolean> {
    if (!agentId?.trim()) {
      throw new OfficeAgentValidationError('Agent ID is required')
    }
    if (!capability?.trim()) {
      throw new OfficeAgentValidationError('Capability is required')
    }
    return this.repo.removeCapability(agentId, capability.trim())
  }
}

export class OfficeAgentValidationError extends Error {
  statusCode: number
  constructor(message: string, statusCode = 400) {
    super(message)
    this.name = 'OfficeAgentValidationError'
    this.statusCode = statusCode
  }
}
