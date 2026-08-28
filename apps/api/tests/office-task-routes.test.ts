import { beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import express from 'express'
import type { OfficeTask, OfficeTaskDependency } from '@jheckbot/shared'
import { OfficeTaskController } from '../src/controllers/OfficeTaskController.js'
import {
  OfficeTaskService,
  OfficeTaskValidationError,
} from '../src/services/OfficeTaskService.js'
import {
  createOfficeTaskRouter,
  createOfficeTasksByOfficeRouter,
} from '../src/routes/office-task.routes.js'
import { errorHandler } from '../src/middleware/errorHandler.js'

const officeId = '00000000-0000-0000-0000-000000000001'
const taskId = '00000000-0000-0000-0000-000000000002'
const dependsOnTaskId = '00000000-0000-0000-0000-000000000003'

function makeTask(overrides: Partial<OfficeTask> = {}): OfficeTask {
  const now = new Date().toISOString()
  return {
    id: taskId,
    officeId,
    title: 'Implement task API',
    status: 'backlog',
    priority: 'medium',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

function makeDependency(overrides: Partial<OfficeTaskDependency> = {}): OfficeTaskDependency {
  return {
    taskId,
    dependsOnTaskId,
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

function createTestApp(controller: OfficeTaskController): express.Express {
  const app = express()
  app.use(express.json())
  app.use('/api/offices/:officeId/tasks', createOfficeTasksByOfficeRouter(controller))
  app.use('/api/tasks', createOfficeTaskRouter(controller))
  app.use(errorHandler)
  return app
}

function makeService(): OfficeTaskService {
  return {
    listByOffice: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    setStatus: vi.fn(),
    listDependencies: vi.fn(),
    addDependency: vi.fn(),
    removeDependency: vi.fn(),
    getDependents: vi.fn(),
  } as unknown as OfficeTaskService
}

describe('Office Task routes', () => {
  let service: OfficeTaskService
  let controller: OfficeTaskController
  let app: express.Express

  beforeEach(() => {
    service = makeService()
    controller = new OfficeTaskController(service)
    app = createTestApp(controller)
    vi.resetAllMocks()
  })

  describe('GET /api/offices/:officeId/tasks', () => {
    it('lists tasks for an office', async () => {
      const task = makeTask()
      vi.mocked(service.listByOffice).mockResolvedValue([task])

      const res = await request(app).get(`/api/offices/${officeId}/tasks`)

      expect(res.status).toBe(200)
      expect(res.body).toEqual([task])
      expect(service.listByOffice).toHaveBeenCalledWith(officeId)
    })

    it('returns 400 for an invalid office id', async () => {
      const res = await request(app).get('/api/offices/not-a-uuid/tasks')

      expect(res.status).toBe(400)
      expect(service.listByOffice).not.toHaveBeenCalled()
    })
  })

  describe('POST /api/offices/:officeId/tasks', () => {
    it('creates a task and returns 201', async () => {
      const task = makeTask()
      vi.mocked(service.create).mockResolvedValue(task)

      const res = await request(app).post(`/api/offices/${officeId}/tasks`).send({
        title: 'Implement task API',
        priority: 'high',
      })

      expect(res.status).toBe(201)
      expect(res.body).toEqual(task)
      expect(service.create).toHaveBeenCalledWith(
        expect.objectContaining({
          officeId,
          title: 'Implement task API',
          priority: 'high',
        }),
      )
    })

    it('overrides a client-supplied officeId with the URL parameter', async () => {
      const task = makeTask()
      vi.mocked(service.create).mockResolvedValue(task)

      await request(app).post(`/api/offices/${officeId}/tasks`).send({
        title: 'Implement task API',
        officeId: '00000000-0000-0000-0000-000000000009',
      })

      expect(service.create).toHaveBeenCalledWith(
        expect.objectContaining({ officeId }),
      )
    })

    it('returns 400 when validation fails', async () => {
      vi.mocked(service.create).mockRejectedValue(
        new OfficeTaskValidationError('Title is required'),
      )

      const res = await request(app)
        .post(`/api/offices/${officeId}/tasks`)
        .send({ priority: 'high' })

      expect(res.status).toBe(400)
      expect(res.body.error).toContain('Title is required')
    })

    it('returns 400 for an invalid office id', async () => {
      const res = await request(app)
        .post('/api/offices/not-a-uuid/tasks')
        .send({ title: 'Task' })

      expect(res.status).toBe(400)
      expect(service.create).not.toHaveBeenCalled()
    })
  })

  describe('GET /api/tasks/:id', () => {
    it('returns a task by id', async () => {
      const task = makeTask()
      vi.mocked(service.getById).mockResolvedValue(task)

      const res = await request(app).get(`/api/tasks/${taskId}`)

      expect(res.status).toBe(200)
      expect(res.body).toEqual(task)
      expect(service.getById).toHaveBeenCalledWith(taskId)
    })

    it('returns 404 when the task is not found', async () => {
      vi.mocked(service.getById).mockResolvedValue(null)

      const res = await request(app).get(`/api/tasks/${taskId}`)

      expect(res.status).toBe(404)
    })

    it('returns 400 for an invalid id', async () => {
      const res = await request(app).get('/api/tasks/not-a-uuid')

      expect(res.status).toBe(400)
      expect(service.getById).not.toHaveBeenCalled()
    })
  })

  describe('PATCH /api/tasks/:id', () => {
    it('updates a task', async () => {
      const task = makeTask({ title: 'Updated title' })
      vi.mocked(service.update).mockResolvedValue(task)

      const res = await request(app).patch(`/api/tasks/${taskId}`).send({
        title: 'Updated title',
      })

      expect(res.status).toBe(200)
      expect(res.body).toEqual(task)
      expect(service.update).toHaveBeenCalledWith(taskId, { title: 'Updated title' })
    })

    it('returns 404 when the task is not found', async () => {
      vi.mocked(service.update).mockResolvedValue(null)

      const res = await request(app).patch(`/api/tasks/${taskId}`).send({
        title: 'Updated title',
      })

      expect(res.status).toBe(404)
    })

    it('returns 400 when validation fails', async () => {
      vi.mocked(service.update).mockRejectedValue(
        new OfficeTaskValidationError('Invalid task priority: urgent'),
      )

      const res = await request(app).patch(`/api/tasks/${taskId}`).send({
        priority: 'urgent',
      })

      expect(res.status).toBe(400)
      expect(res.body.error).toContain('Invalid task priority')
    })

    it('returns 400 for an invalid id', async () => {
      const res = await request(app).patch('/api/tasks/not-a-uuid').send({ title: 'X' })

      expect(res.status).toBe(400)
      expect(service.update).not.toHaveBeenCalled()
    })
  })

  describe('DELETE /api/tasks/:id', () => {
    it('deletes a task and returns 204', async () => {
      vi.mocked(service.delete).mockResolvedValue(true)

      const res = await request(app).delete(`/api/tasks/${taskId}`)

      expect(res.status).toBe(204)
      expect(service.delete).toHaveBeenCalledWith(taskId)
    })

    it('returns 404 when the task is not found', async () => {
      vi.mocked(service.delete).mockResolvedValue(false)

      const res = await request(app).delete(`/api/tasks/${taskId}`)

      expect(res.status).toBe(404)
    })
  })

  describe('POST /api/tasks/:id/status', () => {
    it('sets a task status', async () => {
      const task = makeTask({ status: 'ready' })
      vi.mocked(service.setStatus).mockResolvedValue(task)

      const res = await request(app).post(`/api/tasks/${taskId}/status`).send({
        status: 'ready',
      })

      expect(res.status).toBe(200)
      expect(res.body).toEqual(task)
      expect(service.setStatus).toHaveBeenCalledWith(taskId, 'ready')
    })

    it('returns 400 when the status is missing', async () => {
      const res = await request(app).post(`/api/tasks/${taskId}/status`).send({})

      expect(res.status).toBe(400)
      expect(service.setStatus).not.toHaveBeenCalled()
    })

    it('returns 400 when the status is invalid', async () => {
      const res = await request(app)
        .post(`/api/tasks/${taskId}/status`)
        .send({ status: 'invalid' })

      expect(res.status).toBe(400)
      expect(service.setStatus).not.toHaveBeenCalled()
    })

    it('returns 404 when the task is not found', async () => {
      vi.mocked(service.setStatus).mockResolvedValue(null)

      const res = await request(app)
        .post(`/api/tasks/${taskId}/status`)
        .send({ status: 'ready' })

      expect(res.status).toBe(404)
    })

    it('returns 400 when the status transition is invalid', async () => {
      vi.mocked(service.setStatus).mockRejectedValue(
        new OfficeTaskValidationError('Invalid status transition from backlog to completed'),
      )

      const res = await request(app)
        .post(`/api/tasks/${taskId}/status`)
        .send({ status: 'completed' })

      expect(res.status).toBe(400)
      expect(res.body.error).toContain('Invalid status transition')
    })

    it('returns 400 for an invalid id', async () => {
      const res = await request(app)
        .post('/api/tasks/not-a-uuid/status')
        .send({ status: 'ready' })

      expect(res.status).toBe(400)
      expect(service.setStatus).not.toHaveBeenCalled()
    })
  })

  describe('GET /api/tasks/:id/dependencies', () => {
    it('lists dependencies for a task', async () => {
      const dependency = makeTask({ id: dependsOnTaskId, title: 'Dependency' })
      vi.mocked(service.listDependencies).mockResolvedValue([dependency])

      const res = await request(app).get(`/api/tasks/${taskId}/dependencies`)

      expect(res.status).toBe(200)
      expect(res.body).toEqual([dependency])
      expect(service.listDependencies).toHaveBeenCalledWith(taskId)
    })

    it('returns 400 for an invalid id', async () => {
      const res = await request(app).get('/api/tasks/not-a-uuid/dependencies')

      expect(res.status).toBe(400)
      expect(service.listDependencies).not.toHaveBeenCalled()
    })
  })

  describe('POST /api/tasks/:id/dependencies', () => {
    it('adds a dependency and returns 201', async () => {
      const dependency = makeDependency()
      vi.mocked(service.addDependency).mockResolvedValue(dependency)

      const res = await request(app)
        .post(`/api/tasks/${taskId}/dependencies`)
        .send({ dependsOnTaskId })

      expect(res.status).toBe(201)
      expect(res.body).toEqual(dependency)
      expect(service.addDependency).toHaveBeenCalledWith(taskId, dependsOnTaskId)
    })

    it('returns 400 when dependsOnTaskId is missing', async () => {
      const res = await request(app)
        .post(`/api/tasks/${taskId}/dependencies`)
        .send({})

      expect(res.status).toBe(400)
      expect(service.addDependency).not.toHaveBeenCalled()
    })

    it('returns 400 when dependsOnTaskId is not a valid UUID', async () => {
      const res = await request(app)
        .post(`/api/tasks/${taskId}/dependencies`)
        .send({ dependsOnTaskId: 'not-a-uuid' })

      expect(res.status).toBe(400)
      expect(service.addDependency).not.toHaveBeenCalled()
    })

    it('returns 404 when the task or dependency is not found', async () => {
      vi.mocked(service.addDependency).mockResolvedValue(null)

      const res = await request(app)
        .post(`/api/tasks/${taskId}/dependencies`)
        .send({ dependsOnTaskId })

      expect(res.status).toBe(404)
    })

    it('returns 400 when validation fails', async () => {
      vi.mocked(service.addDependency).mockRejectedValue(
        new OfficeTaskValidationError('Circular dependency detected'),
      )

      const res = await request(app)
        .post(`/api/tasks/${taskId}/dependencies`)
        .send({ dependsOnTaskId })

      expect(res.status).toBe(400)
      expect(res.body.error).toContain('Circular dependency')
    })

    it('returns 400 for an invalid id', async () => {
      const res = await request(app)
        .post('/api/tasks/not-a-uuid/dependencies')
        .send({ dependsOnTaskId })

      expect(res.status).toBe(400)
      expect(service.addDependency).not.toHaveBeenCalled()
    })
  })

  describe('DELETE /api/tasks/:id/dependencies/:dependsOnTaskId', () => {
    it('removes a dependency and returns 204', async () => {
      vi.mocked(service.removeDependency).mockResolvedValue(true)

      const res = await request(app).delete(
        `/api/tasks/${taskId}/dependencies/${dependsOnTaskId}`,
      )

      expect(res.status).toBe(204)
      expect(service.removeDependency).toHaveBeenCalledWith(taskId, dependsOnTaskId)
    })

    it('returns 404 when the task or dependency is not found', async () => {
      vi.mocked(service.removeDependency).mockResolvedValue(false)

      const res = await request(app).delete(
        `/api/tasks/${taskId}/dependencies/${dependsOnTaskId}`,
      )

      expect(res.status).toBe(404)
    })

    it('returns 400 for an invalid task id', async () => {
      const res = await request(app).delete(
        `/api/tasks/not-a-uuid/dependencies/${dependsOnTaskId}`,
      )

      expect(res.status).toBe(400)
      expect(service.removeDependency).not.toHaveBeenCalled()
    })

    it('returns 400 for an invalid dependency id', async () => {
      const res = await request(app).delete(
        `/api/tasks/${taskId}/dependencies/not-a-uuid`,
      )

      expect(res.status).toBe(400)
      expect(service.removeDependency).not.toHaveBeenCalled()
    })
  })

  describe('GET /api/tasks/:id/dependents', () => {
    it('lists tasks that depend on the given task', async () => {
      const dependent = makeTask({
        id: '00000000-0000-0000-0000-000000000004',
        title: 'Dependent task',
      })
      vi.mocked(service.getDependents).mockResolvedValue([dependent])

      const res = await request(app).get(`/api/tasks/${taskId}/dependents`)

      expect(res.status).toBe(200)
      expect(res.body).toEqual([dependent])
      expect(service.getDependents).toHaveBeenCalledWith(taskId)
    })

    it('returns 400 for an invalid id', async () => {
      const res = await request(app).get('/api/tasks/not-a-uuid/dependents')

      expect(res.status).toBe(400)
      expect(service.getDependents).not.toHaveBeenCalled()
    })
  })

  it('returns 500 without a stack trace on unexpected errors', async () => {
    vi.mocked(service.getById).mockRejectedValue(new Error('db down'))

    const res = await request(app).get(`/api/tasks/${taskId}`)

    expect(res.status).toBe(500)
    expect(res.body).not.toHaveProperty('stack')
    expect(res.body.error).toBe('Internal server error')
  })
})
