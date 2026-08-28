import { beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import express from 'express'
import { CEOController } from '../src/controllers/CEOController.js'
import { CEOService, CEOServiceError } from '../src/services/orchestration/CEOService.js'
import { createCEORouter } from '../src/routes/ceo.routes.js'
import { errorHandler } from '../src/middleware/errorHandler.js'

const officeId = '00000000-0000-0000-0000-000000000001'

function makeEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: 'event-1',
    officeId,
    eventType: 'CEO_MESSAGE',
    content: 'Add login',
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function makePlan() {
  return {
    request: 'Add login',
    complexity: 'medium',
    tasks: [
      { id: 'task-1', officeId, title: 'Implement Add login', status: 'backlog' },
    ],
    dependencies: [],
  }
}

function createTestApp(controller: CEOController): express.Express {
  const app = express()
  app.use(express.json())
  app.use('/api/offices/:officeId/ceo', createCEORouter(controller))
  app.use(errorHandler)
  return app
}

function makeService(): CEOService {
  return {
    sendMessage: vi.fn(),
    listConversationEvents: vi.fn(),
  } as unknown as CEOService
}

describe('CEO routes', () => {
  let service: CEOService
  let controller: CEOController
  let app: express.Express

  beforeEach(() => {
    service = makeService()
    controller = new CEOController(service)
    app = createTestApp(controller)
    vi.resetAllMocks()
  })

  describe('POST /api/offices/:officeId/ceo/messages', () => {
    it('sends a message and returns the plan', async () => {
      vi.mocked(service.sendMessage).mockResolvedValue({
        userMessage: makeEvent({ eventType: 'CEO_MESSAGE' }),
        ceoResponse: makeEvent({ eventType: 'CEO_RESPONSE', content: 'I have a plan' }),
        plan: makePlan(),
      } as any)

      const res = await request(app)
        .post(`/api/offices/${officeId}/ceo/messages`)
        .send({ request: 'Add login' })

      expect(res.status).toBe(201)
      expect(res.body.plan).toEqual(makePlan())
      expect(service.sendMessage).toHaveBeenCalledWith({ officeId, request: 'Add login', projectId: undefined })
    })

    it('returns 400 for missing request', async () => {
      const res = await request(app)
        .post(`/api/offices/${officeId}/ceo/messages`)
        .send({})

      expect(res.status).toBe(400)
      expect(service.sendMessage).not.toHaveBeenCalled()
    })

    it('returns 400 for invalid office id', async () => {
      const res = await request(app)
        .post('/api/offices/not-a-uuid/ceo/messages')
        .send({ request: 'Add login' })

      expect(res.status).toBe(400)
      expect(service.sendMessage).not.toHaveBeenCalled()
    })

    it('passes through CEOServiceError status', async () => {
      vi.mocked(service.sendMessage).mockRejectedValue(new CEOServiceError('Office not found', 404))

      const res = await request(app)
        .post(`/api/offices/${officeId}/ceo/messages`)
        .send({ request: 'Add login' })

      expect(res.status).toBe(404)
    })
  })

  describe('GET /api/offices/:officeId/ceo/events', () => {
    it('lists CEO conversation events', async () => {
      vi.mocked(service.listConversationEvents).mockResolvedValue([
        makeEvent({ eventType: 'CEO_MESSAGE' }),
        makeEvent({ eventType: 'CEO_RESPONSE' }),
      ] as any)

      const res = await request(app).get(`/api/offices/${officeId}/ceo/events`)

      expect(res.status).toBe(200)
      expect(res.body).toHaveLength(2)
      expect(service.listConversationEvents).toHaveBeenCalledWith(officeId)
    })

    it('returns 400 for invalid office id', async () => {
      const res = await request(app).get('/api/offices/not-a-uuid/ceo/events')

      expect(res.status).toBe(400)
      expect(service.listConversationEvents).not.toHaveBeenCalled()
    })
  })
})
