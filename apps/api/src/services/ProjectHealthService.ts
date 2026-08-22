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

export interface GenerateCommitMessageResult {
  projectId: string
  message: string
  fileCount: number
  checkedAt: string
}

export interface CommitResult {
  projectId: string
  branch: string
  commitHash: string
  pushed: boolean
  commitMessage: string
  checkedAt: string
}

export class FileNotChangedError extends Error {
  constructor(path: string) {
    super(`File is not in the changes list: ${path}`)
    this.name = 'FileNotChangedError'
  }
}

export class NoChangesError extends Error {
  constructor() {
    super('No changes to commit')
    this.name = 'NoChangesError'
  }
}

export class GitOperationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'GitOperationError'
  }
}

interface DiffAnalysis {
  newFunctions: string[]
  removedFunctions: string[]
  newRoutes: string[]
  newImports: string[]
  bugFixKeywords: string[]
  testFiles: string[]
  docFiles: string[]
  configFiles: string[]
  styleFiles: string[]
  newComponents: string[]
  areas: Set<string>
  addedLines: number
  removedLines: number
  fileCount: number
  addedCount: number
  modifiedCount: number
  deletedCount: number
  renamedCount: number
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

  async generateCommitMessage(project: ProjectRecord): Promise<GenerateCommitMessageResult> {
    const changes = this.readGitStatus(project.path)
    if (changes.length === 0) throw new NoChangesError()

    const analysis = this.analyzeDiff(project.path, changes)
    const message = this.buildCommitMessage(analysis)

    return {
      projectId: project.id,
      message,
      fileCount: changes.length,
      checkedAt: new Date().toISOString(),
    }
  }

