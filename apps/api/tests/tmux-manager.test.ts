import { describe, it, expect, vi, beforeEach } from 'vitest'
import { execFileSync, execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { TmuxManager } from '../src/agent/TmuxManager.js'

vi.mock('node:child_process')
vi.mock('node:fs')

describe('TmuxManager', () => {
  let tmux: TmuxManager

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(existsSync).mockReturnValue(true)
    tmux = new TmuxManager('/usr/bin/tmux')
  })

  it('reports available when binary exists', () => {
    vi.mocked(existsSync).mockReturnValue(true)
    expect(tmux.isAvailable()).toBe(true)
  })

  it('reports unavailable when binary is missing', () => {
    vi.mocked(existsSync).mockReturnValue(false)
    expect(tmux.isAvailable()).toBe(false)
  })

  it('creates a session with correct args', () => {
    vi.mocked(execFileSync).mockImplementation((cmd: string, args: string[]) => {
      // has-session throws when session doesn't exist; new-session succeeds
      if (args.includes('has-session')) throw new Error('no session')
      return Buffer.from('')
    })
    tmux.createSession('test-session', '/tmp', 'echo hello')
    expect(execFileSync).toHaveBeenCalledWith(
      '/usr/bin/tmux',
      ['new-session', '-d', '-s', 'test-session', '-c', '/tmp', '--', 'echo hello'],
      { stdio: 'pipe' },
    )
  })

  it('shell-quotes environment values before the session command starts', () => {
    vi.mocked(execFileSync).mockImplementation((_cmd: string, args: string[]) => {
      if (args.includes('has-session')) throw new Error('no session')
      return Buffer.from('')
    })

    const value = `literal value "double" 'single' \`backtick\` $HOME; echo should-not-run`
    const quotedValue = `'${value.replace(/'/g, "'\\''")}'`
    tmux.createSession('test-session', '/tmp', 'echo hello', { DEVIN_FLAG: value })

    expect(execFileSync).toHaveBeenCalledWith(
      '/usr/bin/tmux',
      [
        'new-session',
        '-d',
        '-s',
        'test-session',
        '-c',
        '/tmp',
        '--',
        `DEVIN_FLAG=${quotedValue} echo hello`,
      ],
      { stdio: 'pipe' },
    )
    expect(execSync).not.toHaveBeenCalled()
  })

  it('kills a session', () => {
    vi.mocked(execFileSync).mockReturnValue(Buffer.from(''))
    tmux.killSession('test-session')
    expect(execFileSync).toHaveBeenCalledWith(
      '/usr/bin/tmux',
      ['kill-session', '-t', 'test-session'],
      { stdio: 'pipe' },
    )
  })

  it('returns false when killing a non-existent session', () => {
    vi.mocked(execFileSync).mockImplementation(() => {
      throw new Error('no session')
    })
    expect(tmux.killSession('nonexistent')).toBe(false)
  })

  it('checks if session exists', () => {
    vi.mocked(execFileSync).mockReturnValue(Buffer.from(''))
    expect(tmux.sessionExists('test')).toBe(true)
  })

  it('returns false when session does not exist', () => {
    vi.mocked(execFileSync).mockImplementation(() => {
      throw new Error('can\'t find session')
    })
    expect(tmux.sessionExists('nonexistent')).toBe(false)
  })

  it('sends keys to a session', () => {
    vi.mocked(execFileSync).mockReturnValue(Buffer.from(''))
    tmux.sendKeys('test', 'some input')
    expect(execFileSync).toHaveBeenCalledWith(
      '/usr/bin/tmux',
      ['send-keys', '-t', 'test', 'some input', 'Enter'],
      { stdio: 'pipe' },
    )
  })

  it('sends interrupt (Ctrl-C) to a session', () => {
    vi.mocked(execFileSync).mockReturnValue(Buffer.from(''))
    tmux.sendInterrupt('test')
    expect(execFileSync).toHaveBeenCalledWith(
      '/usr/bin/tmux',
      ['send-keys', '-t', 'test', 'C-c'],
      { stdio: 'pipe' },
    )
  })

  it('captures the full pane scrollback as lines', () => {
    vi.mocked(execFileSync).mockReturnValue('line 1\nline 2\nline 3\n')
    const output = tmux.captureOutput('test')
    expect(output).toEqual(['line 1', 'line 2', 'line 3'])
    expect(execFileSync).toHaveBeenCalledWith(
      '/usr/bin/tmux',
      ['capture-pane', '-t', 'test', '-p', '-S', '-'],
      { stdio: 'pipe', encoding: 'utf-8' },
    )
  })

  it('returns empty array when capture fails', () => {
    vi.mocked(execFileSync).mockImplementation(() => {
      throw new Error('no session')
    })
    expect(tmux.captureOutput('nonexistent')).toEqual([])
  })

  it('lists sessions', () => {
    vi.mocked(execFileSync).mockReturnValue('session1\t123\t1700000000\t0\nsession2\t456\t1700000001\t1\n')
    const sessions = tmux.listSessions()
    expect(sessions).toHaveLength(2)
    expect(sessions[0]).toEqual({
      name: 'session1',
      pid: 123,
      created: '1700000000',
      attached: false,
    })
    expect(sessions[1].attached).toBe(true)
  })

  it('returns empty list when no sessions exist', () => {
    vi.mocked(execFileSync).mockImplementation(() => {
      throw new Error('no server')
    })
    expect(tmux.listSessions()).toEqual([])
  })

  it('finds orphaned jheckbot sessions', () => {
    vi.mocked(execFileSync).mockReturnValue('jheckbot-known\t123\t1700000000\t0\njheckbot-orphan\t456\t1700000001\t0\n')
    const orphaned = tmux.findOrphaned(['jheckbot-known'])
    expect(orphaned).toHaveLength(1)
    expect(orphaned[0].name).toBe('jheckbot-orphan')
  })
})
