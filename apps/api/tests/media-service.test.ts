import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, rmSync, writeFileSync, symlinkSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { MediaService, mediaKind, mimeTypeFor } from '../src/services/MediaService.js'

const TMP = join(tmpdir(), 'jheckbot-test-media')
const CONV_ID = '00000000-0000-0000-0000-000000000001'

describe('mediaKind', () => {
  it('identifies image extensions', () => {
    expect(mediaKind('shot.png')).toBe('image')
    expect(mediaKind('photo.jpg')).toBe('image')
    expect(mediaKind('photo.jpeg')).toBe('image')
    expect(mediaKind('anim.gif')).toBe('image')
    expect(mediaKind('pic.webp')).toBe('image')
    expect(mediaKind('logo.svg')).toBe('image')
  })

  it('identifies video extensions', () => {
    expect(mediaKind('clip.mp4')).toBe('video')
    expect(mediaKind('clip.webm')).toBe('video')
    expect(mediaKind('clip.mov')).toBe('video')
    expect(mediaKind('clip.ogv')).toBe('video')
  })

  it('returns null for unsupported extensions', () => {
    expect(mediaKind('readme.md')).toBeNull()
    expect(mediaKind('data.json')).toBeNull()
    expect(mediaKind('archive.zip')).toBeNull()
  })
})

describe('mimeTypeFor', () => {
  it('returns the correct mime type for images', () => {
    expect(mimeTypeFor('shot.png')).toBe('image/png')
    expect(mimeTypeFor('photo.jpg')).toBe('image/jpeg')
    expect(mimeTypeFor('pic.webp')).toBe('image/webp')
    expect(mimeTypeFor('logo.svg')).toBe('image/svg+xml')
  })

  it('returns the correct mime type for videos', () => {
    expect(mimeTypeFor('clip.mp4')).toBe('video/mp4')
    expect(mimeTypeFor('clip.webm')).toBe('video/webm')
    expect(mimeTypeFor('clip.mov')).toBe('video/quicktime')
  })

  it('falls back to octet-stream for unknown extensions', () => {
    expect(mimeTypeFor('file.xyz')).toBe('application/octet-stream')
  })
})

