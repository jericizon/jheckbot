import type { Request, Response } from 'express'
import { isValidUuid } from '@jheckbot/shared'
import { OfficeService, OfficeServiceError } from '../services/OfficeService.js'

export class OfficeController {
  constructor(private service: OfficeService) {}

  async getOrCreateByProject(req: Request, res: Response): Promise<void> {
    const projectId = req.params.projectId
    if (!projectId || !isValidUuid(projectId)) {
      res.status(400).json({ error: 'Invalid projectId format' })
      return
    }

    try {
      const result = await this.service.findOrCreateByProjectId(projectId)
      res.status(result.created ? 201 : 200).json(result)
    } catch (err) {
      if (err instanceof OfficeServiceError) {
        res.status(err.statusCode).json({ error: err.message })
        return
      }
      throw err
    }
  }
}
