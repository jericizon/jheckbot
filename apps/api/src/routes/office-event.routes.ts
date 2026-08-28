import { Router } from 'express'
import { OfficeEventController } from '../controllers/OfficeEventController.js'

/** Routes nested under /api/offices/:officeId/events */
export function createOfficeEventsByOfficeRouter(
  controller: OfficeEventController,
): Router {
  const router = Router({ mergeParams: true })

  router.get('/', (req, res) => controller.listByOffice(req, res))
  router.post('/', (req, res) => controller.create(req, res))
  router.get('/stream', (req, res) => controller.stream(req, res))

  return router
}

/** Direct routes under /api/events/:id */
export function createOfficeEventRouter(controller: OfficeEventController): Router {
  const router = Router()

  router.get('/:id', (req, res) => controller.get(req, res))

  return router
}
