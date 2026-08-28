import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DataController } from '../src/controllers/DataController.js'
import { DataService } from '../src/services/DataService.js'
import type { Request, Response } from 'express'

function mockReq(body: Record<string, unknown> = {}): Request {
  return { body } as unknown as Request
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

describe('DataController.clearAll', () => {
  let dataService: DataService
  let controller: DataController

  beforeEach(() => {
    dataService = {
      clearAll: vi.fn(),
    } as unknown as DataService
    controller = new DataController(dataService)
  })

  it('returns 400 when confirmation token is missing', async () => {
    const req = mockReq({})
    const res = mockRes()
    await controller.clearAll(req, res)

    expect(res.statusCode).toBe(400)
    expect((res.body as { error: string }).error).toContain('Confirmation required')
    expect(dataService.clearAll).not.toHaveBeenCalled()
  })

  it('returns 400 when confirmation token is wrong', async () => {
    const req = mockReq({ confirm: 'yes' })
    const res = mockRes()
    await controller.clearAll(req, res)

    expect(res.statusCode).toBe(400)
    expect(dataService.clearAll).not.toHaveBeenCalled()
  })

  it('deletes all data when the correct token is provided', async () => {
    vi.mocked(dataService.clearAll).mockResolvedValue({ stoppedAgents: 2, deletedProjects: 5 })
    const req = mockReq({ confirm: 'DELETE EVERYTHING' })
    const res = mockRes()
    await controller.clearAll(req, res)

    expect(res.statusCode).toBe(200)
    expect((res.body as { stoppedAgents: number; deletedProjects: number })).toEqual({
      stoppedAgents: 2,
      deletedProjects: 5,
    })
    expect(dataService.clearAll).toHaveBeenCalledTimes(1)
  })

  it('rethrows unexpected service errors to the generic handler', async () => {
    vi.mocked(dataService.clearAll).mockRejectedValue(new Error('db down'))
    const req = mockReq({ confirm: 'DELETE EVERYTHING' })
    const res = mockRes()

    await expect(controller.clearAll(req, res)).rejects.toThrow('db down')
  })
})
