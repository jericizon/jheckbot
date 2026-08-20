import { describe, it, expect, vi, beforeEach } from 'vitest'
import { existsSync } from 'node:fs'
import { DevinAdapter } from '../src/agent/DevinAdapter.js'
import { TmuxManager } from '../src/agent/TmuxManager.js'

vi.mock('node:fs')
vi.mock('node:child_process')

describe('DevinAdapter', () => {
  let tmux: TmuxManager
  let adapter: DevinAdapter

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(existsSync).mockReturnValue(true)
    tmux = new TmuxManager('/usr/bin/tmux')
    adapter = new DevinAdapter('/home/jeric/.local/bin/devin', tmux)
  })

  it('reports available when binary exists', () => {
    vi.mocked(existsSync).mockReturnValue(true)
    expect(adapter.isAvailable()).toBe(true)
  })

  it('reports unavailable when binary is missing', () => {
    vi.mocked(existsSync).mockReturnValue(false)
    expect(adapter.isAvailable()).toBe(false)
  })

  it('starts a session with the correct command', () => {
    const createSession = vi.spyOn(tmux, 'createSession').mockImplementation(() => {})
    const info = adapter.start({
      sessionName: 'jheckbot-test-1',
      cwd: '/home/jeric/Workspace/clients/test',
      prompt: 'Fix the failing tests',
    })
    expect(createSession).toHaveBeenCalledWith(
      'jheckbot-test-1',
      '/home/jeric/Workspace/clients/test',
      expect.stringContaining('devin'),
      undefined,
    )
    expect(info.status).toBe('starting')
    expect(info.sessionName).toBe('jheckbot-test-1')
  })

  it('includes --resume when devinSessionId is provided', () => {
    const createSession = vi.spyOn(tmux, 'createSession').mockImplementation(() => {})
    adapter.start({
      sessionName: 'jheckbot-test-1',
      cwd: '/tmp',
      prompt: 'Continue work',
      devinSessionId: 'abc12345',
    })
    expect(createSession).toHaveBeenCalledWith(
      'jheckbot-test-1',
      '/tmp',
      expect.stringContaining('--resume abc12345'),
      undefined,
    )
  })

  it('throws if Devin binary is not available', () => {
    vi.mocked(existsSync).mockReturnValue(false)
    expect(() =>
      adapter.start({ sessionName: 'test', cwd: '/tmp', prompt: 'hello' }),
    ).toThrow('Devin binary not found')
  })

  it('sends a follow-up prompt via sendKeys', () => {
    const sendKeys = vi.spyOn(tmux, 'sendKeys').mockImplementation(() => {})
    const sessionExists = vi.spyOn(tmux, 'sessionExists').mockReturnValue(true)
    adapter.sendPrompt('test-session', 'Follow up prompt')
    expect(sendKeys).toHaveBeenCalledWith('test-session', 'Follow up prompt')
  })

  it('throws when sending prompt to non-existent session', () => {
    vi.spyOn(tmux, 'sessionExists').mockReturnValue(false)
    expect(() => adapter.sendPrompt('nonexistent', 'hello')).toThrow('Session does not exist')
  })

  it('sends interrupt then kills on stop', () => {
    const sendInterrupt = vi.spyOn(tmux, 'sendInterrupt').mockImplementation(() => {})
    const killSession = vi.spyOn(tmux, 'killSession').mockImplementation(() => {})
    vi.spyOn(tmux, 'sessionExists').mockReturnValue(true)
    adapter.stop('test-session')
    expect(sendInterrupt).toHaveBeenCalledWith('test-session')
  })

  it('force kills a session', () => {
    const killSession = vi.spyOn(tmux, 'killSession').mockImplementation(() => {})
    adapter.forceKill('test-session')
    expect(killSession).toHaveBeenCalledWith('test-session')
  })

  it('extracts session ID from output', () => {
    const output = ['Some text', 'session: abc12345-6789', 'more text']
    const id = adapter.extractSessionId(output)
    expect(id).toBe('abc12345-6789')
  })

  it('returns undefined when no session ID in output', () => {
    const output = ['no session id here', 'just text']
    expect(adapter.extractSessionId(output)).toBeUndefined()
  })
})
