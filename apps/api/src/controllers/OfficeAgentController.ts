import type { Request, Response } from 'express'
import { isValidUuid, isNonEmptyString } from '@jheckbot/shared'
import {
  OfficeAgentService,
  OfficeAgentValidationError,
} from '../services/OfficeAgentService.js'

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

function validateCapability(value: unknown): string | null {
  if (isNonEmptyString(value)) return value.trim()
  return null
}

export class OfficeAgentController {
  constructor(private service: OfficeAgentService) {}

  async listByOffice(req: Request, res: Response): Promise<void> {
    const officeId = validateIdParam(req, res, 'officeId')
    if (!officeId) return

    const agents = await this.service.listByOffice(officeId)
    res.json(agents)
  }

  async create(req: Request, res: Response): Promise<void> {
    const officeId = validateIdParam(req, res, 'officeId')
    if (!officeId) return

    try {
      const body = typeof req.body === 'object' && req.body !== null ? req.body : {}
      const agent = await this.service.create({
        ...body,
        officeId,
      })
      res.status(201).json(agent)
    } catch (err) {
      if (err instanceof OfficeAgentValidationError) {
        res.status(err.statusCode).json({ error: err.message })
        return
      }
      throw err
    }
  }

  async get(req: Request, res: Response): Promise<void> {
    const id = validateIdParam(req, res)
    if (!id) return

    const agent = await this.service.getById(id)
    if (!agent) {
      res.status(404).json({ error: 'Agent not found' })
      return
    }
    res.json(agent)
  }

  async update(req: Request, res: Response): Promise<void> {
    const id = validateIdParam(req, res)
    if (!id) return

    try {
      const agent = await this.service.update(id, req.body)
      if (!agent) {
        res.status(404).json({ error: 'Agent not found' })
        return
      }
      res.json(agent)
    } catch (err) {
      if (err instanceof OfficeAgentValidationError) {
        res.status(err.statusCode).json({ error: err.message })
        return
      }
      throw err
    }
  }

  async delete(req: Request, res: Response): Promise<void> {
    const id = validateIdParam(req, res)
    if (!id) return

    const deleted = await this.service.delete(id)
    if (!deleted) {
      res.status(404).json({ error: 'Agent not found' })
      return
    }
    res.status(204).send()
  }

  async enable(req: Request, res: Response): Promise<void> {
    const id = validateIdParam(req, res)
    if (!id) return

    const agent = await this.service.enable(id)
    if (!agent) {
      res.status(404).json({ error: 'Agent not found' })
      return
    }
    res.json(agent)
  }

  async disable(req: Request, res: Response): Promise<void> {
    const id = validateIdParam(req, res)
    if (!id) return

    const agent = await this.service.disable(id)
    if (!agent) {
      res.status(404).json({ error: 'Agent not found' })
      return
    }
    res.json(agent)
  }

  async listCapabilities(req: Request, res: Response): Promise<void> {
    const id = validateIdParam(req, res)
    if (!id) return

    const capabilities = await this.service.listCapabilities(id)
    res.json(capabilities)
  }

  async addCapability(req: Request, res: Response): Promise<void> {
    const id = validateIdParam(req, res)
    if (!id) return

    const capability = validateCapability(req.body?.capability)
    if (!capability) {
      res.status(400).json({ error: 'Capability is required' })
      return
    }

    const added = await this.service.addCapability(id, capability)
    if (!added) {
      res.status(404).json({ error: 'Agent not found' })
      return
    }
    res.status(201).json(added)
  }

  async removeCapability(req: Request, res: Response): Promise<void> {
    const id = validateIdParam(req, res)
    if (!id) return

    const capability = getParam(req, 'capability')
    if (!isNonEmptyString(capability)) {
      res.status(400).json({ error: 'Capability is required' })
      return
    }

    const removed = await this.service.removeCapability(id, capability.trim())
    if (!removed) {
      res.status(404).json({ error: 'Agent or capability not found' })
      return
    }
    res.status(204).send()
  }
}
