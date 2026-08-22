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
import { PushSubscriptionRepository } from './repositories/PushSubscriptionRepository.js'
import { PathValidator, type AllowedRoot } from './services/PathValidator.js'
import { ProjectService } from './services/ProjectService.js'
import { ProjectHealthService } from './services/ProjectHealthService.js'
import { ConversationService } from './services/ConversationService.js'
import { MessageService } from './services/MessageService.js'
import { PromptExecutionService } from './services/PromptExecutionService.js'
import { AuthService } from './services/AuthService.js'
import { DataService } from './services/DataService.js'
import { SkillsService } from './services/SkillsService.js'
import { PushService } from './services/PushService.js'
import { ProjectController } from './controllers/ProjectController.js'
import { ConversationController } from './controllers/ConversationController.js'
import { AuthController } from './controllers/AuthController.js'
import { DataController } from './controllers/DataController.js'
import { PushController } from './controllers/PushController.js'
import { createProjectRouter } from './routes/project.routes.js'
import { createConversationRouter, createNestedConversationRouter } from './routes/conversation.routes.js'
import { createAuthRouter } from './routes/auth.routes.js'
import { createDataRouter } from './routes/data.routes.js'
import { createPushRouter } from './routes/push.routes.js'
import { createAuthMiddleware } from './middleware/auth.js'
import { loginLimiter, apiLimiter, messageLimiter } from './middleware/rateLimiter.js'
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js'
import { TmuxManager } from './agent/TmuxManager.js'
import { DevinAdapter } from './agent/DevinAdapter.js'
import { AgentProviderRegistry } from './agent/AgentProviderRegistry.js'
import { pool } from './db/pool.js'
import { AgentManager } from './agent/AgentManager.js'
import { AgentController } from './controllers/AgentController.js'
import { ProviderController } from './controllers/ProviderController.js'
import { ProviderService } from './services/ProviderService.js'
import { env } from './config/env.js'

export function createApp(): express.Express {
  const app = express()

  // The API sits behind a proxy (Nuxt dev proxy / Cloudflare Tunnel) which sets
  // X-Forwarded-For. Express must trust the proxy so express-rate-limit can
  // identify clients and so req.ip reflects the real origin.
  app.set('trust proxy', env.trustProxy)

  // Security headers — relax cross-origin policies for API use from frontend
  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: false,
    crossOriginOpenerPolicy: false,
  }))

  // CORS — allow the Nuxt frontend (port 8800) to call the API (port 8801)
  app.use(cors({
    origin: env.corsOrigin,
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

  const pushRepo = new PushSubscriptionRepository()
  const pushConfig = env.vapidPublicKey && env.vapidPrivateKey
    ? {
        vapidPublicKey: env.vapidPublicKey,
        vapidPrivateKey: env.vapidPrivateKey,
        vapidSubject: env.vapidSubject ?? 'mailto:admin@localhost',
      }
    : undefined
  const pushService = new PushService(pushRepo, conversationRepo, pushConfig)

  const projectController = new ProjectController(projectService, healthService)

  const tmux = new TmuxManager(env.tmuxBin)
  const devin = new DevinAdapter(env.devinBin, tmux)
  const providerRegistry = new AgentProviderRegistry()
  providerRegistry.register(devin)
  const providerService = new ProviderService(providerRegistry)
  const providerController = new ProviderController(providerService)
  const agentManager = new AgentManager(
    devin,
    tmux,
    repo,
    pathValidatorFactory,
    conversationRepo,
    messageRepo,
    eventRepo,
    pushService,
  )
  // The server performs startup recovery before it begins listening.
  app.locals.agentManager = agentManager

  const promptExecutionService = new PromptExecutionService(
    agentManager,
    conversationRepo,
    repo,
    messageRepo,
    eventRepo,
    pathValidatorFactory,
  )
  const conversationController = new ConversationController(
    conversationService,
    messageService,
    promptExecutionService,
  )
  const agentController = new AgentController(agentManager, eventRepo, promptExecutionService)

  const authMiddleware = createAuthMiddleware(authService)
  const authController = new AuthController(authService, authMiddleware)

  const dataService = new DataService(repo, agentManager)
  const dataController = new DataController(dataService)

  const skillsService = new SkillsService(env.devinBin)

  // Health (no auth required)
  app.get('/health', async (_req, res) => {
    let dbStatus: 'connected' | 'disconnected' | 'unknown' = 'unknown'
    try {
      await pool.query('SELECT 1')
      dbStatus = 'connected'
    } catch {
      dbStatus = 'disconnected'
    }

    const allOk = dbStatus === 'connected' && tmux.isAvailable() && existsSync(env.devinBin)
    const status: HealthStatus = {
      status: allOk ? 'ok' : 'degraded',
      services: {
        database: dbStatus,
        tmux: tmux.isAvailable() ? 'available' : 'missing',
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

  // Provider listing and per-provider models
  app.get('/api/providers', (req, res) => providerController.list(req, res))
  app.get('/api/providers/:id/models', (req, res) => providerController.models(req, res))

  // Models endpoint — backward-compatible alias for Devin models
  app.get('/api/models', (_req, res) => {
    res.json(providerService.getModels('devin'))
  })

  // Skills endpoint — lists Devin CLI skills (cached, ?refresh=1 forces a reload)
  app.get('/api/skills', async (req, res) => {
    const refresh = req.query.refresh === '1' || req.query.refresh === 'true'
    const result = await skillsService.list(refresh)
    res.json(result)
  })

  // Project routes (includes nested conversation list/create)
  const projectRouter = createProjectRouter(projectController)
  projectRouter.use(
    '/:projectId/conversations',
    createNestedConversationRouter(conversationController),
  )
  app.use('/api/projects', projectRouter)

  // Direct conversation routes
  // Rate limit only POST to messages, not GET (read polling should not exhaust the limit)
  app.use('/api/conversations/:id/messages', (req, res, next) => {
    if (req.method === 'POST') return messageLimiter(req, res, next)
    next()
  })
  const conversationRouter = createConversationRouter(conversationController, agentController)
  app.use('/api/conversations', conversationRouter)

  // Bulk data management (destructive — requires confirmation token)
  app.use('/api/data', createDataRouter(dataController))

  // Web Push subscription management
  const pushController = new PushController(pushService, pushRepo)
  app.use('/api/push', createPushRouter(pushController))

  // Error handling
  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}
