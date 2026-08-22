import { existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import type { Skill } from '@jheckbot/shared'
import { DEFAULT_DEVIN_MODEL, DEVIN_MODELS } from '@jheckbot/shared'
import { TmuxManager, type TmuxSession } from './TmuxManager.js'
import {
  AgentAdapterError,
  type AgentAdapter,
  type AgentSessionInfo,
  type StartAgentOptions,
} from './AgentAdapter.js'

export interface DevinAgentSessionInfo extends AgentSessionInfo {
  devinSessionId?: string
}

export class DevinAdapter implements AgentAdapter {
  readonly providerId = 'devin'
  readonly displayName = 'Devin'

  private readonly devinBin: string
  private readonly tmux: TmuxManager

  constructor(devinBin: string, tmux: TmuxManager) {
    this.devinBin = devinBin
    this.tmux = tmux
  }

  /** Verify the Devin binary exists and is executable (absolute path or PATH lookup). */
  isAvailable(): boolean {
    if (this.devinBin.includes('/')) {
      return existsSync(this.devinBin)
    }
    try {
      execFileSync('which', [this.devinBin], { stdio: 'pipe' })
      return true
    } catch {
      return false
    }
  }

  defaultModel(): string {
    return DEFAULT_DEVIN_MODEL
  }

  supportedModels() {
    return DEVIN_MODELS
  }

  hasSkills(): boolean {
    return true
  }

  listSkills(): Skill[] {
    try {
      const output = execFileSync(this.devinBin, ['skills', 'list', '--json'], {
        stdio: 'pipe',
        timeout: 10000,
        encoding: 'utf8',
      })
      const parsed = JSON.parse(output)
      if (!Array.isArray(parsed)) return []
      return parsed.filter(this.isSkill)
    } catch {
      return []
    }
  }

  private isSkill(value: unknown): value is Skill {
    if (!value || typeof value !== 'object') return false
    const v = value as Record<string, unknown>
    return typeof v.name === 'string' && typeof v.description === 'string'
  }

  /** Start an interactive Devin session inside a detached tmux session. */
  start(opts: StartAgentOptions): DevinAgentSessionInfo {
    if (!this.isAvailable()) {
      throw new AgentAdapterError(`Devin binary not found: ${this.devinBin}`)
    }
    if (!this.tmux.isAvailable()) {
      throw new AgentAdapterError('tmux is not available')
    }

    this.tmux.createSession(
      opts.sessionName,
      opts.cwd,
      this.buildCommand(opts),
      opts.env,
    )

    return {
      sessionName: opts.sessionName,
      sessionId: opts.resumeSessionId,
      devinSessionId: opts.resumeSessionId,
      status: 'starting',
      startedAt: new Date().toISOString(),
    }
  }

  /** Send a follow-up prompt to an existing Devin session. */
  sendPrompt(sessionName: string, prompt: string): void {
    if (!this.tmux.sessionExists(sessionName)) {
      throw new AgentAdapterError(`Session does not exist: ${sessionName}`)
    }
    this.tmux.sendKeys(sessionName, prompt)
  }

  /** Gracefully interrupt a Devin session before removing its tmux wrapper. */
  stop(sessionName: string): void {
    if (!this.tmux.sessionExists(sessionName)) return
    this.tmux.sendInterrupt(sessionName)
    setTimeout(() => {
      this.tmux.killSession(sessionName)
    }, 2000)
  }

  /** Force-kill a session immediately. */
  forceKill(sessionName: string): void {
    this.tmux.killSession(sessionName)
  }

  /** Capture the full tmux scrollback so reconnects can rebuild output. */
  captureOutput(sessionName: string, startLine: number | '-' = '-'): string[] {
    return this.tmux.captureOutput(sessionName, startLine)
  }

  /** Check if the Devin process is still running (not just the tmux session). */
  isRunning(sessionName: string): boolean {
    return this.tmux.isPaneAlive(sessionName)
  }

  /** List host sessions for manager startup reconciliation. */
  listSessions(): TmuxSession[] {
    return this.tmux.listSessions()
  }

  /** Tmux does not retain an exit code after a pane disappears. */
  getExitCode(_sessionName: string): number | null {
    return null
  }

  /** Extract a Devin session ID from captured output when the CLI prints one. */
  captureSessionId(sessionName: string): string | undefined {
    return this.getDevinSessionId(sessionName)
  }

  getDevinSessionId(sessionName: string): string | undefined {
    return this.extractSessionId(this.captureOutput(sessionName))
  }

  /** Extract a session ID from output if the CLI prints one. */
  extractSessionId(output: string[]): string | undefined {
    for (const line of output) {
      // Devin session IDs are human-readable slugs like "brisk-otter", not
      // hex UUIDs. Match slug-style IDs (lowercase letters + hyphens) that
      // appear after "session:" or "session " labels.
      const slugMatch = line.match(/session[:\s]+([a-z][a-z]*(?:-[a-z]+)+)/i)
      if (slugMatch) return slugMatch[1]
      // Fallback: UUID-style IDs printed by some integrations.
      const uuidMatch = line.match(/session[:\s]+([a-f0-9-]{8,})/i)
      if (uuidMatch) return uuidMatch[1]
    }
    return undefined
  }

  /**
   * Discover the most recently active Devin session ID for a working
   * directory by parsing `devin list --format json`. This is the reliable
   * way to obtain a session ID after a --print run, since --print mode
   * does not print the session ID to stdout.
   */
  discoverSessionId(cwd: string, sinceMs?: number): string | undefined {
    return this.getLatestSessionId(cwd, sinceMs)
  }

  getLatestSessionId(cwd: string, sinceMs?: number): string | undefined {
    try {
      const output = execFileSync(this.devinBin, ['list', '--format', 'json'], {
        cwd,
        stdio: 'pipe',
        timeout: 5000,
      })
      const sessions = JSON.parse(output.toString()) as Array<{
        id: string
        working_directory: string
        last_activity_at: number
      }>
      if (!Array.isArray(sessions) || sessions.length === 0) return undefined

      const sinceSeconds = sinceMs ? Math.floor(sinceMs / 1000) : 0
      const candidates = sinceSeconds
        ? sessions.filter((s) => (s.last_activity_at ?? 0) >= sinceSeconds - 120)
        : sessions

      const pool = candidates.length > 0 ? candidates : sessions
      pool.sort((a, b) => (b.last_activity_at ?? 0) - (a.last_activity_at ?? 0))
      return pool[0]?.id
    } catch {
      return undefined
    }
  }

  private buildCommand(opts: StartAgentOptions): string {
    const args = [this.devinBin]
    // --model is ignored when resuming (the session's saved model is used),
    // and passing it produces a warning. Omit it on resume.
    if (opts.model && !opts.resumeSessionId) args.push('--model', opts.model)
    if (opts.resumeSessionId) args.push('--resume', opts.resumeSessionId)
    // --print: non-interactive mode, Devin processes the prompt and exits so
    // the watcher can detect the dead tmux session and transition the run.
    // --respect-workspace-trust false: skip the interactive trust prompt in
    // headless mode; paths are already validated by PathValidator.
    args.push('--print', '--respect-workspace-trust', 'false')
    // --permission-mode dangerous: auto-approve all tools, no interactive prompts.
    if (opts.bypass) {
      args.push('--permission-mode', 'dangerous')
    }
    args.push('--', opts.prompt)
    return args.map((arg) => this.escapeShellArg(arg)).join(' ')
  }

  private escapeShellArg(value: string): string {
    return `'${value.replace(/'/g, "'\\''")}'`
  }
}
