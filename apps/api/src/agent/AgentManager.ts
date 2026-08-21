import { DevinAdapter } from './DevinAdapter.js'
import { TmuxManager, type TmuxSession } from './TmuxManager.js'
import { TerminalOutputNormalizer } from './TerminalOutputNormalizer.js'
import { ProjectRepository } from '../repositories/ProjectRepository.js'
import { ConversationRepository, type ConversationRecord } from '../repositories/ConversationRepository.js'
import { MessageRepository } from '../repositories/MessageRepository.js'
import { AgentEventRepository, type AgentEventRecord } from '../repositories/AgentEventRepository.js'
import { PathValidator, type AllowedRoot } from '../services/PathValidator.js'
import { DEFAULT_DEVIN_MODEL } from '@jheckbot/shared'

export type AgentStatus = 'idle' | 'starting' | 'running' | 'stopping' | 'completed' | 'failed' | 'stopped'

export interface AgentRun {
  conversationId: string
  projectSlug: string
  sessionName: string
  status: AgentStatus
  devinSessionId?: string
  userMessageId?: string
  startedAt: string
  endedAt?: string
  error?: string
  outputBuffer: string
  normalizedSnapshot: string[]
}

export interface StartAgentOptions {
  conversationId: string
  projectId: string
  prompt: string
  devinSessionId?: string
  model?: string
}

export interface PrepareRunOptions {
  conversationId: string
  projectSlug: string
  cwd: string
  prompt: string
  projectId?: string
  devinSessionId?: string
  model?: string
  userMessageId?: string
}

export type AgentStreamEvent = AgentEventRecord
export type AgentStreamListener = (event: AgentStreamEvent) => void

type PathValidatorFactory = (roots: AllowedRoot[]) => PathValidator

type WatcherHandle = ReturnType<typeof setInterval>

interface ManagedAgentRun {
  run: AgentRun
  pendingOutput: string[]
  watcher?: WatcherHandle
  watcherInFlight?: Promise<void>
  terminalPersistence?: Promise<void>
  terminalizing: boolean
  stopRequested: boolean
  lastFlushAt: number
  sessionIdPersisted: boolean
}

interface ActiveConversationRepository {
  findActive?: () => Promise<ConversationRecord[]>
  findActiveConversations?: () => Promise<ConversationRecord[]>
  findActiveAgentConversations?: () => Promise<ConversationRecord[]>
}

const MAX_CONCURRENT_SESSIONS = 3
const WATCH_INTERVAL_MS = 100
const OUTPUT_FLUSH_INTERVAL_MS = 500
const OUTPUT_FLUSH_BYTES = 4 * 1024

/**
 * A prepared external process is deliberately not visible to the manager until
 * the caller has committed its database transaction.
 */
export class PreparedAgentRun {
  private committed = false
  private rolledBack = false

  constructor(
    private manager: AgentManager,
    private state: ManagedAgentRun,
  ) {}

  commit(): AgentRun {
    if (this.rolledBack) {
      throw new AgentManagerError('Prepared agent run has already been rolled back', 409)
    }
    if (this.committed) return this.state.run

    const run = this.manager.commitPreparedRun(this.state)
    this.committed = true
    return run
  }

  rollback(): void {
    if (this.committed || this.rolledBack) return
    this.rolledBack = true
    this.manager.rollbackPreparedRun(this.state)
  }
}

/**
 * Manages agent lifecycle and enforces concurrent prompt protection.
 * Each conversation can have at most one active agent run.
 * The system enforces a global max of MAX_CONCURRENT_SESSIONS.
 *
 * Devin runs are watched here rather than by SSE clients. A run owns one
 * interval for its whole lifetime, while subscribers only receive persisted
 * events from that run.
 */
export class AgentManager {
  private readonly devin: DevinAdapter
  private readonly runs = new Map<string, ManagedAgentRun>()
  private readonly pendingRuns = new Map<string, ManagedAgentRun>()
  private readonly conversationLocks = new Set<string>()
  private readonly listeners = new Map<string, Set<AgentStreamListener>>()
  private readonly normalizer = new TerminalOutputNormalizer()

