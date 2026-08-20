import { Router } from 'express'
import { AgentController } from '../controllers/AgentController.js'

export function createAgentRouter(controller: AgentController): Router {
  const router = Router()

  router.get('/:id/agent', (req, res) => controller.getStatus(req, res))
  router.post('/:id/agent/start', (req, res) => controller.start(req, res))
  router.post('/:id/agent/stop', (req, res) => controller.stop(req, res))
  router.get('/:id/events', (req, res) => controller.streamEvents(req, res))

  return router
}
