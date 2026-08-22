import { Router } from 'express'
import { ScreenshotController } from '../controllers/ScreenshotController.js'

/**
 * Routes under /api/conversations/:id/screenshots.
 * Mounted after the global auth middleware, so all endpoints require auth.
 */
export function createScreenshotRouter(controller: ScreenshotController): Router {
  const router = Router({ mergeParams: true })

  router.get('/', (req, res) => controller.list(req, res))
  router.get('/:filename', (req, res) => controller.serve(req, res))

  return router
}
