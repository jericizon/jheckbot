import type { Request, Response } from 'express'
import {
  ConversationService,
  ConversationValidationError,
} from '../services/ConversationService.js'
import { MessageService } from '../services/MessageService.js'

function getParam(req: Request, name: string): string {
  const value = req.params[name]
  return Array.isArray(value) ? value[0] : value
}

export class ConversationController {
  constructor(
    private conversationService: ConversationService,
    private messageService: MessageService,
  ) {}

  async listByProject(req: Request, res: Response): Promise<void> {
    const projectId = getParam(req, 'projectId')
    const conversations = await this.conversationService.listByProject(projectId)
    res.json(conversations)
  }

  async create(req: Request, res: Response): Promise<void> {
    try {
      const projectId = getParam(req, 'projectId')
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
    const conversation = await this.conversationService.get(getParam(req, 'id'))
    if (!conversation) {
      res.status(404).json({ error: 'Conversation not found' })
      return
    }
    res.json(conversation)
  }

  async update(req: Request, res: Response): Promise<void> {
    try {
      const conversation = await this.conversationService.update(getParam(req, 'id'), {
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
    const conversation = await this.conversationService.archive(getParam(req, 'id'))
    if (!conversation) {
      res.status(404).json({ error: 'Conversation not found' })
      return
    }
    res.json(conversation)
  }

  async delete(req: Request, res: Response): Promise<void> {
    const deleted = await this.conversationService.delete(getParam(req, 'id'))
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
    const conversationId = getParam(req, 'id')
    const limit = Number(req.query.limit) || 100
    const offset = Number(req.query.offset) || 0
    const messages = await this.messageService.listByConversation(conversationId, limit, offset)
    res.json(messages)
  }

  async createMessage(req: Request, res: Response): Promise<void> {
    try {
      const conversationId = getParam(req, 'id')
      const message = await this.messageService.create({
        conversationId,
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