  private readonly repo: ProjectRepository
  private readonly pathValidatorFactory: PathValidatorFactory
  private readonly conversationRepo?: ConversationRepository
  private readonly messageRepo?: MessageRepository
  private readonly eventRepo?: AgentEventRepository
  private readonly tmux?: TmuxManager

  constructor(
    devin: DevinAdapter,
    repo: ProjectRepository,
    pathValidatorFactory: PathValidatorFactory,
    conversationRepo?: ConversationRepository,
    messageRepo?: MessageRepository,
    eventRepo?: AgentEventRepository,
  )
  constructor(
    devin: DevinAdapter,
    tmux: TmuxManager,
    repo: ProjectRepository,
    pathValidatorFactory: PathValidatorFactory,
    conversationRepo?: ConversationRepository,
    messageRepo?: MessageRepository,
    eventRepo?: AgentEventRepository,
  )
  constructor(
    devin: DevinAdapter,
    second: ProjectRepository | TmuxManager,
    third: PathValidatorFactory | ProjectRepository,
    fourth?: ConversationRepository | PathValidatorFactory,
    fifth?: ConversationRepository | MessageRepository,
    sixth?: MessageRepository | AgentEventRepository,
    seventh?: AgentEventRepository,
  ) {
    this.devin = devin

    if (typeof third === 'function') {
      this.repo = second as ProjectRepository
      this.pathValidatorFactory = third
      this.conversationRepo = fourth as ConversationRepository | undefined
      this.messageRepo = fifth as MessageRepository | undefined
      this.eventRepo = sixth as AgentEventRepository | undefined
      return
    }

    // Keep the pre-Task-2 constructor source-compatible for callers that own
    // the TmuxManager instance directly.
    this.tmux = second as TmuxManager
    this.repo = third
    this.pathValidatorFactory = fourth as PathValidatorFactory
    this.conversationRepo = fifth as ConversationRepository | undefined
    this.messageRepo = sixth as MessageRepository | undefined
    this.eventRepo = seventh
  }

  /**
   * Validate a project and create a prepared tmux-backed run. This method is
   * synchronous after the caller has resolved the project path, which lets a
   * database transaction decide when the process becomes visible.
   */
  prepareRun(options: PrepareRunOptions): PreparedAgentRun {
    if (!options.projectSlug?.trim() || !options.cwd?.trim()) {
      throw new AgentManagerError('A project slug and validated working directory are required', 400)
    }
    if (this.pendingRuns.has(options.conversationId)) {
      throw new AgentManagerError('Agent is currently being prepared', 409)
    }

    const existing = this.runs.get(options.conversationId)
    if (existing && this.isActiveStatus(existing.run.status)) {
      throw new AgentManagerError('Agent is currently working', 409)
    }

    const sessionName = this.buildSessionName(options.projectSlug, options.conversationId)
    const startedAt = new Date().toISOString()
    let sessionInfo

    try {
      sessionInfo = this.devin.start({
        sessionName,
        cwd: options.cwd,
        prompt: options.prompt,
        devinSessionId: options.devinSessionId,
        model: options.model || DEFAULT_DEVIN_MODEL,
      })
    } catch (error) {
      // A failed create is not assumed to have created a session. Killing here
      // could destroy an unrelated pre-existing session with the same name.
      throw error
    }

    const run: AgentRun = {
      conversationId: options.conversationId,
      projectSlug: options.projectSlug,
      sessionName,
      status: 'starting',
      devinSessionId: sessionInfo?.devinSessionId,
      userMessageId: options.userMessageId,
      startedAt: sessionInfo?.startedAt || startedAt,
      outputBuffer: '',
      normalizedSnapshot: [],
    }
    const state = this.createManagedRun(run)
    this.pendingRuns.set(options.conversationId, state)
    return new PreparedAgentRun(this, state)
  }

