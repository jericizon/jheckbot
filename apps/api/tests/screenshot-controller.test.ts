import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { ScreenshotService } from '../src/services/ScreenshotService.js'
import { ScreenshotController } from '../src/controllers/ScreenshotController.js'
import type { Request, Response } from 'express'

const TMP = join(tmpdir(), 'jheckbot-test-screenshot-controller')
const CONV_ID = '00000000-0000-0000-0000-000000000001'

function mockReq(params: Record<string, string> = {}): Request {
  return { params } as unknown as Request
}

function mockRes(): Response & {
  statusCode: number
  body: unknown
  headers: Record<string, string>
  sent: Buffer | null
} {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    headers: {} as Record<string, string>,
    sent: null as Buffer | null,
    status(code: number) { this.statusCode = code; return this },
    json(data: unknown) { this.body = data; return this },
    setHeader(name: string, value: string) { this.headers[name] = value; return this },
    send(data: Buffer) { this.sent = data; return this },
  }
  return res as unknown as Response & {
    statusCode: number
    body: unknown
    headers: Record<string, string>
    sent: Buffer | null
  }
}

describe('ScreenshotController', () => {
  let service: ScreenshotService
  let controller: ScreenshotController

  beforeEach(() => {
    rmSync(TMP, { recursive: true, force: true })
    service = new ScreenshotService(TMP)
    controller = new ScreenshotController(service)
  })

  afterEach(() => {
    rmSync(TMP, { recursive: true, force: true })
  })

  describe('list', () => {
    it('returns 400 for an invalid conversation id', async () => {
      const req = mockReq({ id: 'not-a-uuid' })
      const res = mockRes()
      await controller.list(req, res)
      expect(res.statusCode).toBe(400)
    })

    it('returns an empty list for a conversation with no screenshots', async () => {
      const req = mockReq({ id: CONV_ID })
      const res = mockRes()
      await controller.list(req, res)
      expect(res.statusCode).toBe(200)
      expect((res.body as { screenshots: unknown[] }).screenshots).toEqual([])
    })

    it('returns screenshots that exist', async () => {
      const dir = service.ensureConversationDir(CONV_ID)
      writeFileSync(join(dir, 'shot.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]))
      const req = mockReq({ id: CONV_ID })
      const res = mockRes()
      await controller.list(req, res)
      const screenshots = (res.body as { screenshots: { filename: string }[] }).screenshots
      expect(screenshots).toHaveLength(1)
      expect(screenshots[0].filename).toBe('shot.png')
    })
  })

  describe('serve', () => {
    it('returns 400 for an invalid conversation id', async () => {
      const req = mockReq({ id: 'nope', filename: 'shot.png' })
      const res = mockRes()
      await controller.serve(req, res)
      expect(res.statusCode).toBe(400)
    })

    it('returns 404 for a missing screenshot', async () => {
      const req = mockReq({ id: CONV_ID, filename: 'missing.png' })
      const res = mockRes()
      await controller.serve(req, res)
      expect(res.statusCode).toBe(404)
    })

    it('returns 404 for a traversal attempt', async () => {
      const req = mockReq({ id: CONV_ID, filename: '../shot.png' })
      const res = mockRes()
      await controller.serve(req, res)
      expect(res.statusCode).toBe(404)
    })

    it('serves a PNG with the correct content type', async () => {
      const dir = service.ensureConversationDir(CONV_ID)
      const pngBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a])
      writeFileSync(join(dir, 'shot.png'), pngBytes)
      const req = mockReq({ id: CONV_ID, filename: 'shot.png' })
      const res = mockRes()
      await controller.serve(req, res)
      expect(res.statusCode).toBe(200)
      expect(res.headers['Content-Type']).toBe('image/png')
      expect(res.sent).toEqual(pngBytes)
    })
  })
})
