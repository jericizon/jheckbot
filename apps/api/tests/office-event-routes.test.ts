import { beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import express from 'express'
import type { OfficeEvent } from '@jheckbot/shared'
import { OfficeEventController } from '../src/controllers/OfficeEventController.js'
import { OfficeEventService } from '../src/services/OfficeEventService.js'
import {
  createOfficeEventRouter,
  createOfficeEventsByOfficeRouter,
} from '../src/routes/office-event.routes.js'
import { errorHandler } from '../src/middleware/errorHandler.js'

const officeId = '00000000-0000-0000-0000-000000000001'
const eventId = '00000000-0000-0000-0000-000000000002'

function makeEvent(overrides: Partial<OfficeEvent> = {}): OfficeEvent {
  return {
    id: eventId,
    officeId,
    eventType: 'TASK_CREATED',
    content: 'Task created',
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function createTestApp(controller: OfficeEventController): express.Express {
  const app = express()
  app.use(express.json())
  app.use('/api/offices/:officeId/events', createOfficeEventsByOfficeRouter(controller))
  app.use('/api/events', createOfficeEventRouter(controller))
  app.use(errorHandler)
  return app
}

function makeService(): OfficeEventService {
  return {
    listByOffice: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    subscribe: vi.fn().mockReturnValue(() => {}),
  } as unknown as OfficeEventService
}

describe('Office Event routes', () => {
  let service: OfficeEventService
  let controller: OfficeEventController
  let app: express.Express

  beforeEach(() => {
    service = makeService()
    controller = new OfficeEventController(service)
    app = createTestApp(controller)
    vi.resetAllMocks()
  })

  describe('GET /api/offices/:officeId/events', () => {
    it('lists events for an office', async () => {
      const event = makeEvent()
      vi.mocked(service.listByOffice).mockResolvedValue([event])

      const res = await request(app).get(`/api/offices/${officeId}/events`)

      expect(res.status).toBe(200)
      expect(res.body).toEqual([event])
      expect(service.listByOffice).toHaveBeenCalledWith(officeId)
    })

    it('returns 400 for an invalid office id', async () => {
      const res = await request(app).get('/api/offices/not-a-uuid/events')

      expect(res.status).toBe(400)
      expect(service.listByOffice).not.toHaveBeenCalled()
    })
  })

  describe('GET /api/events/:id', () => {
    it('returns an event by id', async () => {
      const event = makeEvent()
      vi.mocked(service.getById).mockResolvedValue(event)

      const res = await request(app).get(`/api/events/${eventId}`)

      expect(res.status).toBe(200)
      expect(res.body).toEqual(event)
      expect(service.getById).toHaveBeenCalledWith(eventId)
    })

    it('returns 404 when the event is not found', async () => {
      vi.mocked(service.getById).mockResolvedValue(null)

      const res = await request(app).get(`/api/events/${eventId}`)

      expect(res.status).toBe(404)
    })

    it('returns 400 for an invalid event id', async () => {
      const res = await request(app).get('/api/events/not-a-uuid')

      expect(res.status).toBe(400)
      expect(service.getById).not.toHaveBeenCalled()
    })
  })

  describe('POST /api/offices/:officeId/events', () => {
    it('creates an event and returns 201', async () => {
      const event = makeEvent()
      vi.mocked(service.create).mockResolvedValue(event)

      const res = await request(app)
        .post(`/api/offices/${officeId}/events`)
        .send({ eventType: 'TASK_CREATED', content: 'Task created' })

      expect(res.status).toBe(201)
      expect(res.body).toEqual(event)
      expect(service.create).toHaveBeenCalledWith({
        officeId,
        eventType: 'TASK_CREATED',
        content: 'Task created',
        metadata: null,
      })
    })

    it('returns 400 for an invalid event type', async () => {
      const res = await request(app)
        .post(`/api/offices/${officeId}/events`)
        .send({ eventType: 'UNKNOWN_EVENT' })

      expect(res.status).toBe(400)
      expect(service.create).not.toHaveBeenCalled()
    })

    it('returns 400 for an invalid office id', async () => {
      const res = await request(app)
        .post('/api/offices/not-a-uuid/events')
        .send({ eventType: 'TASK_CREATED' })

      expect(res.status).toBe(400)
      expect(service.create).not.toHaveBeenCalled()
    })
  })

})
