import { ProjectRepository, type ProjectRecord } from '../repositories/ProjectRepository.js'
import { PathValidator, type AllowedRoot } from './PathValidator.js'
import { slugify } from '../utils/slugify.js'

export interface CreateProjectInput {
  name: string
  path: string
  description?: string
  defaultProviderId?: string
  defaultProviderConfig?: Record<string, unknown> | null
}

export interface UpdateProjectInput {
  name?: string
  description?: string
  enabled?: boolean
  defaultProviderId?: string
  defaultProviderConfig?: Record<string, unknown> | null
}

export class ProjectService {
  constructor(
    private repo: ProjectRepository,
    private pathValidatorFactory: (roots: AllowedRoot[]) => PathValidator,
  ) {}

  async list(): Promise<ProjectRecord[]> {
    return this.repo.findAll()
  }

  async get(id: string): Promise<ProjectRecord | null> {
    return this.repo.findById(id)
  }

  async create(input: CreateProjectInput): Promise<ProjectRecord> {
    if (!input.name?.trim()) {
      throw new ProjectValidationError('Name is required')
    }
    if (!input.path?.trim()) {
      throw new ProjectValidationError('Path is required')
    }

    const roots = await this.repo.findAllowedRoots()
    const validator = this.pathValidatorFactory(roots)
    const result = validator.resolveRelative(input.path)
    if (!result.valid || !result.resolvedPath) {
      throw new ProjectValidationError(result.error ?? 'Invalid path')
    }

    const existing = await this.repo.findBySlug(slugify(input.name))
    if (existing) {
      throw new ProjectValidationError('A project with this name already exists')
    }

    return this.repo.create({
      name: input.name.trim(),
      slug: slugify(input.name),
      path: result.resolvedPath,
      description: input.description?.trim() || undefined,
      defaultProviderId: input.defaultProviderId,
      defaultProviderConfig: input.defaultProviderConfig,
    })
  }

  async update(id: string, input: UpdateProjectInput): Promise<ProjectRecord | null> {
    const existing = await this.repo.findById(id)
    if (!existing) return null

    if (input.name !== undefined && !input.name.trim()) {
      throw new ProjectValidationError('Name cannot be empty')
    }

    return this.repo.update(id, {
      name: input.name?.trim(),
      description: input.description?.trim(),
      enabled: input.enabled,
      defaultProviderId: input.defaultProviderId,
      defaultProviderConfig: input.defaultProviderConfig,
    })
  }

  async delete(id: string): Promise<boolean> {
    return this.repo.delete(id)
  }
}

export class ProjectValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ProjectValidationError'
  }
}
