import { beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import express from 'express'
import type { OfficeAgent, OfficeAgentCapability } from '@jheckbot/shared'
import { OfficeAgentController } from '../src/controllers/OfficeAgentController.js'
import {
  OfficeAgentService,
  OfficeAgentValidationError,
} from '../src/services/OfficeAgentService.js'
import {
  createOfficeAgentRouter,
  createOfficeAgentsByOfficeRouter,
} from '../src/routes/office-agent.routes.js'
import { errorHandler } from '../src/middleware/errorHandler.js'

const officeId = '00000000-0000-0000-0000-000000000001'
const agentId = '00000000-0000-0000-0000-000000000002'

function makeAgent(overrides: Partial<OfficeAgent> = {}): OfficeAgent {
  const now = new Date().toISOString()
  return {
    id: agentId,
    officeId,
    name: 'Alfred',
    role: 'Senior Backend Developer',
    status: 'idle',
    enabled: true,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

function makeCapability(overrides: Partial<OfficeAgentCapability> = {}): OfficeAgentCapability {
  return {
    id: 'cap-1',
    agentId,
    capability: 'PHP',
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

function createTestApp(controller: OfficeAgentController): express.Express {
  const app = express()
  app.use(express.json())
  app.use('/api/offices/:officeId/agents', createOfficeAgentsByOfficeRouter(controller))
  app.use('/api/agents', createOfficeAgentRouter(controller))
  app.use(errorHandler)
  return app
}

function makeService(): OfficeAgentService {
  return {
    listByOffice: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    enable: vi.fn(),
    disable: vi.fn(),
    listCapabilities: vi.fn(),
    addCapability: vi.fn(),
    removeCapability: vi.fn(),
  } as unknown as OfficeAgentService
}

describe('Office Agent routes', () => {
  let service: OfficeAgentService
  let controller: OfficeAgentController
  let app: express.Express

  beforeEach(() => {
    service = makeService()
    controller = new OfficeAgentController(service)
    app = createTestApp(controller)
    vi.resetAllMocks()
  })

  describe('GET /api/offices/:officeId/agents', () => {
    it('lists agents for an office', async () => {
      const agent = makeAgent()
      vi.mocked(service.listByOffice).mockResolvedValue([agent])

      const res = await request(app).get(`/api/offices/${officeId}/agents`)

      expect(res.status).toBe(200)
      expect(res.body).toEqual([agent])
      expect(service.listByOffice).toHaveBeenCalledWith(officeId)
    })

    it('returns 400 for an invalid office id', async () => {
      const res = await request(app).get('/api/offices/not-a-uuid/agents')

      expect(res.status).toBe(400)
      expect(service.listByOffice).not.toHaveBeenCalled()
    })
  })

  describe('POST /api/offices/:officeId/agents', () => {
    it('creates an agent and returns 201', async () => {
      const agent = makeAgent()
      vi.mocked(service.create).mockResolvedValue(agent)

      const res = await request(app).post(`/api/offices/${officeId}/agents`).send({
        name: 'Alfred',
        role: 'Senior Backend Developer',
      })

      expect(res.status).toBe(201)
      expect(res.body).toEqual(agent)
      expect(service.create).toHaveBeenCalledWith(
        expect.objectContaining({
          officeId,
          name: 'Alfred',
          role: 'Senior Backend Developer',
        }),
      )
    })

    it('overrides a client-supplied officeId with the URL parameter', async () => {
      const agent = makeAgent()
      vi.mocked(service.create).mockResolvedValue(agent)

      await request(app).post(`/api/offices/${officeId}/agents`).send({
        name: 'Alfred',
        role: 'Dev',
        officeId: '00000000-0000-0000-0000-000000000009',
      })

      expect(service.create).toHaveBeenCalledWith(
        expect.objectContaining({ officeId }),
      )
    })

    it('returns 400 when validation fails', async () => {
      vi.mocked(service.create).mockRejectedValue(
        new OfficeAgentValidationError('Name is required'),
      )

      const res = await request(app).post(`/api/offices/${officeId}/agents`).send({
        role: 'Dev',
      })

      expect(res.status).toBe(400)
      expect(res.body.error).toContain('Name is required')
    })

    it('returns 400 for an invalid office id', async () => {
      const res = await request(app)
        .post('/api/offices/not-a-uuid/agents')
        .send({ name: 'Alfred', role: 'Dev' })

      expect(res.status).toBe(400)
      expect(service.create).not.toHaveBeenCalled()
    })
  })

  describe('GET /api/agents/:id', () => {
    it('returns an agent by id', async () => {
      const agent = makeAgent()
      vi.mocked(service.getById).mockResolvedValue(agent)

      const res = await request(app).get(`/api/agents/${agentId}`)

      expect(res.status).toBe(200)
      expect(res.body).toEqual(agent)
      expect(service.getById).toHaveBeenCalledWith(agentId)
    })

    it('returns 404 when the agent is not found', async () => {
      vi.mocked(service.getById).mockResolvedValue(null)

      const res = await request(app).get(`/api/agents/${agentId}`)

      expect(res.status).toBe(404)
    })

    it('returns 400 for an invalid id', async () => {
      const res = await request(app).get('/api/agents/not-a-uuid')

      expect(res.status).toBe(400)
      expect(service.getById).not.toHaveBeenCalled()
    })
  })

  describe('PATCH /api/agents/:id', () => {
    it('updates an agent', async () => {
      const agent = makeAgent({ name: 'Alfred v2' })
      vi.mocked(service.update).mockResolvedValue(agent)

      const res = await request(app).patch(`/api/agents/${agentId}`).send({
        name: 'Alfred v2',
      })

      expect(res.status).toBe(200)
      expect(res.body).toEqual(agent)
      expect(service.update).toHaveBeenCalledWith(agentId, { name: 'Alfred v2' })
    })

    it('returns 404 when the agent is not found', async () => {
      vi.mocked(service.update).mockResolvedValue(null)

      const res = await request(app).patch(`/api/agents/${agentId}`).send({
        name: 'Alfred v2',
      })

      expect(res.status).toBe(404)
    })

    it('returns 400 when validation fails', async () => {
      vi.mocked(service.update).mockRejectedValue(
        new OfficeAgentValidationError('Invalid agent status: busy'),
      )

      const res = await request(app).patch(`/api/agents/${agentId}`).send({
        status: 'busy',
      })

      expect(res.status).toBe(400)
      expect(res.body.error).toContain('Invalid agent status')
    })

    it('returns 400 for an invalid id', async () => {
      const res = await request(app)
        .patch('/api/agents/not-a-uuid')
        .send({ name: 'X' })

      expect(res.status).toBe(400)
      expect(service.update).not.toHaveBeenCalled()
    })
  })

  describe('DELETE /api/agents/:id', () => {
    it('deletes an agent and returns 204', async () => {
      vi.mocked(service.delete).mockResolvedValue(true)

      const res = await request(app).delete(`/api/agents/${agentId}`)

      expect(res.status).toBe(204)
      expect(service.delete).toHaveBeenCalledWith(agentId)
    })

    it('returns 404 when the agent is not found', async () => {
      vi.mocked(service.delete).mockResolvedValue(false)

      const res = await request(app).delete(`/api/agents/${agentId}`)

      expect(res.status).toBe(404)
    })
  })

  describe('POST /api/agents/:id/enable', () => {
    it('enables an agent', async () => {
      const agent = makeAgent({ enabled: true })
      vi.mocked(service.enable).mockResolvedValue(agent)

      const res = await request(app).post(`/api/agents/${agentId}/enable`)

      expect(res.status).toBe(200)
      expect(res.body).toEqual(agent)
      expect(service.enable).toHaveBeenCalledWith(agentId)
    })

    it('returns 404 when the agent is not found', async () => {
      vi.mocked(service.enable).mockResolvedValue(null)

      const res = await request(app).post(`/api/agents/${agentId}/enable`)

      expect(res.status).toBe(404)
    })
  })

  describe('POST /api/agents/:id/disable', () => {
    it('disables an agent', async () => {
      const agent = makeAgent({ enabled: false })
      vi.mocked(service.disable).mockResolvedValue(agent)

      const res = await request(app).post(`/api/agents/${agentId}/disable`)

      expect(res.status).toBe(200)
      expect(res.body).toEqual(agent)
      expect(service.disable).toHaveBeenCalledWith(agentId)
    })

    it('returns 404 when the agent is not found', async () => {
      vi.mocked(service.disable).mockResolvedValue(null)

      const res = await request(app).post(`/api/agents/${agentId}/disable`)

      expect(res.status).toBe(404)
    })
  })

  describe('GET /api/agents/:id/capabilities', () => {
    it('lists capabilities for an agent', async () => {
      const capability = makeCapability()
      vi.mocked(service.listCapabilities).mockResolvedValue([capability])

      const res = await request(app).get(`/api/agents/${agentId}/capabilities`)

      expect(res.status).toBe(200)
      expect(res.body).toEqual([capability])
      expect(service.listCapabilities).toHaveBeenCalledWith(agentId)
    })

    it('returns 400 for an invalid id', async () => {
      const res = await request(app).get('/api/agents/not-a-uuid/capabilities')

      expect(res.status).toBe(400)
      expect(service.listCapabilities).not.toHaveBeenCalled()
    })
  })

  describe('POST /api/agents/:id/capabilities', () => {
    it('adds a capability and returns 201', async () => {
      const capability = makeCapability({ capability: 'Laravel' })
      vi.mocked(service.addCapability).mockResolvedValue(capability)

      const res = await request(app)
        .post(`/api/agents/${agentId}/capabilities`)
        .send({ capability: 'Laravel' })

      expect(res.status).toBe(201)
      expect(res.body).toEqual(capability)
      expect(service.addCapability).toHaveBeenCalledWith(agentId, 'Laravel')
    })

    it('returns 400 when the capability is missing', async () => {
      const res = await request(app)
        .post(`/api/agents/${agentId}/capabilities`)
        .send({})

      expect(res.status).toBe(400)
      expect(service.addCapability).not.toHaveBeenCalled()
    })

    it('returns 404 when the agent is not found', async () => {
      vi.mocked(service.addCapability).mockResolvedValue(null)

      const res = await request(app)
        .post(`/api/agents/${agentId}/capabilities`)
        .send({ capability: 'Laravel' })

      expect(res.status).toBe(404)
    })
  })

  describe('DELETE /api/agents/:id/capabilities/:capability', () => {
    it('removes a capability and returns 204', async () => {
      vi.mocked(service.removeCapability).mockResolvedValue(true)

      const res = await request(app).delete(`/api/agents/${agentId}/capabilities/Laravel`)

      expect(res.status).toBe(204)
      expect(service.removeCapability).toHaveBeenCalledWith(agentId, 'Laravel')
    })

    it('returns 404 when the agent or capability is not found', async () => {
      vi.mocked(service.removeCapability).mockResolvedValue(false)

      const res = await request(app).delete(`/api/agents/${agentId}/capabilities/Laravel`)

      expect(res.status).toBe(404)
    })

    it('returns 400 for an invalid id', async () => {
      const res = await request(app).delete('/api/agents/not-a-uuid/capabilities/Laravel')

      expect(res.status).toBe(400)
      expect(service.removeCapability).not.toHaveBeenCalled()
    })
  })

  it('returns 500 without a stack trace on unexpected errors', async () => {
    vi.mocked(service.getById).mockRejectedValue(new Error('db down'))

    const res = await request(app).get(`/api/agents/${agentId}`)

    expect(res.status).toBe(500)
    expect(res.body).not.toHaveProperty('stack')
    expect(res.body.error).toBe('Internal server error')
  })
})
