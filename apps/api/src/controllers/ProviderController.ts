import type { Request, Response } from 'express'
import { ProviderService, ProviderValidationError } from '../services/ProviderService.js'

export class ProviderController {
  constructor(private providerService: ProviderService) {}

  async list(_req: Request, res: Response): Promise<void> {
    res.json(this.providerService.list())
  }

  async models(req: Request, res: Response): Promise<void> {
    const id = typeof req.params.id === 'string' ? req.params.id : req.params.id[0]
    try {
      const result = this.providerService.getModels(id)
      res.json(result)
    } catch (err) {
      if (err instanceof ProviderValidationError) {
        res.status(err.statusCode).json({ error: err.message })
        return
      }
      throw err
    }
  }
}
