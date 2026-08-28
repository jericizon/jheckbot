import type { Request, Response } from 'express'
import { PushService } from '../services/PushService.js'
import { PushSubscriptionRepository } from '../repositories/PushSubscriptionRepository.js'
import { randomUUID } from 'node:crypto'

export class PushController {
  constructor(
    private pushService: PushService,
    private pushRepo: PushSubscriptionRepository,
  ) {}

  getVapidPublicKey(_req: Request, res: Response): void {
    const key = this.pushService.vapidPublicKey
    if (!key) {
      res.status(503).json({ error: 'Push notifications are not configured. Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY.' })
      return
    }
    res.json({ publicKey: key })
  }

  async subscribe(req: Request, res: Response): Promise<void> {
    const key = this.pushService.vapidPublicKey
    if (!key) {
      res.status(503).json({ error: 'Push notifications are not configured' })
      return
    }

    const sub = req.body?.subscription
    if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) {
      res.status(400).json({ error: 'Invalid subscription object' })
      return
    }

    const userId = req.session?.userId
    if (!userId) {
      res.status(401).json({ error: 'Authentication required' })
      return
    }

    try {
      await this.pushRepo.upsert({
        id: randomUUID(),
        userId,
        endpoint: sub.endpoint,
        expirationTime: sub.expirationTime ?? null,
        p256dhKey: sub.keys.p256dh,
        authKey: sub.keys.auth,
      })
      res.json({ success: true })
    } catch {
      res.status(500).json({ error: 'Failed to store subscription' })
    }
  }

  async unsubscribe(req: Request, res: Response): Promise<void> {
    const endpoint = req.body?.endpoint
    if (!endpoint) {
      res.status(400).json({ error: 'Endpoint is required' })
      return
    }
    try {
      await this.pushRepo.deleteByEndpoint(endpoint)
      res.json({ success: true })
    } catch {
      res.status(500).json({ error: 'Failed to remove subscription' })
    }
  }

  async testPush(req: Request, res: Response): Promise<void> {
    if (!this.pushService.isEnabled) {
      res.status(503).json({ error: 'Push notifications are not configured' })
      return
    }
    try {
      await this.pushService.broadcast({
        title: 'JheckBot — test notification',
        body: 'Push notifications are working. You will be alerted when tasks finish.',
        tag: 'test',
      })
      res.json({ success: true })
    } catch {
      res.status(500).json({ error: 'Failed to send test push' })
    }
  }
}
