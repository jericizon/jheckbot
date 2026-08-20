import { Router } from 'express'
import { ConversationController } from '../controllers/ConversationController.js'
import { AgentController } from '../controllers/AgentController.js'

/** Routes nested under /api/projects/:projectId/conversations */
export function createNestedConversationRouter(
  controller: ConversationController,
): Router {
  // Express 5 does not merge parent params by default — mergeParams is required
  // so :projectId from the mount path is available in req.params
  const router = Router({ mergeParams: true })

  router.get('/', (req, res) => controller.listByProject(req, res))
  router.post('/', (req, res) => controller.create(req, res))

  return router
}

/** Direct routes under /api/conversations/:id */
export function createConversationRouter(
  controller: ConversationController,
  agentController: AgentController,
): Router {
  const router = Router()

  router.get('/:id', (req, res) => controller.get(req, res))
  router.patch('/:id', (req, res) => controller.update(req, res))
  router.delete('/:id', (req, res) => controller.delete(req, res))
  router.post('/:id/archive', (req, res) => controller.archive(req, res))

  // Messages
  router.get('/:id/messages', (req, res) => controller.listMessages(req, res))
  router.post('/:id/messages', (req, res) => controller.createMessage(req, res))

  // Agent (delegated to AgentController)
  router.get('/:id/agent', (req, res) => agentController.getStatus(req, res))
  router.post('/:id/agent/start', (req, res) => agentController.start(req, res))
  router.post('/:id/agent/stop', (req, res) => agentController.stop(req, res))
  router.get('/:id/events', (req, res) => agentController.streamEvents(req, res))

  return router
}
