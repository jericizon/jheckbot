import express from 'express'
import { existsSync } from 'node:fs'
import type { HealthStatus } from '@jheckbot/shared'
import { ProjectRepository } from './repositories/ProjectRepository.js'
import { AgentEventRepository } from './repositories/AgentEventRepository.js'
import { PathValidator, type AllowedRoot } from './services/PathValidator.js'
import { ProjectService } from './services/ProjectService.js'
import { ProjectHealthService } from './services/ProjectHealthService.js'
import { ProjectController } from './controllers/ProjectController.js'
import { createProjectRouter } from './routes/project.routes.js'
import { TmuxManager } from './agent/TmuxManager.js'
import { DevinAdapter } from './agent/DevinAdapter.js'
import { AgentManager } from './agent/AgentManager.js'
import { AgentController } from './controllers/AgentController.js'
import { createAgentRouter } from './routes/agent.routes.js'
import { env } from './config/env.js'

export function createApp(): express.Express {
  const app = express()

  app.use(express.json())

  // Wire up dependencies
  const repo = new ProjectRepository()
  const eventRepo = new AgentEventRepository()
  const pathValidatorFactory = (roots: AllowedRoot[]) => new PathValidator(roots)
  const projectService = new ProjectService(repo, pathValidatorFactory)
  const healthService = new ProjectHealthService(repo, pathValidatorFactory, env.devinBin)
  const projectController = new ProjectController(projectService, healthService)

  const tmux = new TmuxManager(env.tmuxBin)
  const devin = new DevinAdapter(env.devinBin, tmux)
  const agentManager = new AgentManager(devin, tmux, repo, pathValidatorFactory)
  const agentController = new AgentController(agentManager, eventRepo)

  // Routes
  app.get('/health', (_req, res) => {
    const status: HealthStatus = {
      status: 'ok',
      services: {
        database: 'unknown',
        tmux: existsSync(env.tmuxBin) ? 'available' : 'missing',
        devin: existsSync(env.devinBin) ? 'available' : 'missing',
      },
      timestamp: new Date().toISOString(),
    }
    res.json(status)
  })

  app.use('/api/projects', createProjectRouter(projectController))
  app.use('/api/conversations', createAgentRouter(agentController))

  return app
}
