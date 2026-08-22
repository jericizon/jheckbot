import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { execSync } from 'node:child_process'
import { ProjectHealthService, NoChangesError } from '../src/services/ProjectHealthService.js'
import { ProjectRepository } from '../src/repositories/ProjectRepository.js'
import { PathValidator, type AllowedRoot } from '../src/services/PathValidator.js'
import type { ProjectRecord } from '../src/repositories/ProjectRepository.js'

const TMP = join(tmpdir(), 'jheckbot-commit-msg-test')

const allowedRoots: AllowedRoot[] = [
  { id: 'root-1', name: 'TestRoot', path: TMP, enabled: true },
]

function git(cwd: string, args: string): void {
  execSync(`git -C ${JSON.stringify(cwd)} ${args}`, { stdio: 'pipe' })
}

describe('ProjectHealthService.generateCommitMessage', () => {
  let service: ProjectHealthService
  let project: ProjectRecord
  let repoPath: string

  beforeEach(() => {
    mkdirSync(TMP, { recursive: true })
    repoPath = join(TMP, 'commit-msg-project')
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

  it('throws NoChangesError for a clean working tree', async () => {
    writeFileSync(join(repoPath, 'README.md'), 'hello')
    git(repoPath, 'add README.md')
    git(repoPath, 'commit -q -m init')
    await expect(service.generateCommitMessage(project)).rejects.toBeInstanceOf(NoChangesError)
  })

  it('detects new functions and generates a feat commit', async () => {
    writeFileSync(join(repoPath, 'auth.ts'), 'export const oldFn = () => 1\n')
    git(repoPath, 'add auth.ts')
    git(repoPath, 'commit -q -m init')
    writeFileSync(join(repoPath, 'auth.ts'), 'export const oldFn = () => 1\nexport function loginUser(user: string): void {}\n')
    const result = await service.generateCommitMessage(project)
    expect(result.message).toMatch(/^feat:/)
    expect(result.message).toContain('loginUser')
    expect(result.fileCount).toBe(1)
  })

  it('detects new routes and includes them in the message', async () => {
    mkdirSync(join(repoPath, 'src'), { recursive: true })
    writeFileSync(join(repoPath, 'src', 'routes.ts'), 'export {}\n')
    git(repoPath, 'add src/routes.ts')
    git(repoPath, 'commit -q -m init')
    writeFileSync(join(repoPath, 'src', 'routes.ts'), "router.post('/api/login', handler)\nrouter.get('/api/users', list)\n")
    const result = await service.generateCommitMessage(project)
    expect(result.message).toContain('POST /api/login')
    expect(result.message).toContain('GET /api/users')
  })

  it('detects bug-fix keywords and generates a fix commit', async () => {
    writeFileSync(join(repoPath, 'service.ts'), 'export const getData = () => null\n')
    git(repoPath, 'add service.ts')
    git(repoPath, 'commit -q -m init')
    writeFileSync(join(repoPath, 'service.ts'), 'export const getData = () => { if (!data) throw new Error("fix null pointer") }\n')
    const result = await service.generateCommitMessage(project)
    expect(result.message).toMatch(/^fix:/)
    expect(result.message.toLowerCase()).toContain('null')
  })

  it('classifies test-only changes as test commits', async () => {
    writeFileSync(join(repoPath, 'auth.ts'), 'export const x = 1\n')
    git(repoPath, 'add auth.ts')
    git(repoPath, 'commit -q -m init')
    writeFileSync(join(repoPath, 'auth.test.ts'), 'import { x } from "./auth"\ntest("x", () => expect(x).toBe(1))\n')
    const result = await service.generateCommitMessage(project)
    expect(result.message).toMatch(/^test:/)
  })

  it('classifies docs-only changes as docs commits', async () => {
    writeFileSync(join(repoPath, 'README.md'), '# Project\n')
    git(repoPath, 'add README.md')
    git(repoPath, 'commit -q -m init')
    writeFileSync(join(repoPath, 'README.md'), '# Project\n\nNew section.\n')
    const result = await service.generateCommitMessage(project)
    expect(result.message).toMatch(/^docs:/)
  })

  it('classifies config-only changes as chore commits', async () => {
    writeFileSync(join(repoPath, 'package.json'), '{"name":"test","version":"1.0.0"}\n')
    git(repoPath, 'add package.json')
    git(repoPath, 'commit -q -m init')
    writeFileSync(join(repoPath, 'package.json'), '{"name":"test","version":"1.1.0"}\n')
    const result = await service.generateCommitMessage(project)
    expect(result.message).toMatch(/^chore:/)
    expect(result.message).toContain('package.json')
  })

  it('includes line stats in the body', async () => {
    writeFileSync(join(repoPath, 'file.ts'), 'line1\nline2\nline3\n')
    git(repoPath, 'add file.ts')
    git(repoPath, 'commit -q -m init')
    writeFileSync(join(repoPath, 'file.ts'), 'line1\nline2\nline3\nline4\nline5\n')
    const result = await service.generateCommitMessage(project)
    expect(result.message).toMatch(/\d+\+.*\d+-/)
  })

  it('handles untracked files with new functions', async () => {
    writeFileSync(join(repoPath, 'README.md'), 'init\n')
    git(repoPath, 'add README.md')
    git(repoPath, 'commit -q -m init')
    writeFileSync(join(repoPath, 'new-module.ts'), 'export function newFeature(): void {}\n')
    const result = await service.generateCommitMessage(project)
    expect(result.message).toContain('newFeature')
  })

  it('includes area (top-level directory) in the subject', async () => {
    mkdirSync(join(repoPath, 'src', 'api'), { recursive: true })
    writeFileSync(join(repoPath, 'src', 'api', 'handler.ts'), 'export {}\n')
    git(repoPath, 'add src/api/handler.ts')
    git(repoPath, 'commit -q -m init')
    writeFileSync(join(repoPath, 'src', 'api', 'handler.ts'), 'export function handleRequest(): void {}\n')
    const result = await service.generateCommitMessage(project)
    expect(result.message).toContain('src')
  })
})
