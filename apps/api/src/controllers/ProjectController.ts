import type { Request, Response } from 'express'
import { ProjectService, ProjectValidationError } from '../services/ProjectService.js'
import { ProjectHealthService } from '../services/ProjectHealthService.js'

function getParam(req: Request, name: string): string {
  const value = req.params[name]
  return Array.isArray(value) ? value[0] : value
}

export class ProjectController {
  constructor(
    private projectService: ProjectService,
    private healthService: ProjectHealthService,
  ) {}

  async list(_req: Request, res: Response): Promise<void> {
    const projects = await this.projectService.list()
    res.json(projects)
  }

  async get(req: Request, res: Response): Promise<void> {
    const project = await this.projectService.get(getParam(req, 'id'))
    if (!project) {
      res.status(404).json({ error: 'Project not found' })
      return
    }
    res.json(project)
  }

  async create(req: Request, res: Response): Promise<void> {
    try {
      const project = await this.projectService.create({
        name: req.body.name,
        path: req.body.path,
        description: req.body.description,
      })
      res.status(201).json(project)
    } catch (err) {
      if (err instanceof ProjectValidationError) {
        res.status(400).json({ error: err.message })
        return
      }
      throw err
    }
  }

  async update(req: Request, res: Response): Promise<void> {
    try {
      const project = await this.projectService.update(getParam(req, 'id'), {
        name: req.body.name,
        description: req.body.description,
        enabled: req.body.enabled,
      })
      if (!project) {
        res.status(404).json({ error: 'Project not found' })
        return
      }
      res.json(project)
    } catch (err) {
      if (err instanceof ProjectValidationError) {
        res.status(400).json({ error: err.message })
        return
      }
      throw err
    }
  }

  async delete(req: Request, res: Response): Promise<void> {
    const deleted = await this.projectService.delete(getParam(req, 'id'))
    if (!deleted) {
      res.status(404).json({ error: 'Project not found' })
      return
    }
    res.status(204).send()
  }

  async validate(req: Request, res: Response): Promise<void> {
    const project = await this.projectService.get(getParam(req, 'id'))
    if (!project) {
      res.status(404).json({ error: 'Project not found' })
      return
    }
    const result = await this.healthService.validatePath(project)
    res.json(result)
  }

  async health(req: Request, res: Response): Promise<void> {
    const project = await this.projectService.get(getParam(req, 'id'))
    if (!project) {
      res.status(404).json({ error: 'Project not found' })
      return
    }
    const result = await this.healthService.checkHealth(project)
    res.json(result)
  }
}
