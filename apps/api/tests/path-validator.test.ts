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
    // Create a git repo for relative resolution tests
    mkdirSync(join(TMP, 'git-project'), { recursive: true })
    mkdirSync(join(TMP, 'git-project', '.git'), { recursive: true })
    // Non-git directory
    mkdirSync(join(TMP, 'no-git'), { recursive: true })
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

  describe('resolveRelative', () => {
    it('resolves a relative path with leading slash against an allowed root', () => {
      const validator = new PathValidator(allowedRoots)
      const result = validator.resolveRelative('/git-project')
      expect(result.valid).toBe(true)
      expect(result.resolvedPath).toBe(join(TMP, 'git-project'))
    })

    it('resolves a relative path without leading slash', () => {
      const validator = new PathValidator(allowedRoots)
      const result = validator.resolveRelative('git-project')
      expect(result.valid).toBe(true)
      expect(result.resolvedPath).toBe(join(TMP, 'git-project'))
    })

    it('resolves a nested relative path', () => {
      mkdirSync(join(TMP, 'nested', 'deep-project', '.git'), { recursive: true })
      const validator = new PathValidator(allowedRoots)
      const result = validator.resolveRelative('/nested/deep-project')
      expect(result.valid).toBe(true)
      expect(result.resolvedPath).toBe(join(TMP, 'nested', 'deep-project'))
    })

    it('rejects a relative path when the directory has no .git folder', () => {
      const validator = new PathValidator(allowedRoots)
      const result = validator.resolveRelative('/no-git')
      expect(result.valid).toBe(false)
      expect(result.error).toContain('not a git repository')
    })

    it('rejects a relative path that does not exist under any root', () => {
      const validator = new PathValidator(allowedRoots)
      const result = validator.resolveRelative('does-not-exist')
      expect(result.valid).toBe(false)
      expect(result.error).toContain('not found under any allowed root')
    })

    it('falls back to validate() for absolute paths', () => {
      const validator = new PathValidator(allowedRoots)
      const result = validator.resolveRelative(join(TMP, 'git-project'))
      expect(result.valid).toBe(true)
      expect(result.resolvedPath).toBe(join(TMP, 'git-project'))
    })

    it('rejects an absolute path under root WITHOUT .git', () => {
      const validator = new PathValidator(allowedRoots)
      const result = validator.resolveRelative(join(TMP, 'no-git'))
      expect(result.valid).toBe(false)
      expect(result.error).toContain('not a git repository')
    })

    it('accepts an absolute path under root WITH .git', () => {
      const validator = new PathValidator(allowedRoots)
      const result = validator.resolveRelative(join(TMP, 'git-project'))
      expect(result.valid).toBe(true)
      expect(result.resolvedPath).toBe(join(TMP, 'git-project'))
    })

    it('accepts a worktree .git file (not a directory)', () => {
      mkdirSync(join(TMP, 'worktree-project'), { recursive: true })
      // A git worktree stores a .git *file* pointing to the parent repo, not a directory.
      writeFileSync(join(TMP, 'worktree-project', '.git'), 'gitdir: /tmp/jheckbot-test-paths/git-project/.git/worktrees/wt')
      const validator = new PathValidator(allowedRoots)
      const result = validator.resolveRelative('/worktree-project')
      expect(result.valid).toBe(true)
      expect(result.resolvedPath).toBe(join(TMP, 'worktree-project'))
    })

    it('rejects an empty path', () => {
      const validator = new PathValidator(allowedRoots)
      const result = validator.resolveRelative('')
      expect(result.valid).toBe(false)
      expect(result.error).toBe('Path is required')
    })

    it('rejects path traversal with ..', () => {
      const validator = new PathValidator(allowedRoots)
      const result = validator.resolveRelative('../../../etc')
      expect(result.valid).toBe(false)
    })
  })
})
