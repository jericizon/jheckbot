import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import cookieParser from 'cookie-parser'
import { existsSync } from 'node:fs'
import type { HealthStatus } from '@jheckbot/shared'
import { ProjectRepository } from './repositories/ProjectRepository.js'
import { ConversationRepository } from './repositories/ConversationRepository.js'
import { MessageRepository } from './repositories/MessageRepository.js'
import { AgentEventRepository } from './repositories/AgentEventRepository.js'
import { UserRepository } from './repositories/UserRepository.js'
import { PathValidator, type AllowedRoot } from './services/PathValidator.js'
import { ProjectService } from './services/ProjectService.js'
import { ProjectHealthService } from './services/ProjectHealthService.js'
import { ConversationService } from './services/ConversationService.js'
import { MessageService } from './services/MessageService.js'
import { AuthService } from './services/AuthService.js'
import { ProjectController } from './controllers/ProjectController.js'
import { ConversationController } from './controllers/ConversationController.js'
import { AuthController } from './controllers/AuthController.js'
import { createProjectRouter } from './routes/project.routes.js'
import { createConversationRouter } from './routes/conversation.routes.js'
import { createAuthRouter } from './routes/auth.routes.js'
import { createAuthMiddleware } from './middleware/auth.js'
import { loginLimiter, apiLimiter, messageLimiter } from './middleware/rateLimiter.js'
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js'
import { TmuxManager } from './agent/TmuxManager.js'
import { DevinAdapter } from './agent/DevinAdapter.js'
import { AgentManager } from './agent/AgentManager.js'
import { AgentController } from './controllers/AgentController.js'
import { env } from './config/env.js'

export function createApp(): express.Express {
  const app = express()

  // Security headers
  app.use(helmet({ contentSecurityPolicy: false }))

  // CORS — allow the Nuxt frontend (port 8800) to call the API (port 8801)
  app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:8800',
    credentials: true,
  }))

  app.use(express.json())
  app.use(cookieParser())

  // Global rate limiting
  app.use('/api', apiLimiter)

  // Wire up dependencies
  const repo = new ProjectRepository()
  const conversationRepo = new ConversationRepository()
  const messageRepo = new MessageRepository()
  const eventRepo = new AgentEventRepository()
  const userRepo = new UserRepository()
  const pathValidatorFactory = (roots: AllowedRoot[]) => new PathValidator(roots)

  const projectService = new ProjectService(repo, pathValidatorFactory)
  const healthService = new ProjectHealthService(repo, pathValidatorFactory, env.devinBin)
  const conversationService = new ConversationService(conversationRepo, repo)
  const messageService = new MessageService(messageRepo, conversationRepo)
  const authService = new AuthService(userRepo)

  const projectController = new ProjectController(projectService, healthService)
  const conversationController = new ConversationController(conversationService, messageService)

  const tmux = new TmuxManager(env.tmuxBin)
  const devin = new DevinAdapter(env.devinBin, tmux)
  const agentManager = new AgentManager(devin, tmux, repo, pathValidatorFactory)
  const agentController = new AgentController(agentManager, eventRepo)

  const authMiddleware = createAuthMiddleware(authService)
  const authController = new AuthController(authService, authMiddleware)

  // Health (no auth required)
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

  // Auth routes (login has its own rate limiter)
  app.use('/api/auth', createAuthRouter(authController, authMiddleware.requireAuth))
  app.use('/api/auth/login', loginLimiter)

  // All routes below require auth
  app.use('/api', authMiddleware.requireAuth)

  // Search endpoint
  app.get('/api/search', (req, res) => conversationController.search(req, res))

  // Project routes (includes nested conversation list/create)
  const projectRouter = createProjectRouter(projectController)
  projectRouter.use(
    '/:projectId/conversations',
    createConversationRouter(conversationController, agentController),
  )
  app.use('/api/projects', projectRouter)

  // Direct conversation routes
  const conversationRouter = createConversationRouter(conversationController, agentController)
  conversationRouter.use('/:id/messages', messageLimiter)
  app.use('/api/conversations', conversationRouter)

  // Error handling
  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}
