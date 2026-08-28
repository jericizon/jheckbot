import webPush from 'web-push'
import { PushSubscriptionRepository, type PushSubscriptionRecord } from '../repositories/PushSubscriptionRepository.js'
import { ConversationRepository } from '../repositories/ConversationRepository.js'

export interface PushConfig {
  vapidPublicKey: string
  vapidPrivateKey: string
  vapidSubject: string
}

export interface PushPayload {
  title: string
  body: string
  tag?: string
  url?: string
  status?: string
}

/**
 * Sends Web Push notifications to stored subscriptions. Falls back to a
 * no-op when VAPID keys are not configured. JheckBot is a single-user
 * self-hosted app, so notifications are broadcast to all subscriptions.
 */
export class PushService {
  private readonly repo: PushSubscriptionRepository
  private readonly conversationRepo?: ConversationRepository
  private readonly configured: boolean
  private readonly _vapidPublicKey: string

  constructor(repo: PushSubscriptionRepository, conversationRepo?: ConversationRepository, config?: PushConfig) {
    this.repo = repo
    this.conversationRepo = conversationRepo
    this.configured = !!config
    this._vapidPublicKey = config?.vapidPublicKey ?? ''
    if (config) {
      webPush.setVapidDetails(config.vapidSubject, config.vapidPublicKey, config.vapidPrivateKey)
    }
  }

  get isEnabled(): boolean {
    return this.configured
  }

  get vapidPublicKey(): string | null {
    return this.configured ? this._vapidPublicKey : null
  }

  /**
   * Broadcast a push notification to every stored subscription.
   * Best-effort: expired/invalid subscriptions are silently removed.
   */
  async broadcast(payload: PushPayload): Promise<void> {
    if (!this.configured) return
    const subs = await this.repo.findAll()
    await Promise.allSettled(subs.map((s) => this.sendToOne(s, payload)))
  }

  /**
   * Send a push notification about a conversation's terminal status.
   * Looks up the conversation title for a meaningful notification body.
   */
  async notifyConversationCompletion(
    conversationId: string,
    status: string,
    error?: string,
  ): Promise<void> {
    if (!this.configured) return
    let title = 'Conversation'
    if (this.conversationRepo) {
      const conv = await this.conversationRepo.findById(conversationId)
      if (conv) title = conv.title || 'Conversation'
    }

    const verb = status === 'completed' ? 'completed' : status === 'failed' ? 'failed' : 'stopped'
    const body = status === 'failed' && error
      ? `Task failed: ${error}`
      : `Devin finished working on "${title}"`

    await this.broadcast({
      title: `${title} — task ${verb}`,
      body,
      tag: `conv-${conversationId}`,
      url: `/conversations/${conversationId}`,
      status,
    })
  }

  private async sendToOne(sub: PushSubscriptionRecord, payload: PushPayload): Promise<void> {
    try {
      await webPush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh_key, auth: sub.auth_key },
          expirationTime: sub.expiration_time,
        },
        JSON.stringify(payload),
        {
          TTL: 86400,
          urgency: 'high',
          topic: payload.tag,
        },
      )
    } catch (err: unknown) {
      const statusCode = (err as { statusCode?: number }).statusCode
      // 404 = subscription expired, 410 = subscription gone
      if (statusCode === 404 || statusCode === 410) {
        await this.repo.deleteByEndpoint(sub.endpoint).catch(() => {})
      }
    }
  }
}
