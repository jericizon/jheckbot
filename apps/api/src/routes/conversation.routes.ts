import { Router } from 'express'
import { ConversationController } from '../controllers/ConversationController.js'
import { AgentController } from '../controllers/AgentController.js'

export function createConversationRouter(
  controller: ConversationController,
  agentController: AgentController,
): Router {
  const router = Router()

  // Nested under projects
  // GET /api/projects/:projectId/conversations
  // POST /api/projects/:projectId/conversations
  router.get('/', (req, res) => controller.listByProject(req, res))
  router.post('/', (req, res) => controller.create(req, res))

  // Direct conversation operations
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
