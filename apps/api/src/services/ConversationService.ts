import {
  ConversationRepository,
  type ConversationRecord,
  type SearchResult,
} from '../repositories/ConversationRepository.js'
import { ProjectRepository } from '../repositories/ProjectRepository.js'

export interface CreateConversationInput {
  projectId: string
  title?: string
}

export interface UpdateConversationInput {
  title?: string
  status?: string
  agentSessionId?: string
  agentStatus?: string
}

export class ConversationService {
  constructor(
    private conversationRepo: ConversationRepository,
    private projectRepo: ProjectRepository,
  ) {}

  async listByProject(projectId: string): Promise<ConversationRecord[]> {
    return this.conversationRepo.findByProject(projectId)
  }

  async get(id: string): Promise<ConversationRecord | null> {
    return this.conversationRepo.findById(id)
  }

  async create(input: CreateConversationInput): Promise<ConversationRecord> {
    if (!input.projectId?.trim()) {
      throw new ConversationValidationError('Project ID is required')
    }

    const project = await this.projectRepo.findById(input.projectId)
    if (!project) {
      throw new ConversationValidationError('Project not found', 404)
    }
    if (!project.enabled) {
      throw new ConversationValidationError('Project is disabled', 400)
    }

    const title = input.title?.trim() || 'New Conversation'
    return this.conversationRepo.create({ projectId: input.projectId, title })
  }

  async update(id: string, input: UpdateConversationInput): Promise<ConversationRecord | null> {
    const existing = await this.conversationRepo.findById(id)
    if (!existing) return null

    if (input.title !== undefined && !input.title.trim()) {
      throw new ConversationValidationError('Title cannot be empty')
    }

    return this.conversationRepo.update(id, {
      title: input.title?.trim(),
      status: input.status,
      agentSessionId: input.agentSessionId,
      agentStatus: input.agentStatus,
    })
  }

  async archive(id: string): Promise<ConversationRecord | null> {
    return this.conversationRepo.update(id, { status: 'archived' })
  }

  async delete(id: string): Promise<boolean> {
    return this.conversationRepo.delete(id)
  }

  async search(query: string): Promise<SearchResult[]> {
    if (!query?.trim()) {
      return []
    }
    return this.conversationRepo.search(query.trim())
  }

  /** Generate a title from the first user prompt. */
  generateTitle(prompt: string): string {
    const trimmed = prompt.trim()
    if (trimmed.length <= 60) return trimmed
    return trimmed.slice(0, 57).trimEnd() + '...'
  }
}

export class ConversationValidationError extends Error {
  statusCode: number
  constructor(message: string, statusCode = 400) {
    super(message)
    this.name = 'ConversationValidationError'
    this.statusCode = statusCode
  }
}
