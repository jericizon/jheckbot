import { DevinAdapter, DevinAdapterError } from './DevinAdapter.js'
import { TmuxManager } from './TmuxManager.js'
import { ProjectRepository } from '../repositories/ProjectRepository.js'
import { ConversationRepository } from '../repositories/ConversationRepository.js'
import { PathValidator, type AllowedRoot } from '../services/PathValidator.js'
import type { ProjectRecord } from '../repositories/ProjectRepository.js'
import { DEFAULT_DEVIN_MODEL } from '@jheckbot/shared'

export type AgentStatus = 'idle' | 'starting' | 'running' | 'stopping' | 'completed' | 'failed' | 'stopped'

export interface AgentRun {
  conversationId: string
  projectSlug: string
  sessionName: string
  status: AgentStatus
  devinSessionId?: string
  startedAt: string
  endedAt?: string
  error?: string
}

export interface StartAgentOptions {
  conversationId: string
  projectId: string
  prompt: string
  devinSessionId?: string
  model?: string
}

const MAX_CONCURRENT_SESSIONS = 3

/**
 * Manages agent lifecycle and enforces concurrent prompt protection.
 * Each conversation can have at most one active agent run.
 * The system enforces a global max of MAX_CONCURRENT_SESSIONS.
 */
export class AgentManager {
  private runs = new Map<string, AgentRun>()
  private conversationLocks = new Set<string>()

  constructor(
    private devin: DevinAdapter,
    private tmux: TmuxManager,
    private repo: ProjectRepository,
    private pathValidatorFactory: (roots: AllowedRoot[]) => PathValidator,
    private conversationRepo?: ConversationRepository,
  ) {}

  async start(opts: StartAgentOptions): Promise<AgentRun> {
    // Concurrent prompt protection: one active run per conversation
    if (this.conversationLocks.has(opts.conversationId)) {
      throw new AgentManagerError('Agent is currently working', 409)
    }

    // Global session limit
    if (this.countActiveRuns() >= MAX_CONCURRENT_SESSIONS) {
      throw new AgentManagerError('Maximum concurrent agent sessions reached', 429)
    }

    // Resolve and validate project path
    const project = await this.repo.findById(opts.projectId)
    if (!project) {
      throw new AgentManagerError('Project not found', 404)
    }
    if (!project.enabled) {
      throw new AgentManagerError('Project is disabled', 400)
    }

    const roots = await this.repo.findAllowedRoots()
    const validator = this.pathValidatorFactory(roots)
    const pathResult = validator.validate(project.path)
    if (!pathResult.valid || !pathResult.resolvedPath) {
      throw new AgentManagerError(`Project path invalid: ${pathResult.error}`, 400)
    }

    const sessionName = this.buildSessionName(project.slug, opts.conversationId)

    // Clean up any stale tmux session from a previous failed run
    if (this.tmux.sessionExists(sessionName)) {
      this.tmux.killSession(sessionName)
    }
    // Clear any previous failed run so we can start fresh
    this.runs.delete(opts.conversationId)
    this.conversationLocks.delete(opts.conversationId)

    // Acquire lock
    this.conversationLocks.add(opts.conversationId)

    const run: AgentRun = {
      conversationId: opts.conversationId,
      projectSlug: project.slug,
      sessionName,
      status: 'starting',
      startedAt: new Date().toISOString(),
    }
    this.runs.set(opts.conversationId, run)

    try {
      const sessionInfo = this.devin.start({
        sessionName,
        cwd: pathResult.resolvedPath,
        prompt: opts.prompt,
        devinSessionId: opts.devinSessionId,
        model: opts.model || DEFAULT_DEVIN_MODEL,
      })

      run.devinSessionId = sessionInfo.devinSessionId
      run.status = 'running'
      await this.conversationRepo?.updateAgentStatus(opts.conversationId, 'running')
    } catch (err) {
      run.status = 'failed'
      run.endedAt = new Date().toISOString()
      run.error = err instanceof Error ? err.message : String(err)
      this.conversationLocks.delete(opts.conversationId)
      await this.conversationRepo?.updateAgentStatus(opts.conversationId, 'idle')
      throw err
    }

    return run
  }

