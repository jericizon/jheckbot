import { Router } from 'express'
import { ProjectController } from '../controllers/ProjectController.js'

export function createProjectRouter(controller: ProjectController): Router {
  const router = Router()

  router.get('/', (req, res) => controller.list(req, res))
  router.post('/', (req, res) => controller.create(req, res))
  router.get('/:id', (req, res) => controller.get(req, res))
  router.patch('/:id', (req, res) => controller.update(req, res))
  router.delete('/:id', (req, res) => controller.delete(req, res))
  router.post('/:id/validate', (req, res) => controller.validate(req, res))
  router.post('/:id/health', (req, res) => controller.health(req, res))
  router.get('/:id/branch', (req, res) => controller.branch(req, res))
  router.get('/:id/changes', (req, res) => controller.changes(req, res))
  router.get('/:id/diff', (req, res) => controller.diff(req, res))
  router.post('/:id/commit/generate', (req, res) => controller.generateCommitMessage(req, res))
  router.post('/:id/commit', (req, res) => controller.commit(req, res))

  return router
}
