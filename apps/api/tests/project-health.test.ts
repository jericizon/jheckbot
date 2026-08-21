import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { execSync } from 'node:child_process'
import { ProjectHealthService, FileNotChangedError } from '../src/services/ProjectHealthService.js'
import { ProjectRepository } from '../src/repositories/ProjectRepository.js'
import { PathValidator, type AllowedRoot } from '../src/services/PathValidator.js'
import type { ProjectRecord } from '../src/repositories/ProjectRepository.js'

const TMP = join(tmpdir(), 'jheckbot-health-test')

const allowedRoots: AllowedRoot[] = [
  { id: 'root-1', name: 'TestRoot', path: TMP, enabled: true },
]

function git(cwd: string, args: string): void {
  execSync(`git -C ${JSON.stringify(cwd)} ${args}`, { stdio: 'pipe' })
}

describe('ProjectHealthService.getChanges', () => {
  let service: ProjectHealthService
  let project: ProjectRecord
  let repoPath: string

  beforeEach(() => {
    mkdirSync(TMP, { recursive: true })
    repoPath = join(TMP, 'my-project')
    mkdirSync(repoPath, { recursive: true })
    git(repoPath, 'init -q')
    git(repoPath, 'config user.email test@test.com')
    git(repoPath, 'config user.name Test')
    git(repoPath, 'config commit.gpgsign false')

    const repo = {
      findAllowedRoots: () => Promise.resolve(allowedRoots),
    } as unknown as ProjectRepository
    const factory = (roots: AllowedRoot[]) => new PathValidator(roots)
    service = new ProjectHealthService(repo, factory, '/usr/local/bin/devin')

    project = {
      id: 'proj-1',
      name: 'Test',
      slug: 'test',
      path: repoPath,
      description: null,
      enabled: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
  })

  afterEach(() => {
    rmSync(TMP, { recursive: true, force: true })
  })

  it('returns empty changes for a clean working tree', async () => {
    writeFileSync(join(repoPath, 'README.md'), 'hello')
    git(repoPath, 'add README.md')
    git(repoPath, 'commit -q -m init')

    const result = await service.getChanges(project)
    expect(result.projectId).toBe('proj-1')
    expect(result.changes).toEqual([])
    expect(['master', 'main']).toContain(result.branch)
  })

  it('detects untracked files', async () => {
    writeFileSync(join(repoPath, 'new.txt'), 'content')
    const result = await service.getChanges(project)
    const untracked = result.changes.find((c) => c.path === 'new.txt')
    expect(untracked).toBeDefined()
    expect(untracked!.status).toBe('untracked')
    expect(untracked!.staged).toBe(false)
  })

  it('detects modified files (unstaged)', async () => {
    writeFileSync(join(repoPath, 'file.txt'), 'v1')
    git(repoPath, 'add file.txt')
    git(repoPath, 'commit -q -m init')
    writeFileSync(join(repoPath, 'file.txt'), 'v2')

    const result = await service.getChanges(project)
    const mod = result.changes.find((c) => c.path === 'file.txt')
    expect(mod).toBeDefined()
    expect(mod!.status).toBe('modified')
    expect(mod!.staged).toBe(false)
  })

  it('detects staged files', async () => {
    writeFileSync(join(repoPath, 'staged.txt'), 'content')
    git(repoPath, 'add staged.txt')

    const result = await service.getChanges(project)
    const staged = result.changes.find((c) => c.path === 'staged.txt')
    expect(staged).toBeDefined()
    expect(staged!.staged).toBe(true)
    expect(staged!.status).toBe('added')
  })

  it('detects deleted files', async () => {
    writeFileSync(join(repoPath, 'gone.txt'), 'content')
    git(repoPath, 'add gone.txt')
    git(repoPath, 'commit -q -m init')
    execSync(`rm ${JSON.stringify(join(repoPath, 'gone.txt'))}`)

    const result = await service.getChanges(project)
    const del = result.changes.find((c) => c.path === 'gone.txt')
    expect(del).toBeDefined()
    expect(del!.status).toBe('deleted')
  })

  it('detects renamed files', async () => {
    writeFileSync(join(repoPath, 'old.txt'), 'content')
    git(repoPath, 'add old.txt')
    git(repoPath, 'commit -q -m init')
    execSync(`git -C ${JSON.stringify(repoPath)} mv old.txt new.txt`)

    const result = await service.getChanges(project)
    const renamed = result.changes.find((c) => c.status === 'renamed')
    expect(renamed).toBeDefined()
    expect(renamed!.path).toContain('old.txt')
    expect(renamed!.path).toContain('new.txt')
  })

  it('handles nested directory paths', async () => {
    mkdirSync(join(repoPath, 'src', 'utils'), { recursive: true })
    writeFileSync(join(repoPath, 'src', 'utils', 'helper.ts'), 'export {}')

    const result = await service.getChanges(project)
    const nested = result.changes.find((c) => c.path === 'src/utils/helper.ts')
    expect(nested).toBeDefined()
    expect(nested!.status).toBe('untracked')
  })

  it('returns empty array for a non-git directory', async () => {
    const nonGit = join(TMP, 'no-git')
    mkdirSync(nonGit, { recursive: true })
    const nonGitProject = { ...project, path: nonGit }
    const result = await service.getChanges(nonGitProject)
    expect(result.changes).toEqual([])
    expect(result.branch).toBeNull()
  })
})

describe('ProjectHealthService.getFileDiff', () => {
  let service: ProjectHealthService
  let project: ProjectRecord
  let repoPath: string

  beforeEach(() => {
    mkdirSync(TMP, { recursive: true })
    repoPath = join(TMP, 'diff-project')
    mkdirSync(repoPath, { recursive: true })
    git(repoPath, 'init -q')
    git(repoPath, 'config user.email test@test.com')
    git(repoPath, 'config user.name Test')
    git(repoPath, 'config commit.gpgsign false')

    const repo = {
      findAllowedRoots: () => Promise.resolve(allowedRoots),
    } as unknown as ProjectRepository
    const factory = (roots: AllowedRoot[]) => new PathValidator(roots)
    service = new ProjectHealthService(repo, factory, '/usr/local/bin/devin')

    project = {
      id: 'proj-1',
      name: 'Test',
      slug: 'test',
      path: repoPath,
      description: null,
      enabled: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
  })

  afterEach(() => {
    rmSync(TMP, { recursive: true, force: true })
  })

  it('throws FileNotChangedError for a path not in the changes list', async () => {
    await expect(service.getFileDiff(project, 'nonexistent.txt')).rejects.toBeInstanceOf(FileNotChangedError)
  })

  it('returns a diff against HEAD for a modified file', async () => {
    writeFileSync(join(repoPath, 'file.txt'), 'v1\n')
    git(repoPath, 'add file.txt')
    git(repoPath, 'commit -q -m init')
    writeFileSync(join(repoPath, 'file.txt'), 'v2\n')

    const result = await service.getFileDiff(project, 'file.txt')
    expect(result.path).toBe('file.txt')
    expect(result.status).toBe('modified')
    expect(result.diff).toContain('-v1')
    expect(result.diff).toContain('+v2')
    expect(result.diff).toContain('@@')
  })

  it('returns a synthesized new-file diff for an untracked file', async () => {
    writeFileSync(join(repoPath, 'new.txt'), 'fresh content\n')

    const result = await service.getFileDiff(project, 'new.txt')
    expect(result.status).toBe('untracked')
    expect(result.diff).toContain('+fresh content')
    expect(result.diff).toContain('@@')
  })

  it('shows staged and unstaged changes together against HEAD', async () => {
    writeFileSync(join(repoPath, 'f.txt'), 'line1\n')
    git(repoPath, 'add f.txt')
    git(repoPath, 'commit -q -m init')
    // Staged change
    writeFileSync(join(repoPath, 'f.txt'), 'line1\nstaged\n')
    git(repoPath, 'add f.txt')
    // Unstaged change on top
    writeFileSync(join(repoPath, 'f.txt'), 'line1\nstaged\nunstaged\n')

    const result = await service.getFileDiff(project, 'f.txt')
    expect(result.diff).toContain('+staged')
    expect(result.diff).toContain('+unstaged')
  })

  it('handles nested directory paths', async () => {
    mkdirSync(join(repoPath, 'src', 'utils'), { recursive: true })
    writeFileSync(join(repoPath, 'src', 'utils', 'helper.ts'), 'export const x = 1\n')

    const result = await service.getFileDiff(project, 'src/utils/helper.ts')
    expect(result.path).toBe('src/utils/helper.ts')
    expect(result.diff).toContain('+export const x = 1')
  })

  it('handles renamed files using the new path for diffing', async () => {
    writeFileSync(join(repoPath, 'old.txt'), 'content\n')
    git(repoPath, 'add old.txt')
    git(repoPath, 'commit -q -m init')
    execSync(`git -C ${JSON.stringify(repoPath)} mv old.txt new.txt`)

    const changes = await service.getChanges(project)
    const renamed = changes.changes.find((c) => c.status === 'renamed')
    expect(renamed).toBeDefined()
    const result = await service.getFileDiff(project, renamed!.path)
    expect(result.diff).toContain('new.txt')
  })
})
