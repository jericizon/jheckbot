import { Router } from 'express'
import { PushController } from '../controllers/PushController.js'

export function createPushRouter(controller: PushController): Router {
  const router = Router()

  router.get('/vapid-public-key', (req, res) => controller.getVapidPublicKey(req, res))
  router.post('/subscribe', (req, res) => controller.subscribe(req, res))
  router.post('/unsubscribe', (req, res) => controller.unsubscribe(req, res))
  router.post('/test', (req, res) => controller.testPush(req, res))

  return router
}
