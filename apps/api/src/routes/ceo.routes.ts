import { Router } from 'express'
import { CEOController } from '../controllers/CEOController.js'

export function createCEORouter(controller: CEOController): Router {
  const router = Router({ mergeParams: true })

  router.get('/events', (req, res) => controller.listEvents(req, res))
  router.post('/messages', (req, res) => controller.sendMessage(req, res))

  return router
}
