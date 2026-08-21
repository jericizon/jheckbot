import { beforeEach, describe, expect, it, vi } from 'vitest'
import { existsSync } from 'node:fs'
import { DevinAdapter } from '../src/agent/DevinAdapter.js'
import type { TmuxManager } from '../src/agent/TmuxManager.js'

const mockExecFileSync = vi.hoisted(() => vi.fn())

vi.mock('node:fs', () => ({ existsSync: vi.fn() }))
vi.mock('node:child_process', () => ({
  execFileSync: mockExecFileSync,
  spawn: vi.fn(() => {
    throw new Error('direct spawn should not be used')
  }),
  execSync: vi.fn(),
}))

function createTmuxMock() {
  return {
    isAvailable: vi.fn().mockReturnValue(true),
    createSession: vi.fn(),
    sessionExists: vi.fn().mockReturnValue(true),
    sendKeys: vi.fn(),
    sendInterrupt: vi.fn(),
    killSession: vi.fn().mockReturnValue(true),
    captureOutput: vi.fn().mockReturnValue([]),
  } as unknown as TmuxManager
}

describe('DevinAdapter', () => {
  let adapter: DevinAdapter
  let tmux: TmuxManager

  beforeEach(() => {
    vi.clearAllMocks()
    mockExecFileSync.mockReset()
    vi.mocked(existsSync).mockReturnValue(true)
    tmux = createTmuxMock()
    adapter = new DevinAdapter('/home/jeric/.local/bin/devin', tmux)
  })

  it('reports available when binary exists', () => {
    expect(adapter.isAvailable()).toBe(true)
  })

  it('reports unavailable when the Devin binary is missing', () => {
    vi.mocked(existsSync).mockReturnValue(false)
    expect(adapter.isAvailable()).toBe(false)
  })

  it('supports existing one-argument construction through the tmux fallback', () => {
    mockExecFileSync.mockImplementation((_command: string, args: string[]) => {
      if (args.includes('has-session')) throw new Error('no session')
      return Buffer.from('')
    })
    const legacyAdapter = new DevinAdapter('/home/jeric/.local/bin/devin')

    legacyAdapter.start({ sessionName: 'legacy-session', cwd: '/tmp', prompt: 'hello' })

    expect(mockExecFileSync).toHaveBeenCalledWith(
      expect.any(String),
      expect.arrayContaining(['new-session', '-s', 'legacy-session', '-c', '/tmp']),
      { stdio: 'pipe' },
    )
  })

  it('starts an interactive Devin session in the validated project directory', () => {
    const cwd = '/home/jeric/Workspace/clients/test'
    const prompt = 'Fix the failing tests; do not delete files'

    const info = adapter.start({
      sessionName: 'jheckbot-test-1',
      cwd,
      prompt,
      model: 'glm-5-2',
      env: { DEVIN_TEST_FLAG: 'enabled' },
    })

    expect(tmux.createSession).toHaveBeenCalledWith(
      'jheckbot-test-1',
      cwd,
      expect.any(String),
      { DEVIN_TEST_FLAG: 'enabled' },
    )
    const command = vi.mocked(tmux.createSession).mock.calls[0][2]
    expect(command).toContain("'/home/jeric/.local/bin/devin'")
    expect(command).toContain("'--model' 'glm-5-2'")
    expect(command).toContain("'--' 'Fix the failing tests; do not delete files'")
    expect(command).not.toContain('-p')
    expect(info.status).toBe('starting')
    expect(info.sessionName).toBe('jheckbot-test-1')
  })

  it('includes a safely escaped resume session ID', () => {
    adapter.start({
      sessionName: 'jheckbot-test-1',
      cwd: '/home/jeric/Workspace/clients/test',
      prompt: 'Continue work',
      devinSessionId: "session-id'; touch /tmp/should-not-run",
    })

    const command = vi.mocked(tmux.createSession).mock.calls[0][2]
    expect(command).toContain("'--resume'")
    expect(command).toContain("'--resume' 'session-id'\\''; touch /tmp/should-not-run'")
  })

  it('fails closed when Devin or tmux is unavailable', () => {
    vi.mocked(existsSync).mockReturnValue(false)
    expect(() => adapter.start({ sessionName: 'test', cwd: '/tmp', prompt: 'hello' })).toThrow(
      'Devin binary not found',
    )

    vi.mocked(existsSync).mockReturnValue(true)
    vi.mocked(tmux.isAvailable).mockReturnValue(false)
    expect(() => adapter.start({ sessionName: 'test', cwd: '/tmp', prompt: 'hello' })).toThrow(
      'tmux is not available',
    )
  })

  it('delegates scrollback output capture to tmux', () => {
    vi.mocked(tmux.captureOutput).mockReturnValue(['line 1', 'line 2'])

    expect(adapter.captureOutput('test-session')).toEqual(['line 1', 'line 2'])
    expect(tmux.captureOutput).toHaveBeenCalledWith('test-session', '-')
  })

  it('delegates liveness checks to tmux', () => {
    vi.mocked(tmux.sessionExists).mockReturnValue(true)
    expect(adapter.isRunning('test-session')).toBe(true)
    expect(tmux.sessionExists).toHaveBeenCalledWith('test-session')

    vi.mocked(tmux.sessionExists).mockReturnValue(false)
    expect(adapter.isRunning('test-session')).toBe(false)
  })

  it('extracts a printed Devin session ID from tmux output', () => {
    vi.mocked(tmux.captureOutput).mockReturnValue([
      'working on the project',
      'session: abc12345-6789',
    ])

    expect(adapter.getDevinSessionId('test-session')).toBe('abc12345-6789')
    expect(tmux.captureOutput).toHaveBeenCalledWith('test-session', '-')
  })

  it('reports no exit code when tmux no longer has a session', () => {
    expect(adapter.getExitCode('test-session')).toBeNull()
  })

  it('delegates graceful stop and force-kill to tmux', () => {
    vi.useFakeTimers()
    try {
      adapter.stop('test-session')
      expect(tmux.sessionExists).toHaveBeenCalledWith('test-session')
      expect(tmux.sendInterrupt).toHaveBeenCalledWith('test-session')

      vi.advanceTimersByTime(2000)
      expect(tmux.killSession).toHaveBeenCalledWith('test-session')

      adapter.forceKill('test-session')
      expect(tmux.killSession).toHaveBeenCalledWith('test-session')
    } finally {
      vi.useRealTimers()
    }
  })

  it('does not stop a missing tmux session', () => {
    vi.mocked(tmux.sessionExists).mockReturnValue(false)

    adapter.stop('missing-session')

    expect(tmux.sendInterrupt).not.toHaveBeenCalled()
    expect(tmux.killSession).not.toHaveBeenCalled()
  })

  it('sends a follow-up prompt through tmux', () => {
    adapter.sendPrompt('test-session', 'Follow up prompt')

    expect(tmux.sendKeys).toHaveBeenCalledWith('test-session', 'Follow up prompt')
  })

  it('throws if a follow-up session does not exist', () => {
    vi.mocked(tmux.sessionExists).mockReturnValue(false)

    expect(() => adapter.sendPrompt('missing-session', 'hello')).toThrow(
      'Session does not exist',
    )
  })
})
