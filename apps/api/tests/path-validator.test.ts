import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { PathValidator, type AllowedRoot } from '../src/services/PathValidator.js'

const TMP = join(tmpdir(), 'jheckbot-test-paths')

const allowedRoots: AllowedRoot[] = [
  { id: 'root-1', name: 'TestRoot', path: TMP, enabled: true },
]

describe('PathValidator', () => {
  beforeEach(() => {
    mkdirSync(join(TMP, 'valid-project'), { recursive: true })
    writeFileSync(join(TMP, 'valid-project', 'package.json'), '{}')
  })

  afterEach(() => {
    rmSync(TMP, { recursive: true, force: true })
  })

  it('accepts a path inside an allowed root', () => {
    const validator = new PathValidator(allowedRoots)
    const result = validator.validate(join(TMP, 'valid-project'))
    expect(result.valid).toBe(true)
    expect(result.resolvedPath).toBe(join(TMP, 'valid-project'))
  })

  it('rejects a relative path', () => {
    const validator = new PathValidator(allowedRoots)
    const result = validator.validate('relative/path')
    expect(result.valid).toBe(false)
    expect(result.error).toBe('Path must be absolute')
  })

  it('rejects a path outside all allowed roots', () => {
    const validator = new PathValidator(allowedRoots)
    const result = validator.validate('/etc')
    expect(result.valid).toBe(false)
    expect(result.error).toBe('Path is not under any allowed root')
  })

  it('rejects a non-existent path', () => {
    const validator = new PathValidator(allowedRoots)
    const result = validator.validate(join(TMP, 'does-not-exist'))
    expect(result.valid).toBe(false)
    expect(result.error).toBe('Path does not exist')
  })

  it('rejects a path that is a file, not a directory', () => {
    const validator = new PathValidator(allowedRoots)
    const result = validator.validate(join(TMP, 'valid-project', 'package.json'))
    expect(result.valid).toBe(false)
    expect(result.error).toBe('Path is not a directory')
  })

  it('rejects path traversal with ..', () => {
    const validator = new PathValidator(allowedRoots)
    const result = validator.validate(join(TMP, 'valid-project', '..', '..', '..', 'etc'))
    expect(result.valid).toBe(false)
  })

  it('rejects a symlink that points outside the allowed root', () => {
    const outsideDir = join(tmpdir(), 'jheckbot-outside')
    mkdirSync(outsideDir, { recursive: true })
    try {
      symlinkSync(outsideDir, join(TMP, 'symlink-outside'))
      const validator = new PathValidator(allowedRoots)
      const result = validator.validate(join(TMP, 'symlink-outside'))
      expect(result.valid).toBe(false)
      expect(result.error).toBe('Path is not under any allowed root')
    } finally {
      rmSync(outsideDir, { recursive: true, force: true })
    }
  })

  it('ignores disabled allowed roots', () => {
    const validator = new PathValidator([
      { ...allowedRoots[0], enabled: false },
    ])
    const result = validator.validate(join(TMP, 'valid-project'))
    expect(result.valid).toBe(false)
  })
})
