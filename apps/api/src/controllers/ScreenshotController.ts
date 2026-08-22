import type { Request, Response } from 'express'
import { readFile } from 'node:fs/promises'
import { isValidUuid } from '@jheckbot/shared'
import { ScreenshotService } from '../services/ScreenshotService.js'

export class ScreenshotController {
  constructor(private screenshotService: ScreenshotService) {}

  async list(req: Request, res: Response): Promise<void> {
    const conversationId = req.params.id
    if (!isValidUuid(conversationId)) {
      res.status(400).json({ error: 'Invalid conversation ID format' })
      return
    }
    const screenshots = this.screenshotService.listScreenshots(conversationId)
    res.json({ screenshots })
  }

  async serve(req: Request, res: Response): Promise<void> {
    const conversationId = req.params.id
    const filename = req.params.filename
    if (!isValidUuid(conversationId)) {
      res.status(400).json({ error: 'Invalid conversation ID format' })
      return
    }
    if (typeof filename !== 'string' || filename.length === 0) {
      res.status(400).json({ error: 'Filename is required' })
      return
    }

    const safePath = this.screenshotService.resolveSafePath(conversationId, filename)
    if (!safePath) {
      res.status(404).json({ error: 'Screenshot not found' })
      return
    }

    try {
      const buffer = await readFile(safePath)
      res.setHeader('Content-Type', 'image/png')
      res.setHeader('Cache-Control', 'private, max-age=3600')
      res.send(buffer)
    } catch {
      res.status(404).json({ error: 'Screenshot not found' })
    }
  }
}
