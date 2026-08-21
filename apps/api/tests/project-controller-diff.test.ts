import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ProjectController } from '../src/controllers/ProjectController.js'
import { FileNotChangedError } from '../src/services/ProjectHealthService.js'
import type { Request, Response } from 'express'

function mockReq(opts: { params?: Record<string, string>; query?: Record<string, unknown> } = {}): Request {
  return {
    params: opts.params ?? { id: '11111111-1111-1111-1111-111111111111' },
    query: opts.query ?? {},
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

describe('ProjectController.diff', () => {
  const projectId = '11111111-1111-1111-1111-111111111111'
  const project = { id: projectId, name: 'Test', slug: 'test', path: '/tmp/x', description: null, enabled: true, created_at: '', updated_at: '' }
  let projectService: { get: ReturnType<typeof vi.fn> }
  let healthService: { getFileDiff: ReturnType<typeof vi.fn> }
  let controller: ProjectController

  beforeEach(() => {
    projectService = { get: vi.fn() }
    healthService = { getFileDiff: vi.fn() }
    controller = new ProjectController(
      projectService as never,
      healthService as never,
    )
  })

  it('returns 400 when path query param is missing', async () => {
    const res = mockRes()
    await controller.diff(mockReq({ query: {} }), res)
    expect(res.statusCode).toBe(400)
    expect((res.body as { error: string }).error).toContain('Missing path')
    expect(healthService.getFileDiff).not.toHaveBeenCalled()
  })

  it('returns 404 when project is not found', async () => {
    projectService.get.mockResolvedValue(null)
    const res = mockRes()
    await controller.diff(mockReq({ query: { path: 'file.txt' } }), res)
    expect(res.statusCode).toBe(404)
    expect(healthService.getFileDiff).not.toHaveBeenCalled()
  })

  it('returns 404 when the file is not in the changes list', async () => {
    projectService.get.mockResolvedValue(project)
    healthService.getFileDiff.mockRejectedValue(new FileNotChangedError('nope.txt'))
    const res = mockRes()
    await controller.diff(mockReq({ query: { path: 'nope.txt' } }), res)
    expect(res.statusCode).toBe(404)
    expect((res.body as { error: string }).error).toContain('nope.txt')
  })

  it('returns the diff payload on success', async () => {
    projectService.get.mockResolvedValue(project)
    healthService.getFileDiff.mockResolvedValue({
      projectId, path: 'file.txt', status: 'modified', staged: false, diff: '@@\n+v2', checkedAt: 'now',
    })
    const res = mockRes()
    await controller.diff(mockReq({ query: { path: 'file.txt' } }), res)
    expect(res.statusCode).toBe(200)
    expect((res.body as { diff: string }).diff).toBe('@@\n+v2')
  })

  it('returns 400 for an invalid id format', async () => {
    const res = mockRes()
    await controller.diff(mockReq({ params: { id: 'not-a-uuid' }, query: { path: 'file.txt' } }), res)
    expect(res.statusCode).toBe(400)
    expect(projectService.get).not.toHaveBeenCalled()
  })
})
