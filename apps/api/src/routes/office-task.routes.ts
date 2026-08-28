import { Router } from 'express'
import { OfficeTaskController } from '../controllers/OfficeTaskController.js'

/** Routes nested under /api/offices/:officeId/tasks */
export function createOfficeTasksByOfficeRouter(
  controller: OfficeTaskController,
): Router {
  const router = Router({ mergeParams: true })

  router.get('/', (req, res) => controller.listByOffice(req, res))
  router.post('/', (req, res) => controller.create(req, res))

  return router
}

/** Direct routes under /api/tasks/:id */
export function createOfficeTaskRouter(controller: OfficeTaskController): Router {
  const router = Router()

  // Dependency and dependent routes must be defined before the generic /:id
  // routes so they are matched first.
  router.get('/:id/dependencies', (req, res) => controller.listDependencies(req, res))
  router.post('/:id/dependencies', (req, res) => controller.addDependency(req, res))
  router.delete('/:id/dependencies/:dependsOnTaskId', (req, res) =>
    controller.removeDependency(req, res),
  )
  router.get('/:id/dependents', (req, res) => controller.getDependents(req, res))
  router.post('/:id/status', (req, res) => controller.setStatus(req, res))

  router.get('/:id', (req, res) => controller.get(req, res))
  router.patch('/:id', (req, res) => controller.update(req, res))
  router.delete('/:id', (req, res) => controller.delete(req, res))

  return router
}
