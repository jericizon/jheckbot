import { closeSync, fstatSync, openSync, readFileSync, readdirSync, readSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { StringDecoder } from 'node:string_decoder'
import { TmuxManager } from './TmuxManager.js'

const LOG_FILE_PREFIX = 'devin_'
const LOG_FILE_SUFFIX = '.log'

/**
 * Tails the active Devin ACP trace log file for a tmux-backed run.
 *
 * The trace is written by the `devin acp` child process, not the main CLI
 * wrapper, so the tailer walks the pane PID and its children to find the
 * correct log file. Once found it reads only new bytes and emits complete
 * lines.
 */
export class LogTailer {
  private readonly sessionName: string
  private readonly tmux: TmuxManager
  private readonly logDir: string

  private resolvedPath?: string
  private position = 0
  private partial = ''
  private decoder = new StringDecoder('utf8')
  // Cache the pane PID so we don't shell out to tmux on every tail() call.
  // The PID doesn't change during a run; re-resolve only if the log file
  // can't be opened (session may have been recreated).
  private cachedPanePid?: number
  private pidResolveFailed = false

  constructor(sessionName: string, tmux: TmuxManager, logDir: string) {
    this.sessionName = sessionName
    this.tmux = tmux
    this.logDir = logDir
  }

  /** Read and return any new log lines since the last call. */
  tail(): string[] {
    const currentPath = this.resolveLogPath()
    if (currentPath && currentPath !== this.resolvedPath) {
      this.resolvedPath = currentPath
      this.position = this.safeStatSize(currentPath)
      this.partial = ''
      this.decoder = new StringDecoder('utf8')
    }

    if (!this.resolvedPath) {
      this.resolvedPath = this.resolveLogPath()
      if (!this.resolvedPath) return []
      this.position = this.safeStatSize(this.resolvedPath)
      return []
    }

    const fd = this.openLogFile()
    if (fd === undefined) return []

    let newLines: string[] = []
    try {
      const stats = fstatSync(fd)
      if (stats.size < this.position) {
        // Log file was rotated/recreated; start over from the beginning.
        this.position = 0
        this.partial = ''
        this.decoder = new StringDecoder('utf8')
      }

      const length = stats.size - this.position
      if (length > 0) {
        const buffer = Buffer.alloc(length)
        const bytesRead = readSync(fd, buffer, 0, length, this.position)
        this.position += bytesRead
        this.partial += this.decoder.write(buffer.subarray(0, bytesRead))
      }

      let idx = this.partial.indexOf('\n')
      while (idx !== -1) {
        const line = this.partial.slice(0, idx)
        if (line.length > 0) newLines.push(line)
        this.partial = this.partial.slice(idx + 1)
        idx = this.partial.indexOf('\n')
      }
    } finally {
      closeSync(fd)
    }

    return newLines
  }

  private resolveLogPath(): string | undefined {
    // Use cached PID if available; only shell out to tmux on first call
    // or after a failed resolve (session may have been recreated).
    if (this.cachedPanePid === undefined && !this.pidResolveFailed) {
      this.cachedPanePid = this.tmux.getPanePid(this.sessionName)
      if (this.cachedPanePid === undefined) {
        this.pidResolveFailed = true
        return undefined
      }
    }

    if (this.cachedPanePid === undefined) return undefined

    const pids = [this.cachedPanePid, ...this.childPids(this.cachedPanePid)]
    // Prefer the `devin acp` child log; it holds the real trace.
    for (const pid of pids) {
      if (this.isAcpProcess(pid)) {
        const path = this.findLogForPid(pid)
        if (path) return path
      }
    }
    return this.findLogForPid(this.cachedPanePid)
  }

  private childPids(pid: number): number[] {
    const found = new Set<number>()
    const taskDir = `/proc/${pid}/task`
    try {
      const entries = readdirSync(taskDir)
      for (const entry of entries) {
        const childrenFile = join(taskDir, entry, 'children')
        try {
          const data = readFileSync(childrenFile, 'utf8').trim()
          for (const token of data.split(/\s+/)) {
            const n = Number.parseInt(token, 10)
            if (!Number.isNaN(n) && n > 0) found.add(n)
          }
        } catch { }
      }
    } catch { }
    return Array.from(found)
  }

  private isAcpProcess(pid: number): boolean {
    try {
      const cmdline = readFileSync(`/proc/${pid}/cmdline`, 'utf8')
      const parts = cmdline.split('\0').filter(Boolean)
      return parts[1] === 'acp' || parts.includes('acp')
    } catch {
      return false
    }
  }

  private findLogForPid(pid: number): string | undefined {
    try {
      const entries = readdirSync(this.logDir)
      const matches = entries
        .filter((e) => e.startsWith(LOG_FILE_PREFIX) && e.endsWith(`_${pid}${LOG_FILE_SUFFIX}`))
        .map((e) => join(this.logDir, e))
      if (matches.length === 0) return undefined
      return matches.sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0]
    } catch {
      return undefined
    }
  }

  private openLogFile(): number | undefined {
    try {
      return openSync(this.resolvedPath!, 'r')
    } catch {
      this.resolvedPath = undefined
      this.partial = ''
      this.decoder = new StringDecoder('utf8')
      return undefined
    }
  }

  private safeStatSize(path: string): number {
    try {
      return statSync(path).size
    } catch {
      return 0
    }
  }
}
