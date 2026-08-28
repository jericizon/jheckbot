import type { OfficeEvent, EventType } from '@jheckbot/shared'
import type { OfficeEventService } from './OfficeEventService.js'
import type { PushService } from './PushService.js'

const NOTIFY_EVENT_TYPES: readonly EventType[] = [
  'CEO_RESPONSE',
  'TASK_DISPATCHED',
  'WORKFLOW_COMPLETED',
  'WORKFLOW_FAILED',
  'AGENT_UPDATED',
]

/**
 * Converts meaningful office events into push notifications.
 * Subscribes to an OfficeEventService and forwards selected events to PushService.
 */
export class OfficeNotificationService {
  private unsubscribe?: () => void

  constructor(
    private eventService: OfficeEventService,
    private pushService: PushService,
  ) {}

  start(): void {
    // Listen to all offices using a wildcard listener.
    this.unsubscribe = this.eventService.subscribe('*', (event: OfficeEvent) => {
      this.handleEvent(event).catch(() => {})
    })
  }

  stop(): void {
    this.unsubscribe?.()
    this.unsubscribe = undefined
  }

  private async handleEvent(event: OfficeEvent): Promise<void> {
    if (!NOTIFY_EVENT_TYPES.includes(event.eventType)) return

    const payload = this.buildPayload(event)
    if (!payload) return

    await this.pushService.broadcast({
      title: payload.title,
      body: payload.body,
      tag: `office-${event.officeId}-${event.eventType}`,
      url: `/office?office=${event.officeId}`,
    })
  }

  private buildPayload(event: OfficeEvent): { title: string; body: string } | null {
    const metadata = event.metadata ?? {}

    switch (event.eventType) {
      case 'CEO_RESPONSE':
        return {
          title: 'CEO responded',
          body: event.content ?? 'A new plan is available.',
        }
      case 'TASK_DISPATCHED': {
        const agentName = typeof metadata.agentName === 'string' ? metadata.agentName : 'An agent'
        return {
          title: 'Task assigned',
          body: `${agentName} was assigned to a task.`,
        }
      }
      case 'WORKFLOW_COMPLETED':
        return {
          title: 'Workflow finished',
          body: 'All tasks in the workflow completed successfully.',
        }
      case 'WORKFLOW_FAILED':
        return {
          title: 'Workflow failed',
          body: event.content ?? 'A workflow stopped due to a failure.',
        }
      case 'AGENT_UPDATED': {
        const agentName = typeof metadata.agentName === 'string' ? metadata.agentName : 'An agent'
        return {
          title: 'Agent update',
          body: `${agentName} status changed.`,
        }
      }
      default:
        return null
    }
  }
}