  /**
   * Compatibility wrapper for the legacy lifecycle endpoint. The atomic
   * prompt coordinator uses prepareRun/commit directly in a transaction.
   */
  async start(opts: StartAgentOptions): Promise<AgentRun> {
    await this.reconcileStaleInMemoryRun(opts.conversationId)

    if (this.conversationLocks.has(opts.conversationId)) {
      throw new AgentManagerError('Agent is currently working', 409)
    }

    if (this.countActiveRuns() >= MAX_CONCURRENT_SESSIONS) {
      throw new AgentManagerError('Maximum concurrent agent sessions reached', 429)
    }

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

    let resumeSessionId = opts.devinSessionId
    if (!resumeSessionId && this.conversationRepo) {
      const conversation = await this.conversationRepo.findById(opts.conversationId)
      resumeSessionId = conversation?.agent_session_id ?? undefined
    }

    // A terminal run is retained for status/history, but a new accepted run
    // replaces it after its old watcher has been fully removed.
    this.runs.delete(opts.conversationId)
    this.conversationLocks.delete(opts.conversationId)

    let prepared: PreparedAgentRun | undefined
    try {
      prepared = this.prepareRun({
        conversationId: opts.conversationId,
        projectId: opts.projectId,
        projectSlug: project.slug,
        cwd: pathResult.resolvedPath,
        prompt: opts.prompt,
        devinSessionId: resumeSessionId,
        model: opts.model || DEFAULT_DEVIN_MODEL,
      })
      const run = prepared.commit()
      try {
        await this.conversationRepo?.updateAgentStatus(opts.conversationId, 'running')
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        await this.finishRun(this.runs.get(opts.conversationId)!, 'failed', message, true)
        throw error
      }
      return run
    } catch (error) {
      if (prepared) {
        // A committed run is finalized above; rollback is intentionally a no-op
        // in that case. An uncommitted preparation still gets compensation.
        prepared.rollback()
      }
      try {
        await this.conversationRepo?.updateAgentStatus(opts.conversationId, 'idle')
      } catch {
        // Preserve the startup error for the caller.
      }
      throw error
    }
  }

  async stop(conversationId: string): Promise<AgentRun | null> {
    const state = this.runs.get(conversationId)
    if (!state) return null
    if (!this.isActiveStatus(state.run.status)) return state.run

    state.stopRequested = true
    state.run.status = 'stopping'
    this.clearWatcher(state)

    let stopError: string | undefined
    try {
      this.devin.stop(state.run.sessionName)
    } catch (error) {
      stopError = error instanceof Error ? error.message : String(error)
    }

    // A tick that was already persisting output must finish before stop writes
    // the terminal message and status event.
    if (state.watcherInFlight) await state.watcherInFlight
    await this.finishRun(
      state,
      'stopped',
      stopError ?? 'Agent stopped by user',
      true,
    )
    return state.run
  }

  getStatus(conversationId: string): AgentRun | null {
    return this.runs.get(conversationId)?.run ?? null
  }

  /** Send a follow-up prompt to a running agent's tmux session. */
  sendPrompt(conversationId: string, prompt: string): void {
    const state = this.runs.get(conversationId)
    if (!state) {
      throw new AgentManagerError('No agent run for this conversation', 404)
    }
    if (!this.isActiveStatus(state.run.status)) {
      throw new AgentManagerError('Agent is not running', 409)
    }
    this.devin.sendPrompt(state.run.sessionName, prompt)
  }

  getOutput(conversationId: string, startLine?: number): string[] {
    const state = this.runs.get(conversationId)
    if (!state) return []
    return startLine === undefined
      ? this.devin.captureOutput(state.run.sessionName)
      : this.devin.captureOutput(state.run.sessionName, startLine)
  }

  isConversationActive(conversationId: string): boolean {
    return this.conversationLocks.has(conversationId)
  }

  listActiveRuns(): AgentRun[] {
    return Array.from(this.runs.values())
      .filter((state) => this.isActiveStatus(state.run.status))
      .map((state) => state.run)
  }

