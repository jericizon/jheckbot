import { existsSync } from 'node:fs'
import { TmuxManager, type TmuxSession } from './TmuxManager.js'

export interface DevinSessionInfo {
  sessionName: string
  devinSessionId?: string
  status: DevinSessionStatus
  startedAt: string
}

export type DevinSessionStatus = 'starting' | 'running' | 'stopped' | 'failed'

export interface StartDevinOptions {
  sessionName: string
  cwd: string
  prompt: string
  devinSessionId?: string
  model?: string
  env?: Record<string, string>
}

/**
 * Adapter for the Devin CLI.
 * Keeps Devin-specific command construction here while TmuxManager owns the
 * persistent PTY boundary.
 */
export class DevinAdapter {
  private readonly devinBin: string
  private readonly tmux: TmuxManager

  constructor(devinBin: string)
  constructor(devinBin: string, tmux: TmuxManager)
  constructor(devinBin: string, tmux?: TmuxManager) {
    this.devinBin = devinBin
    // The one-argument overload keeps existing callers source-compatible while
    // still using the configured host tmux boundary when no dependency is injected.
    this.tmux = tmux ?? new TmuxManager(process.env.TMUX_BIN ?? '/usr/bin/tmux')
  }

  /** Verify the Devin binary exists and is executable. */
  isAvailable(): boolean {
    return existsSync(this.devinBin)
  }

  /** Start an interactive Devin session inside a detached tmux session. */
  start(opts: StartDevinOptions): DevinSessionInfo {
    if (!this.isAvailable()) {
      throw new DevinAdapterError(`Devin binary not found: ${this.devinBin}`)
    }
    if (!this.tmux.isAvailable()) {
      throw new DevinAdapterError('tmux is not available')
    }

    this.tmux.createSession(
      opts.sessionName,
      opts.cwd,
      this.buildCommand(opts),
      opts.env,
    )

    return {
      sessionName: opts.sessionName,
      status: 'starting',
      startedAt: new Date().toISOString(),
    }
  }

  /** Send a follow-up prompt to an existing Devin session. */
  sendPrompt(sessionName: string, prompt: string): void {
    if (!this.tmux.sessionExists(sessionName)) {
      throw new DevinAdapterError(`Session does not exist: ${sessionName}`)
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

  /** Check if a session is still alive. */
  isRunning(sessionName: string): boolean {
    return this.tmux.sessionExists(sessionName)
  }

  /** List host sessions for manager startup reconciliation. */
  listSessions(): TmuxSession[] {
    return this.tmux.listSessions()
  }

  /** Extract a Devin session ID from captured output when the CLI prints one. */
  getDevinSessionId(sessionName: string): string | undefined {
    return this.extractSessionId(this.captureOutput(sessionName))
  }

  /** Tmux does not retain an exit code after a pane disappears. */
  getExitCode(_sessionName: string): number | null {
    return null
  }

  /** Extract a session ID from output if the interactive CLI prints one. */
  extractSessionId(output: string[]): string | undefined {
    for (const line of output) {
      const match = line.match(/session[:\s]+([a-f0-9-]{8,})/i)
      if (match) return match[1]
    }
    return undefined
  }

  private buildCommand(opts: StartDevinOptions): string {
    const args = [this.devinBin]
    if (opts.model) args.push('--model', opts.model)
    if (opts.devinSessionId) args.push('--resume', opts.devinSessionId)
    args.push('--', opts.prompt)
    return args.map((arg) => this.escapeShellArg(arg)).join(' ')
  }

  private escapeShellArg(value: string): string {
    return `'${value.replace(/'/g, "'\\''")}'`
  }
}

export class DevinAdapterError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DevinAdapterError'
  }
}
