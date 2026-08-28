import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { MediaService } from '../src/services/MediaService.js'
import { MediaController } from '../src/controllers/MediaController.js'
import type { Request, Response } from 'express'

const TMP = join(tmpdir(), 'jheckbot-test-media-controller')
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

describe('MediaController', () => {
  let service: MediaService
  let controller: MediaController

  beforeEach(() => {
    rmSync(TMP, { recursive: true, force: true })
    service = new MediaService(TMP)
    controller = new MediaController(service)
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

    it('returns an empty list for a conversation with no media', async () => {
      const req = mockReq({ id: CONV_ID })
      const res = mockRes()
      await controller.list(req, res)
      expect(res.statusCode).toBe(200)
      expect((res.body as { media: unknown[] }).media).toEqual([])
    })

    it('returns media files that exist', async () => {
      const dir = service.ensureConversationDir(CONV_ID)
      writeFileSync(join(dir, 'shot.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]))
      writeFileSync(join(dir, 'clip.mp4'), Buffer.from([0x00, 0x00]))
      const req = mockReq({ id: CONV_ID })
      const res = mockRes()
      await controller.list(req, res)
      const media = (res.body as { media: { filename: string; kind: string }[] }).media
      expect(media).toHaveLength(2)
      expect(media.map((m) => m.filename).sort()).toEqual(['clip.mp4', 'shot.png'])
    })
  })

  describe('serve', () => {
    it('returns 400 for an invalid conversation id', async () => {
      const req = mockReq({ id: 'nope', filename: 'shot.png' })
      const res = mockRes()
      await controller.serve(req, res)
      expect(res.statusCode).toBe(400)
    })

    it('returns 404 for a missing file', async () => {
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

    it('serves an MP4 with the correct content type', async () => {
      const dir = service.ensureConversationDir(CONV_ID)
      const mp4Bytes = Buffer.from([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70])
      writeFileSync(join(dir, 'clip.mp4'), mp4Bytes)
      const req = mockReq({ id: CONV_ID, filename: 'clip.mp4' })
      const res = mockRes()
      await controller.serve(req, res)
      expect(res.statusCode).toBe(200)
      expect(res.headers['Content-Type']).toBe('video/mp4')
      expect(res.sent).toEqual(mp4Bytes)
    })

    it('returns 404 for an unsupported file extension', async () => {
      const dir = service.ensureConversationDir(CONV_ID)
      writeFileSync(join(dir, 'notes.txt'), 'hi')
      const req = mockReq({ id: CONV_ID, filename: 'notes.txt' })
      const res = mockRes()
      await controller.serve(req, res)
      expect(res.statusCode).toBe(404)
    })
  })
})