  async stop(conversationId: string): Promise<AgentRun | null> {
    const run = this.runs.get(conversationId)
    if (!run) return null

    run.status = 'stopping'
    this.devin.stop(run.sessionName)
    run.status = 'stopped'
    run.endedAt = new Date().toISOString()
    this.conversationLocks.delete(conversationId)
    await this.conversationRepo?.updateAgentStatus(conversationId, 'idle')

    return run
  }

  getStatus(conversationId: string): AgentRun | null {
    return this.runs.get(conversationId) ?? null
  }

  /** Send a follow-up prompt to a running agent's tmux session. */
  sendPrompt(conversationId: string, prompt: string): void {
    const run = this.runs.get(conversationId)
    if (!run) {
      throw new AgentManagerError('No agent run for this conversation', 404)
    }
    if (run.status !== 'running' && run.status !== 'starting') {
      throw new AgentManagerError('Agent is not running', 409)
    }
    this.devin.sendPrompt(run.sessionName, prompt)
  }

  getOutput(conversationId: string, startLine?: number): string[] {
    const run = this.runs.get(conversationId)
    if (!run) return []
    return this.devin.captureOutput(run.sessionName, startLine)
  }

  isConversationActive(conversationId: string): boolean {
    return this.conversationLocks.has(conversationId)
  }

  listActiveRuns(): AgentRun[] {
    return Array.from(this.runs.values()).filter(
      (r) => r.status === 'running' || r.status === 'starting',
    )
  }

  /** Recover runs from existing tmux sessions after an API restart. */
  recoverSessions(knownConversationIds: Map<string, { projectSlug: string; devinSessionId?: string }>): AgentRun[] {
    const tmuxSessions = this.tmux.listSessions()
    const recovered: AgentRun[] = []

    for (const session of tmuxSessions) {
      if (!session.name.startsWith('jheckbot-')) continue

      const conversationId = this.extractConversationId(session.name)
      if (!conversationId) continue

      const known = knownConversationIds.get(conversationId)
      if (!known) {
        // Orphaned session — no matching conversation in DB
        continue
      }

      if (this.runs.has(conversationId)) continue

      const run: AgentRun = {
        conversationId,
        projectSlug: known.projectSlug,
        sessionName: session.name,
        status: 'running',
        devinSessionId: known.devinSessionId,
        startedAt: new Date(Number(session.created) * 1000).toISOString(),
      }
      this.runs.set(conversationId, run)
      this.conversationLocks.add(conversationId)
      recovered.push(run)
    }

    return recovered
  }

  /** Find orphaned tmux sessions not tracked by the manager. */
  findOrphanedSessions(): string[] {
    const known = Array.from(this.runs.values()).map((r) => r.sessionName)
    return this.tmux.findOrphaned(known).map((s) => s.name)
  }

  /** Clean up orphaned tmux sessions. */
  cleanupOrphanedSessions(): string[] {
    const orphaned = this.findOrphanedSessions()
    for (const name of orphaned) {
      this.tmux.killSession(name)
    }
    return orphaned
  }

  private buildSessionName(projectSlug: string, conversationId: string): string {
    return `jheckbot-${projectSlug}-${conversationId}`
  }

  private extractConversationId(sessionName: string): string | null {
    const parts = sessionName.split('-')
    // jheckbot-{slug}-{conversationId}
    if (parts.length < 3) return null
    return parts.slice(2).join('-')
  }

  private countActiveRuns(): number {
    return Array.from(this.runs.values()).filter(
      (r) => r.status === 'running' || r.status === 'starting',
    ).length
  }
}

export class AgentManagerError extends Error {
  statusCode: number
  constructor(message: string, statusCode: number) {
    super(message)
    this.name = 'AgentManagerError'
    this.statusCode = statusCode
  }
}