  /**
   * Compatibility polling hook. The manager watcher is the normal path; this
   * method only triggers the same terminal transition for older callers.
   */
  syncRunState(conversationId: string): AgentRun | null {
    const state = this.runs.get(conversationId)
    if (!state) return null
    if (!this.isActiveStatus(state.run.status)) return state.run

    let alive = false
    try {
      alive = this.devin.isRunning(state.run.sessionName)
    } catch {
      alive = false
    }
    if (alive) return state.run

    try {
      this.captureAndAppend(state)
    } catch {
      // The session is already gone; the terminal transition still releases
      // the lock and records the best available runner state.
    }
    this.captureSessionIdWithoutWaiting(state)

    const exitCode = this.readExitCode(state.run.sessionName)
    const status: AgentStatus = exitCode !== null && exitCode !== 0 ? 'failed' : 'completed'
    const error = status === 'failed' ? `Devin exited with code ${exitCode}` : undefined
    // Keep the legacy synchronous contract: callers can immediately start a
    // replacement after observing the terminal state. The watcher path holds
    // this lock until terminal persistence has completed.
    this.conversationLocks.delete(conversationId)
    void this.finishRun(state, status, error, false).catch(() => {})
    return state.run
  }

  /** Subscribe to events after they have been persisted by the manager. */
  subscribe(conversationId: string, listener: AgentStreamListener): () => void {
    let conversationListeners = this.listeners.get(conversationId)
    if (!conversationListeners) {
      conversationListeners = new Set<AgentStreamListener>()
      this.listeners.set(conversationId, conversationListeners)
    }
    conversationListeners.add(listener)

    return () => {
      const current = this.listeners.get(conversationId)
      if (!current) return
      current.delete(listener)
      if (current.size === 0) this.listeners.delete(conversationId)
    }
  }

  /**
   * Reconcile active persisted conversations with exact deterministic tmux
   * names. Unknown sessions are deliberately ignored rather than attached.
   */
  async recoverSessions(): Promise<void> {
    const repository = this.conversationRepo as ActiveConversationRepository | undefined
    const findActive = repository?.findActive
      ?? repository?.findActiveConversations
      ?? repository?.findActiveAgentConversations
    if (!findActive) return

    const activeConversations = await findActive.call(repository)
    const sessions = this.listTmuxSessions()
    const sessionsByName = new Map(sessions.map((session) => [session.name, session]))

    for (const conversation of activeConversations) {
      if (this.runs.has(conversation.id) || this.pendingRuns.has(conversation.id)) continue

      const project = await this.repo.findById(conversation.project_id)
      const projectSlug = project?.slug ?? this.readProjectSlug(conversation)
      const expectedSessionName = projectSlug
        ? this.buildSessionName(projectSlug, conversation.id)
        : undefined
      const session = expectedSessionName ? sessionsByName.get(expectedSessionName) : undefined

      if (!projectSlug || !session) {
        await this.reconcileMissingSession(conversation.id, expectedSessionName)
        continue
      }

      const normalizedSnapshot = this.captureNormalizedSnapshot(session.name)
      const run: AgentRun = {
        conversationId: conversation.id,
        projectSlug,
        sessionName: session.name,
        status: conversation.agent_status === 'stopping' ? 'stopping' : 'running',
        devinSessionId: conversation.agent_session_id ?? undefined,
        startedAt: this.sessionStartedAt(session, conversation),
        outputBuffer: normalizedSnapshot.join('\n'),
        normalizedSnapshot,
      }
      const state = this.createManagedRun(run)
      state.stopRequested = conversation.agent_status === 'stopping'
      this.runs.set(conversation.id, state)
      this.conversationLocks.add(conversation.id)
      this.startWatcher(state)
    }
  }

  /** Find orphaned tmux sessions not tracked by the manager. */
  findOrphanedSessions(): string[] {
    const known = new Set(Array.from(this.runs.values()).map((state) => state.run.sessionName))
    return this.listTmuxSessions()
      .filter((session) => session.name.startsWith('jheckbot-') && !known.has(session.name))
      .map((session) => session.name)
  }

  /** Clean up orphaned tmux sessions through the adapter boundary. */
  cleanupOrphanedSessions(): string[] {
    const orphaned = this.findOrphanedSessions()
    for (const sessionName of orphaned) {
      try {
        this.devin.forceKill(sessionName)
      } catch {
        // Best-effort cleanup; an already-gone session is safe to ignore.
      }
    }
    return orphaned
  }

