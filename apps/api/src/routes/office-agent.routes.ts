import { Router } from 'express'
import { OfficeAgentController } from '../controllers/OfficeAgentController.js'

/** Routes nested under /api/offices/:officeId/agents */
export function createOfficeAgentsByOfficeRouter(
  controller: OfficeAgentController,
): Router {
  const router = Router({ mergeParams: true })

  router.get('/', (req, res) => controller.listByOffice(req, res))
  router.post('/', (req, res) => controller.create(req, res))

  return router
}

/** Direct routes under /api/agents/:id */
export function createOfficeAgentRouter(controller: OfficeAgentController): Router {
  const router = Router()

  // Capability and state routes must be defined before the generic /:id routes
  // so they are matched first.
  router.post('/:id/enable', (req, res) => controller.enable(req, res))
  router.post('/:id/disable', (req, res) => controller.disable(req, res))
  router.get('/:id/capabilities', (req, res) => controller.listCapabilities(req, res))
  router.post('/:id/capabilities', (req, res) => controller.addCapability(req, res))
  router.delete('/:id/capabilities/:capability', (req, res) =>
    controller.removeCapability(req, res),
  )

  router.get('/:id', (req, res) => controller.get(req, res))
  router.patch('/:id', (req, res) => controller.update(req, res))
  router.delete('/:id', (req, res) => controller.delete(req, res))

  return router
}
