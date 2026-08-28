import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ProjectController } from '../src/controllers/ProjectController.js'
import {
  GitOperationError,
  InvalidBranchNameError,
  BranchNotFoundError,
} from '../src/services/ProjectHealthService.js'
import type { Request, Response } from 'express'

const projectId = '11111111-1111-1111-1111-111111111111'
const project = {
  id: projectId,
  name: 'Test',
  slug: 'test',
  path: '/tmp/x',
  description: null,
  enabled: true,
  created_at: '',
  updated_at: '',
}

function mockReq(opts: { params?: Record<string, string>; body?: Record<string, unknown> } = {}): Request {
  return {
    params: opts.params ?? { id: projectId },
    body: opts.body ?? {},
  } as unknown as Request
}

function mockRes(): Response & { statusCode: number; body: unknown } {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) { this.statusCode = code; return this },
    json(data: unknown) { this.body = data; return this },
    send() { return this },
  }
  return res as unknown as Response & { statusCode: number; body: unknown }
}

describe('ProjectController.branches', () => {
  let projectService: { get: ReturnType<typeof vi.fn> }
  let healthService: { listBranches: ReturnType<typeof vi.fn> }
  let controller: ProjectController

  beforeEach(() => {
    projectService = { get: vi.fn() }
    healthService = { listBranches: vi.fn() }
    controller = new ProjectController(projectService as never, healthService as never)
  })

  it('returns 404 when project is not found', async () => {
    projectService.get.mockResolvedValue(null)
    const res = mockRes()
    await controller.branches(mockReq(), res)
    expect(res.statusCode).toBe(404)
    expect(healthService.listBranches).not.toHaveBeenCalled()
  })

  it('returns the branch list on success', async () => {
    projectService.get.mockResolvedValue(project)
    healthService.listBranches.mockResolvedValue({
      projectId, current: 'main', local: [{ name: 'main', current: true, remote: false, remoteName: null }], remote: [], checkedAt: 'now',
    })
    const res = mockRes()
    await controller.branches(mockReq(), res)
    expect(res.statusCode).toBe(200)
    expect((res.body as { current: string }).current).toBe('main')
  })

  it('returns 422 on a git operation error', async () => {
    projectService.get.mockResolvedValue(project)
    healthService.listBranches.mockRejectedValue(new GitOperationError('no git'))
    const res = mockRes()
    await controller.branches(mockReq(), res)
    expect(res.statusCode).toBe(422)
  })
})

describe('ProjectController.createBranch', () => {
  let projectService: { get: ReturnType<typeof vi.fn> }
  let healthService: { createBranch: ReturnType<typeof vi.fn> }
  let controller: ProjectController

  beforeEach(() => {
    projectService = { get: vi.fn() }
    healthService = { createBranch: vi.fn() }
    controller = new ProjectController(projectService as never, healthService as never)
  })

  it('returns 400 when name is missing', async () => {
    const res = mockRes()
    await controller.createBranch(mockReq({ body: {} }), res)
    expect(res.statusCode).toBe(400)
    expect(projectService.get).not.toHaveBeenCalled()
  })

  it('returns 404 when project is not found', async () => {
    projectService.get.mockResolvedValue(null)
    const res = mockRes()
    await controller.createBranch(mockReq({ body: { name: 'feat' } }), res)
    expect(res.statusCode).toBe(404)
  })

  it('returns 400 on invalid branch name', async () => {
    projectService.get.mockResolvedValue(project)
    healthService.createBranch.mockRejectedValue(new InvalidBranchNameError('Invalid branch name'))
    const res = mockRes()
    await controller.createBranch(mockReq({ body: { name: '-bad' } }), res)
    expect(res.statusCode).toBe(400)
  })

  it('returns 422 when branch already exists', async () => {
    projectService.get.mockResolvedValue(project)
    healthService.createBranch.mockRejectedValue(new GitOperationError('Branch already exists: feat'))
    const res = mockRes()
    await controller.createBranch(mockReq({ body: { name: 'feat' } }), res)
    expect(res.statusCode).toBe(422)
  })

  it('returns 201 on success', async () => {
    projectService.get.mockResolvedValue(project)
    healthService.createBranch.mockResolvedValue({ projectId, branch: 'feat', base: 'main', checkedAt: 'now' })
    const res = mockRes()
    await controller.createBranch(mockReq({ body: { name: 'feat' } }), res)
    expect(res.statusCode).toBe(201)
    expect((res.body as { branch: string }).branch).toBe('feat')
  })
})

describe('ProjectController.checkout', () => {
  let projectService: { get: ReturnType<typeof vi.fn> }
  let healthService: { checkoutBranch: ReturnType<typeof vi.fn> }
  let controller: ProjectController

  beforeEach(() => {
    projectService = { get: vi.fn() }
    healthService = { checkoutBranch: vi.fn() }
    controller = new ProjectController(projectService as never, healthService as never)
  })

  it('returns 400 when name is missing', async () => {
    const res = mockRes()
    await controller.checkout(mockReq({ body: {} }), res)
    expect(res.statusCode).toBe(400)
  })

  it('returns 404 when branch is not found', async () => {
    projectService.get.mockResolvedValue(project)
    healthService.checkoutBranch.mockRejectedValue(new BranchNotFoundError('nope'))
    const res = mockRes()
    await controller.checkout(mockReq({ body: { name: 'nope' } }), res)
    expect(res.statusCode).toBe(404)
  })

  it('returns 422 when local changes would be overwritten', async () => {
    projectService.get.mockResolvedValue(project)
    healthService.checkoutBranch.mockRejectedValue(new GitOperationError('Local changes would be overwritten. Commit or stash before switching.'))
    const res = mockRes()
    await controller.checkout(mockReq({ body: { name: 'other' } }), res)
    expect(res.statusCode).toBe(422)
    expect((res.body as { error: string }).error).toContain('Commit or stash')
  })

  it('returns 200 on success', async () => {
    projectService.get.mockResolvedValue(project)
    healthService.checkoutBranch.mockResolvedValue({ projectId, branch: 'other', checkedAt: 'now' })
    const res = mockRes()
    await controller.checkout(mockReq({ body: { name: 'other' } }), res)
    expect(res.statusCode).toBe(200)
    expect((res.body as { branch: string }).branch).toBe('other')
  })
})
