import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { execSync } from 'node:child_process'
import {
  ProjectHealthService,
  InvalidBranchNameError,
  BranchNotFoundError,
  GitOperationError,
} from '../src/services/ProjectHealthService.js'
import { ProjectRepository } from '../src/repositories/ProjectRepository.js'
import { PathValidator, type AllowedRoot } from '../src/services/PathValidator.js'
import type { ProjectRecord } from '../src/repositories/ProjectRepository.js'

const TMP = join(tmpdir(), 'jheckbot-branches-test')

const allowedRoots: AllowedRoot[] = [
  { id: 'root-1', name: 'TestRoot', path: TMP, enabled: true },
]

function git(cwd: string, args: string): void {
  execSync(`git -C ${JSON.stringify(cwd)} ${args}`, { stdio: 'pipe' })
}

describe('ProjectHealthService branch management', () => {
  let service: ProjectHealthService
  let project: ProjectRecord
  let repoPath: string

  beforeEach(() => {
    mkdirSync(TMP, { recursive: true })
    repoPath = join(TMP, 'my-project')
    mkdirSync(repoPath, { recursive: true })
    git(repoPath, 'init -q -b main')
    git(repoPath, 'config user.email test@test.com')
    git(repoPath, 'config user.name Test')
    git(repoPath, 'config commit.gpgsign false')

    // Initial commit so HEAD exists and branch is "main".
    writeFileSync(join(repoPath, 'README.md'), 'hello\n')
    git(repoPath, 'add README.md')
    git(repoPath, 'commit -q -m init')

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

  describe('listBranches', () => {
    it('returns the current branch and lists local branches', async () => {
      git(repoPath, 'branch feature-a')
      const result = await service.listBranches(project)
      expect(result.current).toBe('main')
      const names = result.local.map((b) => b.name)
      expect(names).toContain('main')
      expect(names).toContain('feature-a')
      const current = result.local.find((b) => b.name === 'main')
      expect(current?.current).toBe(true)
      const other = result.local.find((b) => b.name === 'feature-a')
      expect(other?.current).toBe(false)
    })

    it('lists remote branches separately', async () => {
      // Create a bare "remote" and push a branch to it.
      const remotePath = join(TMP, 'remote.git')
      execSync(`git init -q --bare ${JSON.stringify(remotePath)}`)
      git(repoPath, `remote add origin ${JSON.stringify(remotePath)}`)
      git(repoPath, 'push -q origin main')

      const result = await service.listBranches(project)
      const remoteNames = result.remote.map((b) => b.name)
      expect(remoteNames).toContain('main')
      expect(result.remote.find((b) => b.name === 'main')?.remoteName).toBe('origin')
      // Local "main" should not appear in the remote list as current.
      expect(result.local.find((b) => b.name === 'main')?.current).toBe(true)
    })
  })

  describe('createBranch', () => {
    it('creates a new branch from current HEAD and switches to it', async () => {
      const result = await service.createBranch(project, 'feature-x')
      expect(result.branch).toBe('feature-x')
      expect(result.base).toBe('main')
      // HEAD should now be on feature-x
      const after = await service.getBranch(project)
      expect(after.branch).toBe('feature-x')
    })

    it('rejects invalid branch names', async () => {
      await expect(service.createBranch(project, 'feat..x')).rejects.toBeInstanceOf(InvalidBranchNameError)
      await expect(service.createBranch(project, '-bad')).rejects.toBeInstanceOf(InvalidBranchNameError)
      await expect(service.createBranch(project, 'has space')).rejects.toBeInstanceOf(InvalidBranchNameError)
      await expect(service.createBranch(project, '')).rejects.toBeInstanceOf(InvalidBranchNameError)
    })

    it('rejects duplicate branch names with a GitOperationError', async () => {
      git(repoPath, 'branch existing')
      await expect(service.createBranch(project, 'existing')).rejects.toBeInstanceOf(GitOperationError)
    })
  })

  describe('checkoutBranch', () => {
    it('switches to an existing local branch', async () => {
      git(repoPath, 'branch feature-y')
      const result = await service.checkoutBranch(project, 'feature-y')
      expect(result.branch).toBe('feature-y')
      const after = await service.getBranch(project)
      expect(after.branch).toBe('feature-y')
    })

    it('throws BranchNotFoundError for a non-existent branch', async () => {
      await expect(service.checkoutBranch(project, 'nope')).rejects.toBeInstanceOf(BranchNotFoundError)
    })

    it('throws GitOperationError when local changes would be overwritten', async () => {
      git(repoPath, 'branch other')
      // Commit a divergent version of README.md on `other` so the uncommitted
      // change on main would be overwritten by the checkout.
      git(repoPath, 'checkout -q other')
      writeFileSync(join(repoPath, 'README.md'), 'other-version\n')
      git(repoPath, 'commit -q -am other')
      git(repoPath, 'checkout -q main')
      // Uncommitted change on main that conflicts with other's committed version.
      writeFileSync(join(repoPath, 'README.md'), 'changed-on-main\n')
      await expect(service.checkoutBranch(project, 'other')).rejects.toBeInstanceOf(GitOperationError)
    })

    it('creates a tracking local branch when checking out a remote-only branch', async () => {
      const remotePath = join(TMP, 'remote.git')
      execSync(`git init -q --bare ${JSON.stringify(remotePath)}`)
      git(repoPath, `remote add origin ${JSON.stringify(remotePath)}`)
      git(repoPath, 'push -q origin main')
      // Fetch so remote refs exist, then delete local main to force remote-only.
      git(repoPath, 'fetch -q origin')
      git(repoPath, 'checkout -q -b temp')
      git(repoPath, 'branch -D main')

      const result = await service.checkoutBranch(project, 'main')
      expect(result.branch).toBe('main')
      const after = await service.getBranch(project)
      expect(after.branch).toBe('main')
    })
  })
})
