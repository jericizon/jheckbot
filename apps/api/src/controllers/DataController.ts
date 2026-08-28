import type { Request, Response } from 'express'
import { DataService } from '../services/DataService.js'

// Type-to-confirm token guards against accidental destructive API calls.
const CONFIRMATION_TOKEN = 'DELETE EVERYTHING'

export class DataController {
  constructor(private dataService: DataService) {}

  async clearAll(req: Request, res: Response): Promise<void> {
    if (req.body?.confirm !== CONFIRMATION_TOKEN) {
      res.status(400).json({
        error: `Confirmation required. Send { "confirm": "${CONFIRMATION_TOKEN}" } to proceed.`,
      })
      return
    }

    const result = await this.dataService.clearAll()
    res.json(result)
  }
}
