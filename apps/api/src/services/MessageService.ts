import { MessageRepository, type MessageRecord } from '../repositories/MessageRepository.js'
import { ConversationRepository } from '../repositories/ConversationRepository.js'

export interface CreateMessageInput {
  conversationId: string
  role: 'user' | 'assistant' | 'system'
  content: string
  messageType?: string
  model?: string | null
}

export class MessageService {
  constructor(
    private messageRepo: MessageRepository,
    private conversationRepo: ConversationRepository,
  ) {}

  async listByConversation(
    conversationId: string,
    limit = 100,
    offset = 0,
  ): Promise<MessageRecord[]> {
    return this.messageRepo.findByConversation(conversationId, limit, offset)
  }

  async create(input: CreateMessageInput): Promise<MessageRecord> {
    if (!input.conversationId?.trim()) {
      throw new MessageValidationError('Conversation ID is required')
    }
    if (!input.content?.trim()) {
      throw new MessageValidationError('Content is required')
    }

    const conversation = await this.conversationRepo.findById(input.conversationId)
    if (!conversation) {
      throw new MessageValidationError('Conversation not found', 404)
    }

    const message = await this.messageRepo.create({
      conversationId: input.conversationId,
      role: input.role,
      content: input.content,
      messageType: input.messageType,
      model: input.model,
    })

    await this.conversationRepo.touchLastMessage(input.conversationId)

    // Auto-generate title from first user message if title is still default
    if (input.role === 'user' && conversation.title === 'New Conversation') {
      const title = this.generateTitle(input.content)
      await this.conversationRepo.update(input.conversationId, { title })
    }

    return message
  }

  private generateTitle(prompt: string): string {
    const trimmed = prompt.trim()
    if (trimmed.length <= 60) return trimmed
    return trimmed.slice(0, 57).trimEnd() + '...'
  }
}

export class MessageValidationError extends Error {
  statusCode: number
  constructor(message: string, statusCode = 400) {
    super(message)
    this.name = 'MessageValidationError'
    this.statusCode = statusCode
  }
}