  commitPreparedRun(state: ManagedAgentRun): AgentRun {
    if (this.pendingRuns.get(state.run.conversationId) !== state) {
      throw new AgentManagerError('Prepared agent run is no longer pending', 409)
    }
    if (this.conversationLocks.has(state.run.conversationId)) {
      throw new AgentManagerError('Agent is currently working', 409)
    }

    this.pendingRuns.delete(state.run.conversationId)
    state.run.status = 'running'
    this.runs.set(state.run.conversationId, state)
    this.conversationLocks.add(state.run.conversationId)
    this.startWatcher(state)
    return state.run
  }

  rollbackPreparedRun(state: ManagedAgentRun): void {
    if (this.pendingRuns.get(state.run.conversationId) === state) {
      this.pendingRuns.delete(state.run.conversationId)
    }

    try {
      this.devin.forceKill(state.run.sessionName)
    } catch {
      // Rollback is best effort when tmux has already disappeared.
    }
  }

  private createManagedRun(run: AgentRun): ManagedAgentRun {
    return {
      run,
      pendingOutput: [],
      terminalizing: false,
      stopRequested: false,
      lastFlushAt: Date.now(),
      sessionIdPersisted: false,
    }
  }

  private async reconcileStaleInMemoryRun(conversationId: string): Promise<void> {
    if (!this.conversationLocks.has(conversationId)) return

    const state = this.runs.get(conversationId)
    if (state && this.isActiveStatus(state.run.status)) {
      let alive = false
      try {
        alive = this.devin.isRunning(state.run.sessionName)
      } catch {
        alive = false
      }
      if (alive) {
        throw new AgentManagerError('Agent is currently working', 409)
      }

      const exitCode = this.readExitCode(state.run.sessionName)
      const status: AgentStatus = exitCode !== null && exitCode !== 0 ? 'failed' : 'completed'
      const error = status === 'failed' ? `Devin exited with code ${exitCode}` : undefined
      if (state.watcherInFlight) await state.watcherInFlight
      await this.finishRun(state, status, error, true)
      return
    }

    this.conversationLocks.delete(conversationId)
    await this.conversationRepo?.updateAgentStatus(conversationId, 'idle')
  }

  private startWatcher(state: ManagedAgentRun): void {
    if (state.watcher || state.terminalizing) return

    state.watcher = setInterval(() => {
      if (state.terminalizing || state.watcherInFlight) return

      const inFlight = this.observeRun(state)
      state.watcherInFlight = inFlight
      void inFlight
        .catch(() => {
          // observeRun performs the terminal failure transition. This catch
          // prevents a rejected timer callback from becoming an unhandled error.
        })
        .finally(() => {
          if (state.watcherInFlight === inFlight) state.watcherInFlight = undefined
        })
    }, WATCH_INTERVAL_MS)

    const timer = state.watcher as WatcherHandle & { unref?: () => void }
    timer.unref?.()
  }

  private clearWatcher(state: ManagedAgentRun): void {
    if (!state.watcher) return
    clearInterval(state.watcher)
    state.watcher = undefined
  }

  private async observeRun(state: ManagedAgentRun): Promise<void> {
    if (state.terminalizing || !this.isActiveStatus(state.run.status)) return

    let captureError: string | undefined
    try {
      this.captureAndAppend(state)
    } catch (error) {
      captureError = error instanceof Error ? error.message : String(error)
    }

    let alive = false
    try {
      alive = this.devin.isRunning(state.run.sessionName)
    } catch {
      alive = false
    }

    if (state.stopRequested) {
      await this.finishRun(state, 'stopped', 'Agent stopped by user', false)
      return
    }

    if (alive) {
      if (!captureError && this.shouldFlush(state)) {
        await this.flushOutput(state)
      }
      return
    }

    const exitCode = this.readExitCode(state.run.sessionName)
    const failed = captureError !== undefined || (exitCode !== null && exitCode !== 0)
    const status: AgentStatus = failed ? 'failed' : 'completed'
    const error = captureError ?? (failed ? `Devin exited with code ${exitCode}` : undefined)
    await this.finishRun(state, status, error, false)
  }

