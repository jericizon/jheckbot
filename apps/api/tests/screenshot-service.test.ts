import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, rmSync, writeFileSync, symlinkSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { ScreenshotService } from '../src/services/ScreenshotService.js'

const TMP = join(tmpdir(), 'jheckbot-test-screenshots')
const CONV_ID = '00000000-0000-0000-0000-000000000001'

describe('ScreenshotService', () => {
  let service: ScreenshotService

  beforeEach(() => {
    rmSync(TMP, { recursive: true, force: true })
    service = new ScreenshotService(TMP)
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
    })

    it('resolves an existing PNG inside the conversation dir', () => {
      const path = service.resolveSafePath(CONV_ID, 'shot.png')
      expect(path).not.toBeNull()
      expect(path!.endsWith('shot.png')).toBe(true)
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

    it('rejects non-PNG files', () => {
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

  describe('listScreenshots', () => {
    beforeEach(() => {
      const dir = service.ensureConversationDir(CONV_ID)
      writeFileSync(join(dir, 'a.png'), Buffer.from([0x89]))
      writeFileSync(join(dir, 'b.png'), Buffer.from([0x89]))
      writeFileSync(join(dir, 'ignore.txt'), 'hi')
    })

    it('lists only PNG files', () => {
      const list = service.listScreenshots(CONV_ID)
      expect(list).toHaveLength(2)
      expect(list.map((s) => s.filename).sort()).toEqual(['a.png', 'b.png'])
    })

    it('includes url, size, and createdAt', () => {
      const list = service.listScreenshots(CONV_ID)
      expect(list[0].url).toBe(`/api/conversations/${CONV_ID}/screenshots/${list[0].filename}`)
      expect(list[0].size).toBeGreaterThan(0)
      expect(typeof list[0].createdAt).toBe('string')
    })

    it('returns empty for a conversation with no directory', () => {
      expect(service.listScreenshots('00000000-0000-0000-0000-000000000002')).toEqual([])
    })
  })

  describe('scanForNew', () => {
    it('returns filenames not in the known set', () => {
      const dir = service.ensureConversationDir(CONV_ID)
      writeFileSync(join(dir, 'first.png'), Buffer.from([0x89]))
      writeFileSync(join(dir, 'second.png'), Buffer.from([0x89]))

      const known = new Set<string>(['first.png'])
      const fresh = service.scanForNew(CONV_ID, known)
      expect(fresh).toEqual(['second.png'])
    })

    it('ignores non-PNG files', () => {
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

  describe('markdownImage and publicUrl', () => {
    it('produces a markdown image link', () => {
      expect(service.markdownImage(CONV_ID, 'shot.png'))
        .toBe(`![screenshot](/api/conversations/${CONV_ID}/screenshots/shot.png)`)
    })

    it('produces a public url', () => {
      expect(service.publicUrl(CONV_ID, 'shot.png'))
        .toBe(`/api/conversations/${CONV_ID}/screenshots/shot.png`)
    })
  })

  describe('deleteConversationScreenshots', () => {
    it('removes the conversation directory', () => {
      const dir = service.ensureConversationDir(CONV_ID)
      writeFileSync(join(dir, 'shot.png'), Buffer.from([0x89]))
      service.deleteConversationScreenshots(CONV_ID)
      expect(existsSync(dir)).toBe(false)
    })

    it('does not throw when the directory does not exist', () => {
      expect(() => service.deleteConversationScreenshots(CONV_ID)).not.toThrow()
    })
  })
})
