import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ProjectService, ProjectValidationError } from '../src/services/ProjectService.js'
import { ProjectRepository, type ProjectRecord } from '../src/repositories/ProjectRepository.js'
import { PathValidator, type AllowedRoot } from '../src/services/PathValidator.js'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'

const TMP = join(tmpdir(), 'jheckbot-service-test')

vi.mock('../db/pool.js', () => ({
  pool: {
    query: vi.fn(),
    on: vi.fn(),
    end: vi.fn(),
  },
}))

describe('ProjectService', () => {
  let repo: ProjectRepository
  let service: ProjectService
  let mockProject: ProjectRecord

  beforeEach(() => {
    mkdirSync(join(TMP, 'test-project'), { recursive: true })
    mkdirSync(join(TMP, 'test-project', '.git'), { recursive: true })
    writeFileSync(join(TMP, 'test-project', 'package.json'), '{}')

    mockProject = {
      id: 'proj-1',
      name: 'Test Project',
      slug: 'test-project',
      path: join(TMP, 'test-project'),
      description: null,
      enabled: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    repo = {
      findAll: vi.fn().mockResolvedValue([]),
      findById: vi.fn().mockResolvedValue(null),
      findBySlug: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue(mockProject),
      update: vi.fn().mockResolvedValue(mockProject),
      delete: vi.fn().mockResolvedValue(true),
      findAllowedRoots: vi.fn().mockResolvedValue<AllowedRoot[]>([
        { id: 'root-1', name: 'TestRoot', path: TMP, enabled: true },
      ]),
    } as unknown as ProjectRepository

    const factory = (roots: AllowedRoot[]) => new PathValidator(roots)
    service = new ProjectService(repo, factory)
  })

  afterEach(() => {
    rmSync(TMP, { recursive: true, force: true })
  })

  it('creates a valid project', async () => {
    const project = await service.create({
      name: 'Test Project',
      path: join(TMP, 'test-project'),
    })
    expect(project).toEqual(mockProject)
    expect(repo.create).toHaveBeenCalledOnce()
  })

  it('rejects creation with empty name', async () => {
    await expect(
      service.create({ name: '', path: join(TMP, 'test-project') }),
    ).rejects.toThrow(ProjectValidationError)
  })

  it('rejects creation with empty path', async () => {
    await expect(
      service.create({ name: 'Test', path: '' }),
    ).rejects.toThrow(ProjectValidationError)
  })

  it('rejects creation with a path outside allowed roots', async () => {
    await expect(
      service.create({ name: 'Test', path: '/etc' }),
    ).rejects.toThrow(ProjectValidationError)
  })

  it('rejects creation with a duplicate slug', async () => {
    vi.mocked(repo.findBySlug).mockResolvedValueOnce(mockProject)
    await expect(
      service.create({ name: 'Test Project', path: join(TMP, 'test-project') }),
    ).rejects.toThrow('A project with this name already exists')
  })

  it('updates a project name', async () => {
    vi.mocked(repo.findById).mockResolvedValueOnce(mockProject)
    const updated = await service.update('proj-1', { name: 'New Name' })
    expect(updated).toEqual(mockProject)
    expect(repo.update).toHaveBeenCalledWith('proj-1', expect.objectContaining({ name: 'New Name' }))
  })

  it('returns null when updating a non-existent project', async () => {
    vi.mocked(repo.findById).mockResolvedValueOnce(null)
    const result = await service.update('nonexistent', { name: 'New Name' })
    expect(result).toBeNull()
  })

  it('rejects update with empty name', async () => {
    vi.mocked(repo.findById).mockResolvedValueOnce(mockProject)
    await expect(
      service.update('proj-1', { name: '' }),
    ).rejects.toThrow(ProjectValidationError)
  })

  it('deletes a project', async () => {
    const result = await service.delete('proj-1')
    expect(result).toBe(true)
  })

  it('lists all projects', async () => {
    vi.mocked(repo.findAll).mockResolvedValueOnce([mockProject])
    const projects = await service.list()
    expect(projects).toHaveLength(1)
    expect(projects[0]).toEqual(mockProject)
  })
})
