import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CEOPlan, CEOPlanner } from '../src/services/orchestration/CEOPlanner.js'
import type { OfficeEventService } from '../src/services/OfficeEventService.js'
import { CEOService, CEOServiceError } from '../src/services/orchestration/CEOService.js'

const officeId = '00000000-0000-0000-0000-000000000001'

function makePlan(): CEOPlan {
  return {
    request: 'Add login',
    complexity: 'medium',
    tasks: [
      { id: 'task-1', officeId, title: 'Implement Add login', status: 'backlog' } as any,
      { id: 'task-2', officeId, title: 'QA: Add login', status: 'backlog' } as any,
    ],
    dependencies: [],
  }
}

function makeEvent(eventType: string, content: string): any {
  return {
    id: 'event-1',
    officeId,
    eventType,
    content,
    createdAt: '2026-01-01T00:00:00Z',
  }
}

describe('CEOService', () => {
  let planner: Pick<CEOPlanner, 'plan'>
  let eventService: Pick<OfficeEventService, 'create' | 'listByOfficeAndTypes'>
  let service: CEOService

  beforeEach(() => {
    planner = {
      plan: vi.fn().mockResolvedValue(makePlan()),
    } as unknown as Pick<CEOPlanner, 'plan'>
    eventService = {
      create: vi.fn().mockResolvedValue(makeEvent('CEO_RESPONSE', 'response')),
      listByOfficeAndTypes: vi.fn().mockResolvedValue([]),
    } as unknown as Pick<OfficeEventService, 'create' | 'listByOfficeAndTypes'>
    service = new CEOService(planner as CEOPlanner, eventService as OfficeEventService)
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('sends a message and creates a plan', async () => {
    vi.mocked(eventService.create)
      .mockResolvedValueOnce(makeEvent('CEO_MESSAGE', 'Add login'))
      .mockResolvedValueOnce(makeEvent('CEO_RESPONSE', 'I have a plan'))

    const result = await service.sendMessage({ officeId, request: 'Add login' })

    expect(eventService.create).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'CEO_MESSAGE', content: 'Add login' }),
    )
    expect(planner.plan).toHaveBeenCalledWith('Add login', officeId, undefined)
    expect(eventService.create).toHaveBeenLastCalledWith(
      expect.objectContaining({ eventType: 'CEO_RESPONSE' }),
    )
    expect(result.plan).toEqual(makePlan())
  })

  it('throws for missing office id', async () => {
    await expect(service.sendMessage({ officeId: '', request: 'Add login' })).rejects.toBeInstanceOf(CEOServiceError)
  })

  it('throws for empty request', async () => {
    await expect(service.sendMessage({ officeId, request: '' })).rejects.toBeInstanceOf(CEOServiceError)
  })

  it('lists conversation events filtered by type', async () => {
    await service.listConversationEvents(officeId)
    expect(eventService.listByOfficeAndTypes).toHaveBeenCalledWith(officeId, [
      'CEO_MESSAGE',
      'CEO_RESPONSE',
      'CEO_PLANNING',
    ])
  })
})
