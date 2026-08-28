import type { MessageType, OfficeAgent, OfficeAgentMessage } from '@jheckbot/shared'
import { isValidMessageType, isValidUuid } from '@jheckbot/shared'
import { OfficeAgentRepository } from '../repositories/OfficeAgentRepository.js'
import {
  OfficeAgentMessageRepository,
  type OfficeAgentMessageCreateData,
} from '../repositories/OfficeAgentMessageRepository.js'
import { OfficeEventService } from './OfficeEventService.js'
import { OfficeEventRepository } from '../repositories/OfficeEventRepository.js'

export interface CreateOfficeAgentMessageInput {
  officeId: string
  taskId?: string | null
  fromAgentId: string
  toAgentId?: string | null
  type: MessageType
  content: string
  metadata?: Record<string, unknown> | null
}

export class OfficeAgentMessageService {
  constructor(
    private repo: OfficeAgentMessageRepository,
    private agentRepo: OfficeAgentRepository = new OfficeAgentRepository(),
    private eventService: OfficeEventService = new OfficeEventService(new OfficeEventRepository()),
  ) {}

  async listByOffice(officeId: string): Promise<OfficeAgentMessage[]> {
    if (!officeId?.trim()) {
      throw new OfficeAgentMessageValidationError('Office ID is required')
    }
    return this.repo.listByOffice(officeId)
  }

  async listByTask(taskId: string): Promise<OfficeAgentMessage[]> {
    if (!taskId?.trim()) {
      throw new OfficeAgentMessageValidationError('Task ID is required')
    }
    return this.repo.listByTask(taskId)
  }

  async listByAgent(agentId: string): Promise<OfficeAgentMessage[]> {
    if (!agentId?.trim()) {
      throw new OfficeAgentMessageValidationError('Agent ID is required')
    }
    return this.repo.listByAgent(agentId)
  }

  async getById(id: string): Promise<OfficeAgentMessage | null> {
    if (!id?.trim()) {
      throw new OfficeAgentMessageValidationError('Message ID is required')
    }
    return this.repo.getById(id)
  }

  async markRead(id: string): Promise<OfficeAgentMessage | null> {
    if (!id?.trim()) {
      throw new OfficeAgentMessageValidationError('Message ID is required')
    }
    return this.repo.markRead(id)
  }

  async getThread(
    rootId: string,
  ): Promise<{ root: OfficeAgentMessage; replies: OfficeAgentMessage[] } | null> {
    if (!rootId?.trim()) {
      throw new OfficeAgentMessageValidationError('Message ID is required')
    }
    return this.repo.getThread(rootId)
  }

  async create(input: CreateOfficeAgentMessageInput): Promise<OfficeAgentMessage> {
    if (!input.officeId?.trim()) {
      throw new OfficeAgentMessageValidationError('Office ID is required')
    }
    if (!input.fromAgentId?.trim()) {
      throw new OfficeAgentMessageValidationError('From agent ID is required')
    }
    if (!isValidUuid(input.fromAgentId)) {
      throw new OfficeAgentMessageValidationError('From agent ID must be a valid UUID')
    }
    if (!input.type || !isValidMessageType(input.type)) {
      throw new OfficeAgentMessageValidationError(`Invalid message type: ${input.type}`)
    }
    if (!input.content?.trim()) {
      throw new OfficeAgentMessageValidationError('Content is required')
    }

    if (input.toAgentId !== undefined && input.toAgentId !== null) {
      if (!input.toAgentId.trim()) {
        throw new OfficeAgentMessageValidationError('To agent ID cannot be empty')
      }
      if (!isValidUuid(input.toAgentId)) {
        throw new OfficeAgentMessageValidationError('To agent ID must be a valid UUID')
      }
    }

    await this.verifyAgentInOffice(input.fromAgentId, input.officeId, 'From')

    if (input.toAgentId) {
      await this.verifyAgentInOffice(input.toAgentId, input.officeId, 'To')
    }

    const created = await this.repo.create({
      ...input,
      content: input.content.trim(),
    } as OfficeAgentMessageCreateData)

    await this.eventService.create({
      officeId: input.officeId,
      eventType: 'AGENT_MESSAGE',
      content: `Agent message created: ${created.id}`,
      metadata: {
        messageId: created.id,
        fromAgentId: created.fromAgentId,
        toAgentId: created.toAgentId,
        type: created.type,
      },
    })

    return created
  }

  private async verifyAgentInOffice(
    agentId: string,
    officeId: string,
    label: 'From' | 'To',
  ): Promise<OfficeAgent> {
    const agent = await this.agentRepo.getById(agentId)
    if (!agent) {
      throw new OfficeAgentMessageValidationError(`${label} agent not found`)
    }
    if (agent.officeId !== officeId) {
      throw new OfficeAgentMessageValidationError(`${label} agent does not belong to the office`)
    }
    return agent
  }
}

export class OfficeAgentMessageValidationError extends Error {
  statusCode: number
  constructor(message: string, statusCode = 400) {
    super(message)
    this.name = 'OfficeAgentMessageValidationError'
    this.statusCode = statusCode
  }
}
