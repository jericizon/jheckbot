import type { Request, Response } from 'express'
import { isValidUuid } from '@jheckbot/shared'
import {
  ConversationService,
  ConversationValidationError,
} from '../services/ConversationService.js'
import { MessageService } from '../services/MessageService.js'

function getParam(req: Request, name: string): string {
  const value = req.params[name]
  return Array.isArray(value) ? value[0] : value
}

function validateIdParam(req: Request, res: Response, name: string): string | null {
  const value = getParam(req, name)
  if (!isValidUuid(value)) {
    res.status(400).json({ error: `Invalid ${name} format` })
    return null
  }
  return value
}

export class ConversationController {
  constructor(
    private conversationService: ConversationService,
    private messageService: MessageService,
  ) {}

  async listByProject(req: Request, res: Response): Promise<void> {
    const projectId = validateIdParam(req, res, 'projectId')
    if (!projectId) return
    const conversations = await this.conversationService.listByProject(projectId)
    res.json(conversations)
  }

  async create(req: Request, res: Response): Promise<void> {
    try {
      const projectId = validateIdParam(req, res, 'projectId')
      if (!projectId) return
      const conversation = await this.conversationService.create({
        projectId,
        title: req.body.title,
      })
      res.status(201).json(conversation)
    } catch (err) {
      if (err instanceof ConversationValidationError) {
        res.status(err.statusCode).json({ error: err.message })
        return
      }
      throw err
    }
  }

  async get(req: Request, res: Response): Promise<void> {
    const id = validateIdParam(req, res, 'id')
    if (!id) return
    const conversation = await this.conversationService.get(id)
    if (!conversation) {
      res.status(404).json({ error: 'Conversation not found' })
      return
    }
    res.json(conversation)
  }

  async update(req: Request, res: Response): Promise<void> {
    try {
      const id = validateIdParam(req, res, 'id')
      if (!id) return
      const conversation = await this.conversationService.update(id, {
        title: req.body.title,
        status: req.body.status,
        agentSessionId: req.body.agentSessionId,
        agentStatus: req.body.agentStatus,
      })
      if (!conversation) {
        res.status(404).json({ error: 'Conversation not found' })
        return
      }
      res.json(conversation)
    } catch (err) {
      if (err instanceof ConversationValidationError) {
        res.status(err.statusCode).json({ error: err.message })
        return
      }
      throw err
    }
  }

  async archive(req: Request, res: Response): Promise<void> {
    const id = validateIdParam(req, res, 'id')
    if (!id) return
    const conversation = await this.conversationService.archive(id)
    if (!conversation) {
      res.status(404).json({ error: 'Conversation not found' })
      return
    }
    res.json(conversation)
  }

  async delete(req: Request, res: Response): Promise<void> {
    const id = validateIdParam(req, res, 'id')
    if (!id) return
    const deleted = await this.conversationService.delete(id)
    if (!deleted) {
      res.status(404).json({ error: 'Conversation not found' })
      return
    }
    res.status(204).send()
  }

  async search(req: Request, res: Response): Promise<void> {
    const query = (req.query.q as string) || ''
    const results = await this.conversationService.search(query)
    res.json(results)
  }

  async listMessages(req: Request, res: Response): Promise<void> {
    const id = validateIdParam(req, res, 'id')
    if (!id) return
    const limit = Number(req.query.limit) || 100
    const offset = Number(req.query.offset) || 0
    const messages = await this.messageService.listByConversation(id, limit, offset)
    res.json(messages)
  }

  async createMessage(req: Request, res: Response): Promise<void> {
    try {
      const id = validateIdParam(req, res, 'id')
      if (!id) return
      const message = await this.messageService.create({
        conversationId: id,
        role: req.body.role,
        content: req.body.content,
        messageType: req.body.messageType,
      })
      res.status(201).json(message)
    } catch (err) {
      if (err instanceof Error && err.name === 'MessageValidationError') {
        const statusCode = (err as { statusCode?: number }).statusCode ?? 400
        res.status(statusCode).json({ error: err.message })
        return
      }
      throw err
    }
  }
}
