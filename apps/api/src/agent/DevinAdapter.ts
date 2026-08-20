import { existsSync } from 'node:fs'
import { TmuxManager } from './TmuxManager.js'

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
  env?: Record<string, string>
}

/**
 * Adapter for the Devin CLI.
 * Spawns Devin inside a tmux session for persistence and PTY support.
 *
 * Uses interactive mode (not -p) so the process stays alive for
 * streaming output and follow-up prompts.
 */
export class DevinAdapter {
  private readonly devinBin: string
  private readonly tmux: TmuxManager

  constructor(devinBin: string, tmux: TmuxManager) {
    this.devinBin = devinBin
    this.tmux = tmux
  }

  /** Verify the Devin binary exists and is executable. */
  isAvailable(): boolean {
    return existsSync(this.devinBin)
  }

  /** Start a Devin session inside a tmux session. */
  start(opts: StartDevinOptions): DevinSessionInfo {
    if (!this.isAvailable()) {
      throw new DevinAdapterError(`Devin binary not found: ${this.devinBin}`)
    }
    if (!this.tmux.isAvailable()) {
      throw new DevinAdapterError('tmux is not available')
    }

    // Build the devin command
    // Use -- to pass the prompt, and --resume or --continue if recovering
    let devinCmd = this.devinBin
    if (opts.devinSessionId) {
      devinCmd += ` --resume ${opts.devinSessionId}`
    }
    devinCmd += ` -- ${this.escapePrompt(opts.prompt)}`

    this.tmux.createSession(opts.sessionName, opts.cwd, devinCmd, opts.env)

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

  /** Gracefully stop a Devin session (Ctrl-C then kill tmux). */
  stop(sessionName: string): void {
    if (!this.tmux.sessionExists(sessionName)) return
    // Send Ctrl-C for graceful shutdown
    this.tmux.sendInterrupt(sessionName)
    // Give it a moment, then kill the tmux session
    setTimeout(() => {
      this.tmux.killSession(sessionName)
    }, 2000)
  }

  /** Force-kill a session immediately. */
  forceKill(sessionName: string): void {
    this.tmux.killSession(sessionName)
  }

  /** Capture current output from the session. */
  captureOutput(sessionName: string, startLine?: number): string[] {
    return this.tmux.captureOutput(sessionName, startLine)
  }

  /** Check if a session is still alive. */
  isRunning(sessionName: string): boolean {
    return this.tmux.sessionExists(sessionName)
  }

  /** Extract Devin session ID from output if present. */
  extractSessionId(output: string[]): string | undefined {
    // Devin CLI may print session IDs in output; look for patterns
    for (const line of output) {
      const match = line.match(/session[:\s]+([a-f0-9-]{8,})/i)
      if (match) return match[1]
    }
    return undefined
  }

  private escapePrompt(prompt: string): string {
    // Escape single quotes and shell special chars for tmux send-keys
    return prompt.replace(/'/g, "'\\''")
  }
}

export class DevinAdapterError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DevinAdapterError'
  }
}