  // Extract semantic signals from the actual diff content so the generated
  // commit message describes *what* changed, not just which files changed.
  private analyzeDiff(cwd: string, changes: FileChange[]): DiffAnalysis {
    const analysis: DiffAnalysis = {
      newFunctions: [],
      removedFunctions: [],
      newRoutes: [],
      newImports: [],
      bugFixKeywords: [],
      testFiles: [],
      docFiles: [],
      configFiles: [],
      styleFiles: [],
      newComponents: [],
      areas: new Set<string>(),
      addedLines: 0,
      removedLines: 0,
      fileCount: changes.length,
      addedCount: 0,
      modifiedCount: 0,
      deletedCount: 0,
      renamedCount: 0,
    }

    const funcPattern = /^\+\s*(?:export\s+(?:default\s+)?(?:async\s+)?(?:function|class|const|let)\s+(\w+)|(?:public|private|protected|static|async)\s+(\w+)|def\s+(\w+)|func\s+(\w+))/i
    const routePattern = /^\+\s*(?:router|app)\.(get|post|put|patch|delete)\s*\(\s*['"`]([^'"`]+)/i
    const componentPattern = /^\+\s*(?:export\s+default\s+(?:defineComponent|function|class)\s+(\w+)|defineComponent\s*\(\s*\{)/i
    const bugKeywords = /\b(fix|bug|crash|null\s*pointer|npe|undefined|leak|race\s*condition|off\s*by\s*one|regression|broken|incorrect|wrong)\b/gi
    const bugKeywordsTest = /\b(fix|bug|crash|null\s*pointer|npe|undefined|leak|race\s*condition|off\s*by\s*one|regression|broken|incorrect|wrong)\b/i

    for (const change of changes) {
      const path = change.path.includes(' -> ') ? change.path.split(' -> ')[1] : change.path
      const topDir = path.split('/')[0]
      analysis.areas.add(topDir)

      if (change.status === 'added' || change.status === 'untracked') analysis.addedCount++
      else if (change.status === 'modified') analysis.modifiedCount++
      else if (change.status === 'deleted') analysis.deletedCount++
      else if (change.status === 'renamed') analysis.renamedCount++

      if (/\.(test|spec)\.(ts|js|tsx|jsx|py|go|rs)$/.test(path) || path.includes('__tests__') || path.startsWith('tests/')) {
        analysis.testFiles.push(path)
      }
      if (/\.md$/.test(path)) analysis.docFiles.push(path)
      if (/(^|\/)(package\.json|pnpm-lock\.yaml|tsconfig.*\.json|\.env|wrangler\..*|config\..*)$/.test(path)) {
        analysis.configFiles.push(path)
      }
      if (/\.(css|scss|less|sass)$/.test(path)) analysis.styleFiles.push(path)

      let diff: string
      try {
        if (change.status === 'untracked' || change.status === 'added') {
          diff = this.runGit(cwd, ['diff', '--no-index', '--', '/dev/null', path], [0, 1])
        } else if (change.status === 'deleted') {
          diff = this.runGit(cwd, ['diff', 'HEAD', '--', path], [0])
        } else {
          diff = this.runGit(cwd, ['diff', 'HEAD', '--', path], [0])
        }
      } catch {
        continue
      }

      // Cap analysis to avoid pathological diffs.
      const diffLines = diff.split('\n').slice(0, 500)
      for (const line of diffLines) {
        if (line.startsWith('+++') || line.startsWith('---')) continue
        if (line.startsWith('+') && !line.startsWith('+++')) {
          analysis.addedLines++
          const fm = line.match(funcPattern)
          if (fm) analysis.newFunctions.push(fm[1] || fm[2] || fm[3] || fm[4] || '')
          const rm = line.match(routePattern)
          if (rm) analysis.newRoutes.push(`${rm[1].toUpperCase()} ${rm[2]}`)
          const cm = line.match(componentPattern)
          if (cm && cm[1]) analysis.newComponents.push(cm[1])
          if (/^\+\s*(?:import|from|require)\s/.test(line)) {
            const im = line.match(/(?:from|require)\s*['"`]([^'"`]+)/)
            if (im) analysis.newImports.push(im[1])
          }
        } else if (line.startsWith('-') && !line.startsWith('---')) {
          analysis.removedLines++
          const fm = line.match(/^\-\s*(?:export\s+(?:default\s+)?(?:async\s+)?(?:function|class|const|let)\s+(\w+)|(?:public|private|protected|static|async)\s+(\w+)|def\s+(\w+)|func\s+(\w+))/i)
          if (fm) analysis.removedFunctions.push(fm[1] || fm[2] || fm[3] || fm[4] || '')
        }
        if (bugKeywordsTest.test(line) && !line.startsWith('+++') && !line.startsWith('---')) {
          for (const m of line.matchAll(bugKeywords)) {
            const keyword = m[0]
            if (keyword && !analysis.bugFixKeywords.includes(keyword)) {
              analysis.bugFixKeywords.push(keyword)
            }
          }
        }
      }
    }

    return analysis
  }

  private buildCommitMessage(a: DiffAnalysis): string {
    const type = this.inferCommitType(a)
    const subject = this.inferSubject(a, type)
    const body = this.buildBody(a)
    return body ? `${subject}\n\n${body}` : subject
  }

  private inferCommitType(a: DiffAnalysis): string {
    if (a.testFiles.length === a.fileCount) return 'test'
    if (a.docFiles.length === a.fileCount) return 'docs'
    if (a.styleFiles.length === a.fileCount) return 'style'
    if (a.configFiles.length === a.fileCount) return 'chore'
    // "Truly new" = added but not also removed (a function in both was modified, not added).
    const trulyNewFunctions = a.newFunctions.filter((f) => !a.removedFunctions.includes(f))
    if (a.bugFixKeywords.length > 0 && trulyNewFunctions.length === 0 && a.newRoutes.length === 0 && a.newComponents.length === 0) return 'fix'
    if (a.newRoutes.length > 0 || a.newComponents.length > 0 || trulyNewFunctions.length > 0) return 'feat'
    if (a.removedLines > 0 && a.addedLines > 0 && Math.abs(a.addedLines - a.removedLines) < Math.max(a.addedLines, a.removedLines) * 0.2) return 'refactor'
    return 'chore'
  }

  private inferSubject(a: DiffAnalysis, type: string): string {
    const areas = [...a.areas].filter((x) => x && !x.startsWith('.')).slice(0, 2)
    const areaStr = areas.length > 0 ? ` in ${areas.join('/')}` : ''
    const trulyNewFunctions = a.newFunctions.filter((f) => !a.removedFunctions.includes(f))

    if (type === 'feat') {
      const features: string[] = []
      if (a.newRoutes.length > 0) features.push(`${a.newRoutes.length} new route${a.newRoutes.length === 1 ? '' : 's'}`)
      if (a.newComponents.length > 0) features.push(`${a.newComponents.length} new component${a.newComponents.length === 1 ? '' : 's'}`)
      if (trulyNewFunctions.length > 0) features.push(`${trulyNewFunctions[0]}${trulyNewFunctions.length > 1 ? ` and ${trulyNewFunctions.length - 1} more` : ''}`)
      const feat = features[0] ?? `${a.addedCount} new file${a.addedCount === 1 ? '' : 's'}`
      return `feat: add ${feat}${areaStr}`
    }

    if (type === 'fix') {
      const kw = a.bugFixKeywords.slice(0, 3).join(', ')
      return `fix: resolve ${kw || 'issues'}${areaStr}`
    }

    if (type === 'refactor') {
      return `refactor: restructure ${areas[0] ?? 'code'} (${a.fileCount} file${a.fileCount === 1 ? '' : 's'})`
    }

    if (type === 'test') {
      return `test: add tests for ${areas[0] ?? 'project'}`
    }

    if (type === 'docs') {
      return `docs: update ${a.docFiles.map((f) => f.split('/').pop()).join(', ')}`
    }

    if (type === 'style') {
      return `style: update ${a.styleFiles.length} stylesheet${a.styleFiles.length === 1 ? '' : 's'}`
    }

    // chore
    if (a.configFiles.length > 0) {
      return `chore: update ${a.configFiles.map((f) => f.split('/').pop()).join(', ')}`
    }
    return `chore: update ${a.fileCount} file${a.fileCount === 1 ? '' : 's'}${areaStr}`
  }

  private buildBody(a: DiffAnalysis): string {
    const sections: string[] = []

    if (a.newRoutes.length > 0) {
      const routes = a.newRoutes.slice(0, 5).map((r) => `- ${r}`).join('\n')
      sections.push(`New routes:\n${routes}${a.newRoutes.length > 5 ? `\n- ...and ${a.newRoutes.length - 5} more` : ''}`)
    }
    if (a.newComponents.length > 0) {
      const comps = a.newComponents.slice(0, 5).map((c) => `- ${c}`).join('\n')
      sections.push(`New components:\n${comps}`)
    }
    if (a.newFunctions.length > 0) {
      const fns = a.newFunctions.slice(0, 8).map((f) => `- ${f}`).join('\n')
      sections.push(`New functions:\n${fns}${a.newFunctions.length > 8 ? `\n- ...and ${a.newFunctions.length - 8} more` : ''}`)
    }
    if (a.removedFunctions.length > 0) {
      const fns = a.removedFunctions.slice(0, 5).map((f) => `- ${f}`).join('\n')
      sections.push(`Removed functions:\n${fns}`)
    }
    if (a.bugFixKeywords.length > 0) {
      sections.push(`Fixes: ${a.bugFixKeywords.join(', ')}`)
    }
    if (a.newImports.length > 0) {
      const unique = [...new Set(a.newImports)].slice(0, 5).map((i) => `- ${i}`).join('\n')
      sections.push(`New imports:\n${unique}`)
    }

    // Summary stats
    const stats: string[] = []
    if (a.addedCount > 0) stats.push(`${a.addedCount} added`)
    if (a.modifiedCount > 0) stats.push(`${a.modifiedCount} modified`)
    if (a.deletedCount > 0) stats.push(`${a.deletedCount} deleted`)
    if (a.renamedCount > 0) stats.push(`${a.renamedCount} renamed`)
    if (stats.length > 0) sections.push(`Files: ${stats.join(', ')} (${a.addedLines}+ / ${a.removedLines}-)`)

    return sections.join('\n\n')
  }

  async commit(project: ProjectRecord, message: string): Promise<CommitResult> {
    if (!message?.trim()) throw new GitOperationError('Commit message is required')

    const changes = this.readGitStatus(project.path)
    if (changes.length === 0) throw new NoChangesError()

    // Stage all changes (tracked + untracked, modifications, deletions).
    this.runGit(project.path, ['add', '-A'], [0])

    // Commit with the user-provided message (passed as argv, not shell).
    try {
      this.runGit(project.path, ['commit', '-m', message], [0])
    } catch (err) {
      const stderr = (err as { stderr?: string }).stderr ?? ''
      if (stderr.includes('nothing to commit')) throw new NoChangesError()
      throw new GitOperationError(`Commit failed: ${stderr.trim() || (err as Error).message}`)
    }

    const commitHash = this.runGit(project.path, ['rev-parse', 'HEAD'], [0]).trim()
    const branch = this.readGitBranch(project.path) ?? 'unknown'

    // Push to the current branch's upstream. If no upstream is configured,
    // report pushed=false with a clear error rather than failing the commit.
    let pushed = true
    try {
      this.runGit(project.path, ['push'], [0])
    } catch (err) {
      const stderr = (err as { stderr?: string }).stderr ?? ''
      if (stderr.includes('no upstream branch') || stderr.includes('has no upstream')) {
        // Try push -u origin <branch> as a fallback.
        try {
          this.runGit(project.path, ['push', '-u', 'origin', branch], [0])
        } catch (pushErr) {
          pushed = false
          throw new GitOperationError(`Commit succeeded but push failed: ${(pushErr as Error).message}`)
        }
      } else {
        pushed = false
        throw new GitOperationError(`Commit succeeded but push failed: ${stderr.trim() || (err as Error).message}`)
      }
    }

    return {
      projectId: project.id,
      branch,
      commitHash,
      pushed,
      commitMessage: message,
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