  private async finishRun(
    state: ManagedAgentRun,
    status: AgentStatus,
    error?: string,
    captureFinal = true,
  ): Promise<void> {
    if (state.terminalPersistence) {
      await state.terminalPersistence
      return
    }

    state.terminalizing = true
    state.run.status = status
    state.run.endedAt ??= new Date().toISOString()
    if (error) state.run.error = error
    this.clearWatcher(state)

    const persistence = this.persistTerminal(state, status, error, captureFinal)
    state.terminalPersistence = persistence
    await persistence
  }

  private async persistTerminal(
    state: ManagedAgentRun,
    status: AgentStatus,
    error: string | undefined,
    captureFinal: boolean,
  ): Promise<void> {
    try {
      if (captureFinal) {
        try {
          this.captureAndAppend(state)
        } catch {
          // Preserve any output captured before the final tmux read failed.
        }
      }

      try {
        await this.flushOutput(state, true)
      } catch {
        // The terminal status and history still need to be attempted even if
        // one last live output event could not be written.
      }

      try {
        await this.persistSessionId(state)
      } catch {
        // Session ID persistence must not prevent terminal history/status writes.
      }

      if (status === 'completed') {
        const content = state.run.outputBuffer
        if (content.trim() && this.messageRepo) {
          try {
            await this.messageRepo.create({
              conversationId: state.run.conversationId,
              role: 'assistant',
              content,
              messageType: 'output',
            })
            await this.conversationRepo?.touchLastMessage(state.run.conversationId)
          } catch {
            // Continue to the terminal event and lock release.
          }
        }
      } else if (this.messageRepo) {
        const visibleError = error ?? (status === 'stopped' ? 'Agent stopped by user' : 'Agent failed')
        try {
          await this.messageRepo.create({
            conversationId: state.run.conversationId,
            role: 'system',
            content: visibleError,
            messageType: 'error',
          })
          await this.conversationRepo?.touchLastMessage(state.run.conversationId)
        } catch {
          // Continue to the terminal event and lock release.
        }
      }

      if (this.eventRepo) {
        try {
          const event = await this.eventRepo.create({
            conversationId: state.run.conversationId,
            eventType: 'status',
            content: JSON.stringify(
              status === 'failed' && error ? { status, error } : { status },
            ),
          })
          if (event) this.publish(event)
        } catch {
          // The in-memory lock is still released in the finally block below.
        }
      }
    } finally {
      // `agent_status` is deliberately updated only after the terminal event
      // attempt, so subscribers cannot observe idle before terminal status.
      try {
        await this.conversationRepo?.updateAgentStatus(
          state.run.conversationId,
          'idle',
        )
      } finally {
        this.conversationLocks.delete(state.run.conversationId)
      }
    }
  }

  private async flushOutput(state: ManagedAgentRun, force = false): Promise<void> {
    if (state.pendingOutput.length === 0) return
    if (!force && !this.shouldFlush(state)) return

    const content = state.pendingOutput.join('\n')
    if (!this.eventRepo) {
      state.pendingOutput = []
      state.lastFlushAt = Date.now()
      return
    }

    const event = await this.eventRepo.create({
      conversationId: state.run.conversationId,
      eventType: 'output',
      content: JSON.stringify({ content }),
    })
    state.pendingOutput = []
    state.lastFlushAt = Date.now()
    if (event) this.publish(event)
  }

  private shouldFlush(state: ManagedAgentRun): boolean {
    const buffered = state.pendingOutput.join('\n')
    return (
      Date.now() - state.lastFlushAt >= OUTPUT_FLUSH_INTERVAL_MS ||
      Buffer.byteLength(buffered, 'utf8') >= OUTPUT_FLUSH_BYTES
    )
  }

  private captureAndAppend(state: ManagedAgentRun): void {
    const captured = this.devin.captureOutput(state.run.sessionName)
    const normalized = this.normalizer.normalize(captured)
    const delta = this.normalizer.delta(state.run.normalizedSnapshot, normalized)
    state.run.normalizedSnapshot = normalized

    if (delta.length === 0) return
    state.run.outputBuffer = state.run.outputBuffer
      ? `${state.run.outputBuffer}\n${delta.join('\n')}`
      : delta.join('\n')
    state.pendingOutput.push(...delta)
  }

