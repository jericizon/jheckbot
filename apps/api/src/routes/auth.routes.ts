import { Router } from 'express'
import type { Request, Response, NextFunction } from 'express'
import { AuthController } from '../controllers/AuthController.js'

export function createAuthRouter(
  controller: AuthController,
  requireAuth: (req: Request, res: Response, next: NextFunction) => void,
): Router {
  const router = Router()

  router.post('/login', (req, res) => controller.login(req, res))
  router.post('/logout', (req, res) => controller.logout(req, res))
  router.get('/me', requireAuth, (req, res) => controller.me(req, res))

  return router
}
