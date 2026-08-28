import { describe, it, expect, vi } from 'vitest'
import { OfficeNotificationService } from '../src/services/OfficeNotificationService.js'
import type { OfficeEvent, EventType } from '@jheckbot/shared'

function makeEvent(eventType: EventType, content?: string, metadata?: Record<string, unknown>): OfficeEvent {
  return {
    id: 'event-1',
    officeId: 'office-1',
    eventType,
    content,
    metadata,
    createdAt: new Date().toISOString(),
  }
}

describe('OfficeNotificationService', () => {
  it('broadcasts a push for selected event types', () => {
    const broadcast = vi.fn().mockResolvedValue(undefined)
    const pushService = { broadcast } as never

    const listenerSet = new Set<(event: OfficeEvent) => void>()
    const eventService = {
      subscribe: vi.fn().mockImplementation((_officeId: string, listener: (event: OfficeEvent) => void) => {
        listenerSet.add(listener)
        return () => listenerSet.delete(listener)
      }),
    } as never

    const service = new OfficeNotificationService(eventService, pushService)
    service.start()

    expect(eventService.subscribe).toHaveBeenCalledWith('*', expect.any(Function))

    const listener = [...listenerSet][0]
    listener(makeEvent('CEO_RESPONSE', 'Plan ready'))

    expect(broadcast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'CEO responded',
        body: 'Plan ready',
        tag: 'office-office-1-CEO_RESPONSE',
        url: '/office?office=office-1',
      }),
    )
  })

  it('ignores events that are not in the notify list', () => {
    const broadcast = vi.fn().mockResolvedValue(undefined)
    const pushService = { broadcast } as never

    const listenerSet = new Set<(event: OfficeEvent) => void>()
    const eventService = {
      subscribe: vi.fn().mockImplementation((_officeId: string, listener: (event: OfficeEvent) => void) => {
        listenerSet.add(listener)
        return () => listenerSet.delete(listener)
      }),
    } as never

    const service = new OfficeNotificationService(eventService, pushService)
    service.start()

    const listener = [...listenerSet][0]
    listener(makeEvent('TASK_CREATED'))

    expect(broadcast).not.toHaveBeenCalled()
  })

  it('stops listening when stop is called', () => {
    const off = vi.fn()
    const eventService = {
      subscribe: vi.fn().mockReturnValue(off),
    } as never

    const service = new OfficeNotificationService(eventService, {} as never)
    service.start()
    service.stop()

    expect(off).toHaveBeenCalled()
  })
})
