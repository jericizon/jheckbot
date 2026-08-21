import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'

export interface TmuxSession {
  name: string
  pid: number
  created: string
  attached: boolean
}

/**
 * Manages tmux server sessions for persistent agent processes.
 * Each agent run gets a named tmux session that survives API restarts.
 */
export class TmuxManager {
  private readonly tmuxBin: string

  constructor(tmuxBin: string) {
    this.tmuxBin = tmuxBin
  }

  /** Verify tmux is installed and executable. */
  isAvailable(): boolean {
    return existsSync(this.tmuxBin)
  }

  /** Create a new detached tmux session running a command. */
  createSession(name: string, cwd: string, command: string, env?: Record<string, string>): void {
    if (this.sessionExists(name)) {
      throw new TmuxError(`Session already exists: ${name}`)
    }

    const createArgs = [
      'new-session',
      '-d',                    // detached
      '-s', name,
      '-c', cwd,
    ]

    const environmentAssignments = Object.entries(env ?? {}).map(([key, value]) => {
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
        throw new TmuxError(`Invalid environment variable name: ${key}`)
      }
      return `${key}=${this.escapeShellArg(value)}`
    })

    createArgs.push('--', [...environmentAssignments, command].join(' '))
    execFileSync(this.tmuxBin, createArgs, { stdio: 'pipe' })
  }

  /** Kill a tmux session by name. */
  killSession(name: string): boolean {
    if (!this.sessionExists(name)) return false
    try {
      execFileSync(this.tmuxBin, ['kill-session', '-t', name], { stdio: 'pipe' })
      return true
    } catch {
      return false
    }
  }

  /** Check if a session exists. */
  sessionExists(name: string): boolean {
    try {
      execFileSync(
        this.tmuxBin,
        ['has-session', '-t', name],
        { stdio: 'pipe' },
      )
      return true
    } catch {
      return false
    }
  }

  /** Send keys (text input) to a session. */
  sendKeys(name: string, keys: string): void {
    execFileSync(
      this.tmuxBin,
      ['send-keys', '-t', name, keys, 'Enter'],
      { stdio: 'pipe' },
    )
  }

  /** Send Ctrl-C to a session for graceful interruption. */
  sendInterrupt(name: string): void {
    execFileSync(
      this.tmuxBin,
      ['send-keys', '-t', name, 'C-c'],
      { stdio: 'pipe' },
    )
  }

  /** Capture pane output from the beginning of scrollback. Returns text lines. */
  captureOutput(name: string, startLine: number | '-' = '-'): string[] {
    const args = ['capture-pane', '-t', name, '-p', '-S', String(startLine)]
    try {
      const output = execFileSync(this.tmuxBin, args, {
        stdio: 'pipe',
        encoding: 'utf-8',
      })
      return output.split('\n').filter((l) => l.length > 0)
    } catch {
      return []
    }
  }

  /** List all tmux sessions. */
  listSessions(): TmuxSession[] {
    try {
      const output = execFileSync(
        this.tmuxBin,
        ['list-sessions', '-F', '#{session_name}\t#{session_pid}\t#{session_created}\t#{session_attached}'],
        { stdio: 'pipe', encoding: 'utf-8' },
      )
      return output
        .trim()
        .split('\n')
        .filter((l) => l.length > 0)
        .map((line) => {
          const [name, pid, created, attached] = line.split('\t')
          return {
            name,
            pid: Number(pid),
            created,
            attached: attached === '1',
          }
        })
    } catch {
      return []
    }
  }

  /** Find orphaned jheckbot sessions (exist in tmux but not tracked by the app). */
  findOrphaned(knownNames: string[]): TmuxSession[] {
    const sessions = this.listSessions()
    const known = new Set(knownNames)
    return sessions.filter((s) => s.name.startsWith('jheckbot-') && !known.has(s.name))
  }

  private escapeShellArg(value: string): string {
    return `'${value.replace(/'/g, "'\\''")}'`
  }
}

export class TmuxError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TmuxError'
  }
}