  private captureNormalizedSnapshot(sessionName: string): string[] {
    try {
      return this.normalizer.normalize(this.devin.captureOutput(sessionName))
    } catch {
      return []
    }
  }

  private captureSessionIdWithoutWaiting(state: ManagedAgentRun): void {
    if (state.run.devinSessionId || state.sessionIdPersisted) return
    const sessionId = this.readSessionId(state.run.sessionName)
    if (!sessionId) return
    state.run.devinSessionId = sessionId
    if (!this.conversationRepo?.updateAgentSessionId) return

    void this.conversationRepo
      .updateAgentSessionId(state.run.conversationId, sessionId)
      .then(() => {
        state.sessionIdPersisted = true
      })
      .catch(() => {
        // Session ID persistence is retried only by a future run/recovery.
      })
  }

  private async persistSessionId(state: ManagedAgentRun): Promise<void> {
    if (state.sessionIdPersisted) return
    const sessionId = state.run.devinSessionId ?? this.readSessionId(state.run.sessionName)
    if (!sessionId) return
    state.run.devinSessionId = sessionId
    if (!this.conversationRepo?.updateAgentSessionId) return

    await this.conversationRepo.updateAgentSessionId(state.run.conversationId, sessionId)
    state.sessionIdPersisted = true
  }

  private readSessionId(sessionName: string): string | undefined {
    try {
      return this.devin.getDevinSessionId(sessionName)
    } catch {
      return undefined
    }
  }

  private readExitCode(sessionName: string): number | null {
    try {
      return this.devin.getExitCode(sessionName)
    } catch {
      return null
    }
  }

  private async reconcileMissingSession(
    conversationId: string,
    expectedSessionName?: string,
  ): Promise<void> {
    const error = expectedSessionName
      ? `Agent session ${expectedSessionName} was not found during startup recovery`
      : 'Agent session was not found during startup recovery'

    if (this.messageRepo) {
      try {
        await this.messageRepo.create({
          conversationId,
          role: 'system',
          content: error,
          messageType: 'error',
        })
        await this.conversationRepo?.touchLastMessage(conversationId)
      } catch {
        // Continue with the status event and persisted lock release.
      }
    }

    if (this.eventRepo) {
      try {
        const event = await this.eventRepo.create({
          conversationId,
          eventType: 'status',
          content: JSON.stringify({ status: 'failed', error }),
        })
        if (event) this.publish(event)
      } catch {
        // Continue with the lock release below.
      }
    }

    await this.conversationRepo?.updateAgentStatus(conversationId, 'idle')
  }

  private listTmuxSessions(): TmuxSession[] {
    if (this.tmux) return this.tmux.listSessions()

    const adapter = this.devin as DevinAdapter & {
      listSessions?: () => TmuxSession[]
    }
    return typeof adapter.listSessions === 'function' ? adapter.listSessions() : []
  }

  private sessionStartedAt(session: TmuxSession, conversation: ConversationRecord): string {
    const createdSeconds = Number(session.created)
    if (Number.isFinite(createdSeconds) && createdSeconds > 0) {
      return new Date(createdSeconds * 1000).toISOString()
    }
    return conversation.created_at
  }

  private readProjectSlug(conversation: ConversationRecord): string | undefined {
    const withProjectSlug = conversation as ConversationRecord & { project_slug?: string }
    return withProjectSlug.project_slug
  }

  private publish(event: AgentStreamEvent): void {
    const conversationListeners = this.listeners.get(event.conversation_id)
    if (!conversationListeners) return

    for (const listener of conversationListeners) {
      try {
        listener(event)
      } catch {
        // One disconnected/broken subscriber must not stop persistence.
      }
    }
  }

  private isActiveStatus(status: AgentStatus): boolean {
    return status === 'running' || status === 'starting' || status === 'stopping'
  }

  private buildSessionName(projectSlug: string, conversationId: string): string {
    return `jheckbot-${projectSlug}-${conversationId}`
  }

  private countActiveRuns(): number {
    return Array.from(this.runs.values()).filter((state) => this.isActiveStatus(state.run.status)).length
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