describe('MediaService', () => {
  let service: MediaService

  beforeEach(() => {
    rmSync(TMP, { recursive: true, force: true })
    service = new MediaService(TMP)
  })

  afterEach(() => {
    rmSync(TMP, { recursive: true, force: true })
  })

  describe('ensureConversationDir', () => {
    it('creates the conversation directory', () => {
      const dir = service.ensureConversationDir(CONV_ID)
      expect(existsSync(dir)).toBe(true)
    })

    it('is idempotent', () => {
      service.ensureConversationDir(CONV_ID)
      const dir = service.ensureConversationDir(CONV_ID)
      expect(existsSync(dir)).toBe(true)
    })
  })

  describe('resolveSafePath', () => {
    beforeEach(() => {
      const dir = service.ensureConversationDir(CONV_ID)
      writeFileSync(join(dir, 'shot.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]))
      writeFileSync(join(dir, 'clip.mp4'), Buffer.from([0x00, 0x00, 0x00, 0x18]))
    })

    it('resolves an existing PNG inside the conversation dir', () => {
      const path = service.resolveSafePath(CONV_ID, 'shot.png')
      expect(path).not.toBeNull()
      expect(path!.endsWith('shot.png')).toBe(true)
    })

    it('resolves an existing MP4 inside the conversation dir', () => {
      const path = service.resolveSafePath(CONV_ID, 'clip.mp4')
      expect(path).not.toBeNull()
      expect(path!.endsWith('clip.mp4')).toBe(true)
    })

    it('rejects a non-existent file', () => {
      expect(service.resolveSafePath(CONV_ID, 'missing.png')).toBeNull()
    })

    it('rejects a path with separators', () => {
      expect(service.resolveSafePath(CONV_ID, 'sub/shot.png')).toBeNull()
    })

    it('rejects traversal attempts', () => {
      expect(service.resolveSafePath(CONV_ID, '..')).toBeNull()
      expect(service.resolveSafePath(CONV_ID, '../shot.png')).toBeNull()
    })

    it('rejects unsupported file types', () => {
      const dir = service.conversationDir(CONV_ID)
      writeFileSync(join(dir, 'notes.txt'), 'hi')
      expect(service.resolveSafePath(CONV_ID, 'notes.txt')).toBeNull()
    })

    it('rejects a symlink that escapes the conversation dir', () => {
      const outside = join(TMP, 'outside.png')
      writeFileSync(outside, Buffer.from([0x89]))
      const dir = service.conversationDir(CONV_ID)
      try {
        symlinkSync(outside, join(dir, 'escape.png'))
      } catch {
        // symlink creation may fail on some systems without privileges
        return
      }
      expect(service.resolveSafePath(CONV_ID, 'escape.png')).toBeNull()
    })
  })

  describe('listMedia', () => {
    beforeEach(() => {
      const dir = service.ensureConversationDir(CONV_ID)
      writeFileSync(join(dir, 'a.png'), Buffer.from([0x89]))
      writeFileSync(join(dir, 'b.mp4'), Buffer.from([0x00]))
      writeFileSync(join(dir, 'ignore.txt'), 'hi')
    })

    it('lists only image and video files', () => {
      const list = service.listMedia(CONV_ID)
      expect(list).toHaveLength(2)
      expect(list.map((m) => m.filename).sort()).toEqual(['a.png', 'b.mp4'])
    })

    it('includes kind, mimeType, url, size, and createdAt', () => {
      const list = service.listMedia(CONV_ID)
      const png = list.find((m) => m.filename === 'a.png')!
      expect(png.kind).toBe('image')
      expect(png.mimeType).toBe('image/png')
      expect(png.url).toBe(`/api/conversations/${CONV_ID}/media/a.png`)
      expect(png.size).toBeGreaterThan(0)
      expect(typeof png.createdAt).toBe('string')

      const mp4 = list.find((m) => m.filename === 'b.mp4')!
      expect(mp4.kind).toBe('video')
      expect(mp4.mimeType).toBe('video/mp4')
    })

    it('returns empty for a conversation with no directory', () => {
      expect(service.listMedia('00000000-0000-0000-0000-000000000002')).toEqual([])
    })
  })

  describe('scanForNew', () => {
    it('returns filenames not in the known set', () => {
      const dir = service.ensureConversationDir(CONV_ID)
      writeFileSync(join(dir, 'first.png'), Buffer.from([0x89]))
      writeFileSync(join(dir, 'second.mp4'), Buffer.from([0x00]))

      const known = new Set<string>(['first.png'])
      const fresh = service.scanForNew(CONV_ID, known)
      expect(fresh).toEqual(['second.mp4'])
    })

    it('ignores unsupported file types', () => {
      const dir = service.ensureConversationDir(CONV_ID)
      writeFileSync(join(dir, 'shot.png'), Buffer.from([0x89]))
      writeFileSync(join(dir, 'readme.md'), 'hi')

      const fresh = service.scanForNew(CONV_ID, new Set())
      expect(fresh).toEqual(['shot.png'])
    })

    it('returns empty when the directory does not exist', () => {
      expect(service.scanForNew(CONV_ID, new Set())).toEqual([])
    })
  })

  describe('markdownFor and publicUrl', () => {
    it('produces a markdown image link for images', () => {
      expect(service.markdownFor(CONV_ID, 'shot.png'))
        .toBe(`![media](/api/conversations/${CONV_ID}/media/shot.png)`)
    })

    it('produces a markdown image link for videos (renderer detects video ext)', () => {
      expect(service.markdownFor(CONV_ID, 'clip.mp4'))
        .toBe(`![media](/api/conversations/${CONV_ID}/media/clip.mp4)`)
    })

    it('produces a public url', () => {
      expect(service.publicUrl(CONV_ID, 'shot.png'))
        .toBe(`/api/conversations/${CONV_ID}/media/shot.png`)
    })
  })

  describe('deleteConversationMedia', () => {
    it('removes the conversation directory', () => {
      const dir = service.ensureConversationDir(CONV_ID)
      writeFileSync(join(dir, 'shot.png'), Buffer.from([0x89]))
      service.deleteConversationMedia(CONV_ID)
      expect(existsSync(dir)).toBe(false)
    })

    it('does not throw when the directory does not exist', () => {
      expect(() => service.deleteConversationMedia(CONV_ID)).not.toThrow()
    })
  })
})
