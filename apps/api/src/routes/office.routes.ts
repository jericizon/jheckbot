import { Router } from 'express'
import { OfficeController } from '../controllers/OfficeController.js'

export function createOfficeProjectRouter(controller: OfficeController): Router {
  const router = Router({ mergeParams: true })
  router.get('/', (req, res) => controller.getOrCreateByProject(req, res))
  return router
}
