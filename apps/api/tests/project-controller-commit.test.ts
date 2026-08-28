import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ProjectController } from '../src/controllers/ProjectController.js'
import { NoChangesError, GitOperationError } from '../src/services/ProjectHealthService.js'
import type { Request, Response } from 'express'

function mockReq(opts: { params?: Record<string, string>; body?: Record<string, unknown> } = {}): Request {
  return {
    params: opts.params ?? { id: '11111111-1111-1111-1111-111111111111' },
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

describe('ProjectController.generateCommitMessage', () => {
  const projectId = '11111111-1111-1111-1111-111111111111'
  const project = { id: projectId, name: 'Test', slug: 'test', path: '/tmp/x', description: null, enabled: true, created_at: '', updated_at: '' }
  let projectService: { get: ReturnType<typeof vi.fn> }
  let healthService: { generateCommitMessage: ReturnType<typeof vi.fn> }
  let controller: ProjectController

  beforeEach(() => {
    projectService = { get: vi.fn() }
    healthService = { generateCommitMessage: vi.fn() }
    controller = new ProjectController(
      projectService as never,
      healthService as never,
    )
  })

  it('returns 404 when project is not found', async () => {
    projectService.get.mockResolvedValue(null)
    const res = mockRes()
    await controller.generateCommitMessage(mockReq(), res)
    expect(res.statusCode).toBe(404)
    expect(healthService.generateCommitMessage).not.toHaveBeenCalled()
  })

  it('returns 400 when there are no changes', async () => {
    projectService.get.mockResolvedValue(project)
    healthService.generateCommitMessage.mockRejectedValue(new NoChangesError())
    const res = mockRes()
    await controller.generateCommitMessage(mockReq(), res)
    expect(res.statusCode).toBe(400)
    expect((res.body as { error: string }).error).toBe('No changes to commit')
  })

  it('returns the generated message on success', async () => {
    projectService.get.mockResolvedValue(project)
    healthService.generateCommitMessage.mockResolvedValue({
      projectId, message: 'chore: update 2 files\n\nModified (2):\n- a.ts\n- b.ts', fileCount: 2, checkedAt: 'now',
    })
    const res = mockRes()
    await controller.generateCommitMessage(mockReq(), res)
    expect(res.statusCode).toBe(200)
    expect((res.body as { message: string }).message).toContain('chore: update 2 files')
  })

  it('returns 400 for an invalid id format', async () => {
    const res = mockRes()
    await controller.generateCommitMessage(mockReq({ params: { id: 'not-a-uuid' } }), res)
    expect(res.statusCode).toBe(400)
    expect(projectService.get).not.toHaveBeenCalled()
  })
})

describe('ProjectController.commit', () => {
  const projectId = '11111111-1111-1111-1111-111111111111'
  const project = { id: projectId, name: 'Test', slug: 'test', path: '/tmp/x', description: null, enabled: true, created_at: '', updated_at: '' }
  let projectService: { get: ReturnType<typeof vi.fn> }
  let healthService: { commit: ReturnType<typeof vi.fn> }
  let controller: ProjectController

  beforeEach(() => {
    projectService = { get: vi.fn() }
    healthService = { commit: vi.fn() }
    controller = new ProjectController(
      projectService as never,
      healthService as never,
    )
  })

  it('returns 400 when message is missing', async () => {
    const res = mockRes()
    await controller.commit(mockReq({ body: {} }), res)
    expect(res.statusCode).toBe(400)
    expect((res.body as { error: string }).error).toContain('message is required')
    expect(healthService.commit).not.toHaveBeenCalled()
  })

  it('returns 400 when message is empty whitespace', async () => {
    const res = mockRes()
    await controller.commit(mockReq({ body: { message: '   ' } }), res)
    expect(res.statusCode).toBe(400)
    expect(healthService.commit).not.toHaveBeenCalled()
  })

  it('returns 404 when project is not found', async () => {
    projectService.get.mockResolvedValue(null)
    const res = mockRes()
    await controller.commit(mockReq({ body: { message: 'fix: test' } }), res)
    expect(res.statusCode).toBe(404)
    expect(healthService.commit).not.toHaveBeenCalled()
  })

  it('returns 400 when there are no changes', async () => {
    projectService.get.mockResolvedValue(project)
    healthService.commit.mockRejectedValue(new NoChangesError())
    const res = mockRes()
    await controller.commit(mockReq({ body: { message: 'fix: test' } }), res)
    expect(res.statusCode).toBe(400)
    expect((res.body as { error: string }).error).toBe('No changes to commit')
  })

  it('returns 422 when git operation fails (e.g. push)', async () => {
    projectService.get.mockResolvedValue(project)
    healthService.commit.mockRejectedValue(new GitOperationError('Commit succeeded but push failed: auth error'))
    const res = mockRes()
    await controller.commit(mockReq({ body: { message: 'fix: test' } }), res)
    expect(res.statusCode).toBe(422)
    expect((res.body as { error: string }).error).toContain('push failed')
  })

  it('returns the commit result on success', async () => {
    projectService.get.mockResolvedValue(project)
    healthService.commit.mockResolvedValue({
      projectId, branch: 'main', commitHash: 'abc123', pushed: true, commitMessage: 'fix: test', checkedAt: 'now',
    })
    const res = mockRes()
    await controller.commit(mockReq({ body: { message: 'fix: test' } }), res)
    expect(res.statusCode).toBe(200)
    expect((res.body as { commitHash: string }).commitHash).toBe('abc123')
    expect((res.body as { pushed: boolean }).pushed).toBe(true)
  })

  it('returns 400 for an invalid id format', async () => {
    const res = mockRes()
    await controller.commit(mockReq({ params: { id: 'not-a-uuid' }, body: { message: 'fix: test' } }), res)
    expect(res.statusCode).toBe(400)
    expect(projectService.get).not.toHaveBeenCalled()
  })
})
