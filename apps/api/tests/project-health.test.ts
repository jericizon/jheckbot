import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { execSync } from 'node:child_process'
import { ProjectHealthService } from '../src/services/ProjectHealthService.js'
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
