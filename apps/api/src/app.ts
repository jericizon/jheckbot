import express from 'express'
import { existsSync } from 'node:fs'
import type { HealthStatus } from '@jheckbot/shared'
import { ProjectRepository } from './repositories/ProjectRepository.js'
import { ConversationRepository } from './repositories/ConversationRepository.js'
import { MessageRepository } from './repositories/MessageRepository.js'
import { AgentEventRepository } from './repositories/AgentEventRepository.js'
import { PathValidator, type AllowedRoot } from './services/PathValidator.js'
import { ProjectService } from './services/ProjectService.js'
import { ProjectHealthService } from './services/ProjectHealthService.js'
import { ConversationService } from './services/ConversationService.js'
import { MessageService } from './services/MessageService.js'
import { ProjectController } from './controllers/ProjectController.js'
import { ConversationController } from './controllers/ConversationController.js'
import { createProjectRouter } from './routes/project.routes.js'
import { createConversationRouter } from './routes/conversation.routes.js'
import { TmuxManager } from './agent/TmuxManager.js'
import { DevinAdapter } from './agent/DevinAdapter.js'
import { AgentManager } from './agent/AgentManager.js'
import { AgentController } from './controllers/AgentController.js'
import { env } from './config/env.js'

export function createApp(): express.Express {
  const app = express()

  app.use(express.json())

  // Wire up dependencies
  const repo = new ProjectRepository()
  const conversationRepo = new ConversationRepository()
  const messageRepo = new MessageRepository()
  const eventRepo = new AgentEventRepository()
  const pathValidatorFactory = (roots: AllowedRoot[]) => new PathValidator(roots)

  const projectService = new ProjectService(repo, pathValidatorFactory)
  const healthService = new ProjectHealthService(repo, pathValidatorFactory, env.devinBin)
  const conversationService = new ConversationService(conversationRepo, repo)
  const messageService = new MessageService(messageRepo, conversationRepo)

  const projectController = new ProjectController(projectService, healthService)

  const tmux = new TmuxManager(env.tmuxBin)
  const devin = new DevinAdapter(env.devinBin, tmux)
  const agentManager = new AgentManager(devin, tmux, repo, pathValidatorFactory)
  const agentController = new AgentController(agentManager, eventRepo)

  const conversationController = new ConversationController(conversationService, messageService)

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

  // Search endpoint
  app.get('/api/search', (req, res) => conversationController.search(req, res))

  // Project routes (includes nested conversation list/create)
  const projectRouter = createProjectRouter(projectController)
  projectRouter.use(
    '/:projectId/conversations',
    createConversationRouter(conversationController, agentController),
  )
  app.use('/api/projects', projectRouter)

  // Direct conversation routes (get, update, delete, archive, messages, agent)
  app.use('/api/conversations', createConversationRouter(conversationController, agentController))

  return app
}
