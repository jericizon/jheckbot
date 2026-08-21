import { Router } from 'express'
import { DataController } from '../controllers/DataController.js'

export function createDataRouter(controller: DataController): Router {
  const router = Router()

  // Destructive: wipes all projects, conversations, messages, and agent events.
  router.delete('/', (req, res) => controller.clearAll(req, res))

  return router
}
