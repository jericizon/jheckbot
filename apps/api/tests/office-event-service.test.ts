import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { OfficeEvent } from '@jheckbot/shared'
import { OfficeEventRepository } from '../src/repositories/OfficeEventRepository.js'
import { OfficeEventService } from '../src/services/OfficeEventService.js'

function makeEvent(eventType: string, content?: string): OfficeEvent {
  return {
    id: 'event-1',
    officeId: 'office-1',
    eventType: eventType as OfficeEvent['eventType'],
    content,
    createdAt: '2026-01-01T00:00:00Z',
  }
}

describe('OfficeEventService', () => {
  let repo: OfficeEventRepository
  let service: OfficeEventService

  beforeEach(() => {
    repo = {
      create: vi.fn().mockResolvedValue(makeEvent('TASK_CREATED', 'Task created')),
      getById: vi.fn().mockResolvedValue(makeEvent('TASK_CREATED')),
      listByOffice: vi.fn().mockResolvedValue([makeEvent('TASK_CREATED')]),
    } as unknown as OfficeEventRepository
    service = new OfficeEventService(repo)
  })

  it('creates an event and returns it', async () => {
    const event = await service.create({
      officeId: 'office-1',
      eventType: 'TASK_CREATED',
      content: 'Task created',
    })
    expect(repo.create).toHaveBeenCalledWith({
      officeId: 'office-1',
      eventType: 'TASK_CREATED',
      content: 'Task created',
      metadata: null,
    })
    expect(event).toEqual(makeEvent('TASK_CREATED', 'Task created'))
  })

  it('notifies subscribers when an event is created', async () => {
    const listener = vi.fn()
    service.subscribe('office-1', listener)

    await service.create({
      officeId: 'office-1',
      eventType: 'TASK_CREATED',
    })

    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ officeId: 'office-1' }))
  })

  it('does not notify subscribers for a different office', async () => {
    const listener = vi.fn()
    service.subscribe('office-2', listener)

    await service.create({
      officeId: 'office-1',
      eventType: 'TASK_CREATED',
    })

    expect(listener).not.toHaveBeenCalled()
  })

  it('unsubscribes listeners', async () => {
    const listener = vi.fn()
    const unsubscribe = service.subscribe('office-1', listener)
    unsubscribe()

    await service.create({
      officeId: 'office-1',
      eventType: 'TASK_CREATED',
    })

    expect(listener).not.toHaveBeenCalled()
  })

  it('emits events through the public emit method', () => {
    const listener = vi.fn()
    service.subscribe('office-1', listener)

    service.emit(makeEvent('TASK_UPDATED'))

    expect(listener).toHaveBeenCalledWith(makeEvent('TASK_UPDATED'))
  })

  it('lists events by office', async () => {
    const events = await service.listByOffice('office-1')
    expect(repo.listByOffice).toHaveBeenCalledWith('office-1')
    expect(events).toEqual([makeEvent('TASK_CREATED')])
  })

  it('gets an event by id', async () => {
    const event = await service.getById('event-1')
    expect(repo.getById).toHaveBeenCalledWith('event-1')
    expect(event).toEqual(makeEvent('TASK_CREATED'))
  })
})
