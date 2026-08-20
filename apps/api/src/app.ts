import express from 'express'
import type { HealthStatus } from '@jheckbot/shared'
import { ProjectRepository } from './repositories/ProjectRepository.js'
import { PathValidator, type AllowedRoot } from './services/PathValidator.js'
import { ProjectService } from './services/ProjectService.js'
import { ProjectHealthService } from './services/ProjectHealthService.js'
import { ProjectController } from './controllers/ProjectController.js'
import { createProjectRouter } from './routes/project.routes.js'
import { env } from './config/env.js'

export function createApp(): express.Express {
  const app = express()

  app.use(express.json())

  // Wire up dependencies
  const repo = new ProjectRepository()
  const pathValidatorFactory = (roots: AllowedRoot[]) => new PathValidator(roots)
  const projectService = new ProjectService(repo, pathValidatorFactory)
  const healthService = new ProjectHealthService(repo, pathValidatorFactory, env.devinBin)
  const projectController = new ProjectController(projectService, healthService)

  // Routes
  app.get('/health', (_req, res) => {
    const status: HealthStatus = {
      status: 'ok',
      services: {
        database: 'unknown',
        tmux: 'unknown',
        devin: 'unknown',
      },
      timestamp: new Date().toISOString(),
    }
    res.json(status)
  })

  app.use('/api/projects', createProjectRouter(projectController))

  return app
}
