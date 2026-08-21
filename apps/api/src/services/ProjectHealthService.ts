import { existsSync, realpathSync, statSync, accessSync, constants } from 'node:fs'
import { join } from 'node:path'
import { execSync, execFileSync } from 'node:child_process'
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

export interface ProjectBranchResult {
  projectId: string
  branch: string | null
  checkedAt: string
}

export interface FileChange {
  path: string
  status: 'modified' | 'added' | 'deleted' | 'renamed' | 'untracked' | 'ignored'
  staged: boolean
}

export interface ProjectChangesResult {
  projectId: string
  branch: string | null
  changes: FileChange[]
  checkedAt: string
}

export interface ProjectFileDiffResult {
  projectId: string
  path: string
  status: FileChange['status']
  staged: boolean
  diff: string
  checkedAt: string
}

export class FileNotChangedError extends Error {
  constructor(path: string) {
    super(`File is not in the changes list: ${path}`)
    this.name = 'FileNotChangedError'
  }
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

  async getBranch(project: ProjectRecord): Promise<ProjectBranchResult> {
    const branch = this.readGitBranch(project.path)
    return {
      projectId: project.id,
      branch,
      checkedAt: new Date().toISOString(),
    }
  }

  async getChanges(project: ProjectRecord): Promise<ProjectChangesResult> {
    const branch = this.readGitBranch(project.path)
    const changes = this.readGitStatus(project.path)
    return {
      projectId: project.id,
      branch,
      changes,
      checkedAt: new Date().toISOString(),
    }
  }

  async getFileDiff(project: ProjectRecord, filePath: string): Promise<ProjectFileDiffResult> {
    const changes = this.readGitStatus(project.path)
    const change = changes.find((c) => c.path === filePath)
    if (!change) throw new FileNotChangedError(filePath)

    // Rename display path is "old -> new"; diff against the new path.
    const diffPath = filePath.includes(' -> ') ? filePath.split(' -> ')[1] : filePath

    let diff: string
    if (change.status === 'untracked') {
      // No tracked baseline to diff against; synthesize a "new file" diff
      // via --no-index (exits 1 when content differs, which is expected).
      diff = this.runGit(project.path, ['diff', '--no-index', '--', '/dev/null', diffPath], [0, 1])
    } else {
      // Diff everything (staged + unstaged) against HEAD for a full review.
      diff = this.runGit(project.path, ['diff', 'HEAD', '--', diffPath], [0])
    }

    return {
      projectId: project.id,
      path: filePath,
      status: change.status,
      staged: change.staged,
      diff,
      checkedAt: new Date().toISOString(),
    }
  }

  private readGitStatus(path: string): FileChange[] {
    if (!this.checkGitRepo(path)) return []
    try {
      const output = execSync(`git -C ${JSON.stringify(path)} status --porcelain --untracked-files=all`, {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'ignore'],
        maxBuffer: 4 * 1024 * 1024,
      })
      return output
        .split('\n')
        .map((line) => line.trimEnd())
        .filter((line) => line.length > 0)
        .map((line) => this.parsePorcelainLine(line))
    } catch {
      return []
    }
  }

  // Runs git without a shell so user-controlled path arguments are passed
  // as argv and cannot be shell-injected. `allowExit` lists exit codes that
  // are treated as success (e.g. git diff --no-index exits 1 on differences).
  private runGit(cwd: string, args: string[], allowExit: number[] = [0]): string {
    try {
      const stdout = execFileSync('git', ['-C', cwd, ...args], {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'ignore'],
        maxBuffer: 8 * 1024 * 1024,
      })
      return stdout
    } catch (err) {
      const code = (err as { status?: number }).status ?? -1
      if (allowExit.includes(code)) {
        // git writes the diff to stdout even when it exits non-zero.
        const stdout = (err as { stdout?: string }).stdout
        return typeof stdout === 'string' ? stdout : ''
      }
      throw err
    }
  }

  private parsePorcelainLine(line: string): FileChange {
    // Porcelain v1 format: XY <path>[\t-> <origPath>]
    const x = line[0]
    const y = line[1]
    const rest = line.slice(3)
    // Renamed files: "newPath\toldPath"
    const [filePath, origPath] = rest.split('\t')
    const displayPath = origPath ? `${origPath} -> ${filePath}` : filePath

    const staged = x !== ' ' && x !== '?'
    let status: FileChange['status']
    const code = staged ? x : y
    switch (code) {
      case 'M': status = 'modified'; break
      case 'A': status = 'added'; break
      case 'D': status = 'deleted'; break
      case 'R': status = 'renamed'; break
      case '?': status = 'untracked'; break
      case '!': status = 'ignored'; break
      default: status = 'modified'
    }
    return { path: displayPath, status, staged }
  }

  private readGitBranch(path: string): string | null {
    if (!this.checkGitRepo(path)) return null
    try {
      return execSync(`git -C ${JSON.stringify(path)} rev-parse --abbrev-ref HEAD`, {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'ignore'],
      }).trim()
    } catch {
      return null
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
