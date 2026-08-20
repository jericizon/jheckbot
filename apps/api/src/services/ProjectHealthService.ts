import { existsSync, realpathSync, statSync, accessSync, constants } from 'node:fs'
import { join } from 'node:path'
import { execSync } from 'node:child_process'
import type { ProjectRecord } from '../repositories/ProjectRepository.js'
import { ProjectRepository } from '../repositories/ProjectRepository.js'
import { PathValidator, type AllowedRoot } from './PathValidator.js'

export interface ProjectHealthResult {
  projectId: string
  directory: boolean
  accessible: boolean
  gitRepository: boolean
  nodeProject: boolean
  pnpmProject: boolean
  dockerProject: boolean
  devinCli: boolean
  checkedAt: string
}

export interface PathValidationResult {
  projectId: string
  valid: boolean
  resolvedPath: string | null
  error: string | null
}

export class ProjectHealthService {
  constructor(
    private repo: ProjectRepository,
    private pathValidatorFactory: (roots: AllowedRoot[]) => PathValidator,
    private devinBin: string,
  ) {}

  async validatePath(project: ProjectRecord): Promise<PathValidationResult> {
    const roots = await this.repo.findAllowedRoots()
    const validator = this.pathValidatorFactory(roots)
    const result = validator.validate(project.path)
    return {
      projectId: project.id,
      valid: result.valid,
      resolvedPath: result.resolvedPath ?? null,
      error: result.error ?? null,
    }
  }

  async checkHealth(project: ProjectRecord): Promise<ProjectHealthResult> {
    const dir = this.checkDirectory(project.path)
    const accessible = dir && this.checkAccessible(project.path)
    const gitRepo = dir && this.checkGitRepo(project.path)
    const nodeProject = dir && this.checkNodeProject(project.path)
    const pnpmProject = dir && this.checkPnpmProject(project.path)
    const dockerProject = dir && this.checkDockerProject(project.path)
    const devinCli = this.checkDevinCli()

    return {
      projectId: project.id,
      directory: dir,
      accessible,
      gitRepository: gitRepo,
      nodeProject,
      pnpmProject,
      dockerProject,
      devinCli,
      checkedAt: new Date().toISOString(),
    }
  }

  private checkDirectory(path: string): boolean {
    try {
      const real = realpathSync(path)
      return statSync(real).isDirectory()
    } catch {
      return false
    }
  }

  private checkAccessible(path: string): boolean {
    try {
      accessSync(path, constants.R_OK)
      return true
    } catch {
      return false
    }
  }

  private checkGitRepo(path: string): boolean {
    return existsSync(join(path, '.git'))
  }

  private checkNodeProject(path: string): boolean {
    return existsSync(join(path, 'package.json'))
  }

  private checkPnpmProject(path: string): boolean {
    return existsSync(join(path, 'pnpm-lock.yaml'))
  }

  private checkDockerProject(path: string): boolean {
    return existsSync(join(path, 'docker-compose.yml')) || existsSync(join(path, 'compose.yml'))
  }

  private checkDevinCli(): boolean {
    try {
      execSync(`test -x ${this.devinBin}`, { stdio: 'ignore' })
      return true
    } catch {
      return false
    }
  }
}
