import { Router } from 'express'
import { MediaController } from '../controllers/MediaController.js'

/**
 * Routes under /api/conversations/:id/media.
 * Mounted after the global auth middleware, so all endpoints require auth.
 */
export function createMediaRouter(controller: MediaController): Router {
  const router = Router({ mergeParams: true })

  router.get('/', (req, res) => controller.list(req, res))
  router.get('/:filename', (req, res) => controller.serve(req, res))

  return router
}
