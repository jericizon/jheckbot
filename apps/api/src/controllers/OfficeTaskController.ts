import type { Request, Response } from 'express'
import type { TaskStatus } from '@jheckbot/shared'
import { isValidTaskStatus, isValidUuid } from '@jheckbot/shared'
import { OfficeTaskService, OfficeTaskValidationError } from '../services/OfficeTaskService.js'

function getParam(req: Request, name: string): string {
  const value = req.params[name]
  return Array.isArray(value) ? value[0] : value ?? ''
}

function validateIdParam(req: Request, res: Response, name = 'id'): string | null {
  const value = getParam(req, name)
  if (!isValidUuid(value)) {
    res.status(400).json({ error: `Invalid ${name} format` })
    return null
  }
  return value
}

function validateBodyStatus(value: unknown): TaskStatus | null {
  if (isValidTaskStatus(value)) return value
  return null
}

function validateBodyUuid(value: unknown): string | null {
  if (isValidUuid(value)) return value
  return null
}

export class OfficeTaskController {
  constructor(private service: OfficeTaskService) {}

  async listByOffice(req: Request, res: Response): Promise<void> {
    const officeId = validateIdParam(req, res, 'officeId')
    if (!officeId) return

    try {
      const tasks = await this.service.listByOffice(officeId)
      res.json(tasks)
    } catch (err) {
      if (err instanceof OfficeTaskValidationError) {
        res.status(err.statusCode).json({ error: err.message })
        return
      }
      throw err
    }
  }

  async create(req: Request, res: Response): Promise<void> {
    const officeId = validateIdParam(req, res, 'officeId')
    if (!officeId) return

    try {
      const body = typeof req.body === 'object' && req.body !== null ? req.body : {}
      const task = await this.service.create({
        ...body,
        officeId,
      })
      res.status(201).json(task)
    } catch (err) {
      if (err instanceof OfficeTaskValidationError) {
        res.status(err.statusCode).json({ error: err.message })
        return
      }
      throw err
    }
  }

  async get(req: Request, res: Response): Promise<void> {
    const id = validateIdParam(req, res)
    if (!id) return

    try {
      const task = await this.service.getById(id)
      if (!task) {
        res.status(404).json({ error: 'Task not found' })
        return
      }
      res.json(task)
    } catch (err) {
      if (err instanceof OfficeTaskValidationError) {
        res.status(err.statusCode).json({ error: err.message })
        return
      }
      throw err
    }
  }

  async update(req: Request, res: Response): Promise<void> {
    const id = validateIdParam(req, res)
    if (!id) return

    try {
      const task = await this.service.update(id, req.body)
      if (!task) {
        res.status(404).json({ error: 'Task not found' })
        return
      }
      res.json(task)
    } catch (err) {
      if (err instanceof OfficeTaskValidationError) {
        res.status(err.statusCode).json({ error: err.message })
        return
      }
      throw err
    }
  }

  async delete(req: Request, res: Response): Promise<void> {
    const id = validateIdParam(req, res)
    if (!id) return

    try {
      const deleted = await this.service.delete(id)
      if (!deleted) {
        res.status(404).json({ error: 'Task not found' })
        return
      }
      res.status(204).send()
    } catch (err) {
      if (err instanceof OfficeTaskValidationError) {
        res.status(err.statusCode).json({ error: err.message })
        return
      }
      throw err
    }
  }

  async setStatus(req: Request, res: Response): Promise<void> {
    const id = validateIdParam(req, res)
    if (!id) return

    const status = validateBodyStatus(req.body?.status)
    if (!status) {
      res.status(400).json({ error: 'Status is required' })
      return
    }

    try {
      const task = await this.service.setStatus(id, status)
      if (!task) {
        res.status(404).json({ error: 'Task not found' })
        return
      }
      res.json(task)
    } catch (err) {
      if (err instanceof OfficeTaskValidationError) {
        res.status(err.statusCode).json({ error: err.message })
        return
      }
      throw err
    }
  }

  async listDependencies(req: Request, res: Response): Promise<void> {
    const id = validateIdParam(req, res)
    if (!id) return

    try {
      const dependencies = await this.service.listDependencies(id)
      res.json(dependencies)
    } catch (err) {
      if (err instanceof OfficeTaskValidationError) {
        res.status(err.statusCode).json({ error: err.message })
        return
      }
      throw err
    }
  }

  async addDependency(req: Request, res: Response): Promise<void> {
    const id = validateIdParam(req, res)
    if (!id) return

    const dependsOnTaskId = validateBodyUuid(req.body?.dependsOnTaskId)
    if (!dependsOnTaskId) {
      res.status(400).json({ error: 'Dependency task ID is required' })
      return
    }

    try {
      const dependency = await this.service.addDependency(id, dependsOnTaskId)
      if (!dependency) {
        res.status(404).json({ error: 'Task or dependency not found' })
        return
      }
      res.status(201).json(dependency)
    } catch (err) {
      if (err instanceof OfficeTaskValidationError) {
        res.status(err.statusCode).json({ error: err.message })
        return
      }
      throw err
    }
  }

  async removeDependency(req: Request, res: Response): Promise<void> {
    const id = validateIdParam(req, res)
    if (!id) return

    const dependsOnTaskId = validateIdParam(req, res, 'dependsOnTaskId')
    if (!dependsOnTaskId) return

    try {
      const removed = await this.service.removeDependency(id, dependsOnTaskId)
      if (!removed) {
        res.status(404).json({ error: 'Task or dependency not found' })
        return
      }
      res.status(204).send()
    } catch (err) {
      if (err instanceof OfficeTaskValidationError) {
        res.status(err.statusCode).json({ error: err.message })
        return
      }
      throw err
    }
  }

  async getDependents(req: Request, res: Response): Promise<void> {
    const id = validateIdParam(req, res)
    if (!id) return

    try {
      const dependents = await this.service.getDependents(id)
      res.json(dependents)
    } catch (err) {
      if (err instanceof OfficeTaskValidationError) {
        res.status(err.statusCode).json({ error: err.message })
        return
      }
      throw err
    }
  }
}
