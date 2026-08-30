import type { Request, Response } from 'express'
import { isValidUuid } from '@jheckbot/shared'
import { CEOService, CEOServiceError } from '../services/orchestration/CEOService.js'

function getParam(req: Request, name: string): string {
  const value = req.params[name]
  return Array.isArray(value) ? value[0] : value ?? ''
}

function validateIdParam(req: Request, res: Response, name = 'id'): string | null {
  const value = getParam(req, name)
  if (!isValidUuid(value)) {
    res.status(400).json({ error: `Invalid ${name} format` })
    return null
  }
  return value
}

export class CEOController {
  constructor(private service: CEOService) {}

  async sendMessage(req: Request, res: Response): Promise<void> {
    const officeId = validateIdParam(req, res, 'officeId')
    if (!officeId) return

    const body = typeof req.body === 'object' && req.body !== null ? req.body : {}
    const request = typeof body.request === 'string' ? body.request.trim() : ''
    const projectId = typeof body.projectId === 'string' ? body.projectId : undefined
    const model = typeof body.model === 'string' ? body.model : undefined

    if (!request) {
      res.status(400).json({ error: 'Request is required' })
      return
    }

    try {
      const result = await this.service.sendMessage({ officeId, request, projectId, model })
      res.status(201).json(result)
    } catch (err) {
      if (err instanceof CEOServiceError) {
        res.status(err.statusCode).json({ error: err.message })
        return
      }
      throw err
    }
  }

  async listEvents(req: Request, res: Response): Promise<void> {
    const officeId = validateIdParam(req, res, 'officeId')
    if (!officeId) return

    try {
      const events = await this.service.listConversationEvents(officeId)
      res.json(events)
    } catch (err) {
      if (err instanceof CEOServiceError) {
        res.status(err.statusCode).json({ error: err.message })
        return
      }
      throw err
    }
  }
}
