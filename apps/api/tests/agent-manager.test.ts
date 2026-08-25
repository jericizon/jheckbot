import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AgentManager, AgentManagerError } from '../src/agent/AgentManager.js'
import { DevinAdapter } from '../src/agent/DevinAdapter.js'
import { TmuxManager } from '../src/agent/TmuxManager.js'
import { ProjectRepository, type ProjectRecord } from '../src/repositories/ProjectRepository.js'
import { ConversationRepository, type ConversationRecord } from '../src/repositories/ConversationRepository.js'
import { MessageRepository } from '../src/repositories/MessageRepository.js'
import { AgentEventRepository, type AgentEventRecord } from '../src/repositories/AgentEventRepository.js'
import { PathValidator, type AllowedRoot } from '../src/services/PathValidator.js'
import { MediaService } from '../src/services/MediaService.js'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { mkdirSync, rmSync, writeFileSync, utimesSync } from 'node:fs'

vi.mock('../db/pool.js', () => ({
  pool: { query: vi.fn(), on: vi.fn(), end: vi.fn() },
}))

const TMP = join(tmpdir(), 'jheckbot-agent-test')

describe('AgentManager', () => {
  let devin: DevinAdapter
  let repo: ProjectRepository
  let conversationRepo: ConversationRepository
  let messageRepo: MessageRepository
  let eventRepo: AgentEventRepository
  let manager: AgentManager
  let mockProject: ProjectRecord

  beforeEach(() => {
    mkdirSync(join(TMP, 'test-project'), { recursive: true })
    mkdirSync(join(TMP, 'test-project', '.git'), { recursive: true })
    writeFileSync(join(TMP, 'test-project', 'package.json'), '{}')

    mockProject = {
      id: 'proj-1',
      name: 'Test Project',
      slug: 'test-project',
      path: join(TMP, 'test-project'),
      description: null,
      enabled: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    repo = {
      findById: vi.fn().mockResolvedValue(mockProject),
      findAllowedRoots: vi.fn().mockResolvedValue<AllowedRoot[]>([
        { id: 'root-1', name: 'TestRoot', path: TMP, enabled: true },
      ]),
    } as unknown as ProjectRepository

    conversationRepo = {
      findById: vi.fn().mockResolvedValue<ConversationRecord | null>(null),
      findActive: vi.fn().mockResolvedValue<ConversationRecord[]>([]),
      updateAgentStatus: vi.fn().mockResolvedValue(undefined),
      updateAgentSessionId: vi.fn().mockResolvedValue(undefined),
      clearAgentSessionId: vi.fn().mockResolvedValue(undefined),
      findByAgentSessionId: vi.fn().mockResolvedValue<ConversationRecord[]>([]),
      touchLastMessage: vi.fn().mockResolvedValue(undefined),
    } as unknown as ConversationRepository

    messageRepo = {
      create: vi.fn().mockResolvedValue({
        id: 'message-1',
        conversation_id: 'conv-1',
        role: 'assistant',
        content: 'output',
        message_type: 'output',
        model: null,
        created_at: new Date().toISOString(),
      }),
    } as unknown as MessageRepository

    eventRepo = {
      create: vi.fn().mockImplementation(async (data: { conversationId: string; eventType: string; content?: string }) => ({
        id: `event-${data.eventType}`,
        conversation_id: data.conversationId,
        event_type: data.eventType,
        content: data.content ?? null,
        event_sequence: '1',
        created_at: new Date().toISOString(),
      } satisfies AgentEventRecord)),
    } as unknown as AgentEventRepository

    devin = new DevinAdapter('devin', new TmuxManager('tmux'))

    vi.spyOn(devin, 'isAvailable').mockReturnValue(true)
    vi.spyOn(devin, 'start').mockReturnValue({
      sessionName: 'jheckbot-test-project-conv-1',
      status: 'starting',
      startedAt: new Date().toISOString(),
    })
    // By default the process is considered alive so a running agent is
    // genuinely running. Tests that simulate the process dying override this.
    vi.spyOn(devin, 'isRunning').mockReturnValue(true)
    vi.spyOn(devin, 'getDevinSessionId').mockReturnValue(undefined)
    vi.spyOn(devin, 'getLatestSessionId').mockReturnValue(undefined)
    vi.spyOn(devin, 'getExitCode').mockReturnValue(null)
    vi.spyOn(devin, 'captureOutput').mockReturnValue([])
    vi.spyOn(devin, 'listSessions').mockReturnValue([])
    vi.spyOn(devin, 'forceKill').mockImplementation(() => {})

    const factory = (roots: AllowedRoot[]) => new PathValidator(roots)
    manager = new AgentManager(devin, repo, factory, conversationRepo, messageRepo, eventRepo)
  })

  afterEach(() => {
    rmSync(TMP, { recursive: true, force: true })
  })

  it('starts an agent run for a valid project', async () => {
    const run = await manager.start({
      conversationId: 'conv-1',
      projectId: 'proj-1',
      prompt: 'Fix the tests',
    })
    expect(run.status).toBe('running')
    expect(run.sessionName).toBe('jheckbot-test-project-conv-1')
    expect(manager.isConversationActive('conv-1')).toBe(true)
  })

  it('rejects a second prompt for the same conversation (409)', async () => {
    await manager.start({ conversationId: 'conv-1', projectId: 'proj-1', prompt: 'first' })
    await expect(
      manager.start({ conversationId: 'conv-1', projectId: 'proj-1', prompt: 'second' }),
    ).rejects.toMatchObject({ statusCode: 409 })
  })

  // Regression: a leaked lock (child process died but lock never released) must
  // not block a new run. Previously start() 409'd forever after Devin exited.
  // Why old tests missed it: they never simulated the process dying, so the
  // lock was always treated as genuinely held.
  it('clears a stale lock when the child process is gone and starts a new run', async () => {
    const first = await manager.start({ conversationId: 'conv-1', projectId: 'proj-1', prompt: 'Q1' })
    expect(first.status).toBe('running')
    expect(manager.isConversationActive('conv-1')).toBe(true)

    // Devin finishes Q1 and the child process exits — but the manager hasn't noticed
    vi.mocked(devin.isRunning).mockReturnValue(false)

    // Q2 arrives via start() (frontend always uses startAgent now)
    const second = await manager.start({ conversationId: 'conv-1', projectId: 'proj-1', prompt: 'Q2' })
    expect(second.status).toBe('running')
    expect(manager.isConversationActive('conv-1')).toBe(true)
    // The previous run was finalized, not left as a zombie
    expect(first.status).toBe('completed')
    expect(first.endedAt).toBeDefined()
  })

  it('reconcileStaleLock clears a stale lock when the pane is dead', async () => {
    await manager.start({ conversationId: 'conv-1', projectId: 'proj-1', prompt: 'Q1' })
    expect(manager.isConversationActive('conv-1')).toBe(true)

    // Devin finishes and the pane dies — but the lock wasn't cleaned up
    vi.mocked(devin.isRunning).mockReturnValue(false)

    await manager.reconcileStaleLock('conv-1')
    expect(manager.isConversationActive('conv-1')).toBe(false)
    expect(conversationRepo.updateAgentStatus).toHaveBeenCalledWith('conv-1', 'idle')
  })

  it('reconcileStaleLock does nothing when no lock exists', async () => {
    await manager.reconcileStaleLock('conv-with-no-lock')
    expect(manager.isConversationActive('conv-with-no-lock')).toBe(false)
  })

  it('reconcileStaleLock keeps the lock when the pane is alive', async () => {
    await manager.start({ conversationId: 'conv-1', projectId: 'proj-1', prompt: 'Q1' })
    // isRunning stays true (default mock)
    await manager.reconcileStaleLock('conv-1')
    expect(manager.isConversationActive('conv-1')).toBe(true)
  })

  it('syncRunState finalizes a run when the child process exits', async () => {
    await manager.start({ conversationId: 'conv-1', projectId: 'proj-1', prompt: 'Q1' })
    expect(manager.isConversationActive('conv-1')).toBe(true)

    vi.mocked(devin.isRunning).mockReturnValue(false)
    vi.mocked(devin.getDevinSessionId).mockReturnValue('devin-session-xyz')
    vi.mocked(devin.getExitCode).mockReturnValue(0)
    const run = manager.syncRunState('conv-1')

    expect(run?.status).toBe('completed')
    expect(run?.endedAt).toBeDefined()
    expect(run?.devinSessionId).toBe('devin-session-xyz')
    expect(manager.isConversationActive('conv-1')).toBe(false)
    expect(conversationRepo.updateAgentSessionId).toHaveBeenCalledWith('conv-1', 'devin-session-xyz')
  })

  it('discovers session ID via devin list when terminal scraping fails', async () => {
    await manager.start({ conversationId: 'conv-1', projectId: 'proj-1', prompt: 'Q1' })
    expect(manager.isConversationActive('conv-1')).toBe(true)

    // Terminal scraping returns nothing (as in --print mode)
    vi.mocked(devin.isRunning).mockReturnValue(false)
    vi.mocked(devin.getDevinSessionId).mockReturnValue(undefined)
    vi.mocked(devin.getLatestSessionId).mockReturnValue('healthy-dollar')
    vi.mocked(devin.getExitCode).mockReturnValue(0)
    const run = manager.syncRunState('conv-1')

    expect(run?.status).toBe('completed')
    expect(run?.devinSessionId).toBe('healthy-dollar')
    // Collision check is async; flush microtasks before asserting DB call
    await vi.waitFor(() => {
      expect(conversationRepo.updateAgentSessionId).toHaveBeenCalledWith('conv-1', 'healthy-dollar')
    })
  })

  it('syncRunState marks a run as failed on non-zero exit code', async () => {
    await manager.start({ conversationId: 'conv-1', projectId: 'proj-1', prompt: 'Q1' })

    vi.mocked(devin.isRunning).mockReturnValue(false)
    vi.mocked(devin.getExitCode).mockReturnValue(1)
    const run = manager.syncRunState('conv-1')

    expect(run?.status).toBe('failed')
    expect(run?.error).toContain('code 1')
  })

  it('syncRunState leaves a genuinely running agent untouched', async () => {
    await manager.start({ conversationId: 'conv-1', projectId: 'proj-1', prompt: 'Q1' })
    // isRunning stays true (default mock)
    const run = manager.syncRunState('conv-1')

    expect(run?.status).toBe('running')
    expect(manager.isConversationActive('conv-1')).toBe(true)
  })

  it('passes --resume with stored Devin session ID for follow-up prompts', async () => {
    // Simulate a conversation that has a prior Devin session ID stored
    vi.mocked(conversationRepo.findById).mockResolvedValue({
      id: 'conv-1',
      project_id: 'proj-1',
      title: 'Test',
      status: 'active',
      agent_type: 'devin',
      agent_session_id: 'prior-session-id',
      agent_status: 'idle',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_message_at: null,
    })

    const startSpy = vi.spyOn(devin, 'start')
    await manager.start({ conversationId: 'conv-1', projectId: 'proj-1', prompt: 'Follow up' })

    expect(startSpy).toHaveBeenCalledWith(
      expect.objectContaining({ resumeSessionId: 'prior-session-id' }),
    )
  })

  it('rejects when project is not found (404)', async () => {
    vi.mocked(repo.findById).mockResolvedValueOnce(null)
    await expect(
      manager.start({ conversationId: 'conv-2', projectId: 'nonexistent', prompt: 'test' }),
    ).rejects.toMatchObject({ statusCode: 404 })
  })

  it('rejects when project is disabled (400)', async () => {
    vi.mocked(repo.findById).mockResolvedValueOnce({ ...mockProject, enabled: false })
    await expect(
      manager.start({ conversationId: 'conv-3', projectId: 'proj-1', prompt: 'test' }),
    ).rejects.toMatchObject({ statusCode: 400 })
  })

  it('rejects when project path is invalid', async () => {
    vi.mocked(repo.findById).mockResolvedValueOnce({ ...mockProject, path: '/etc' })
    await expect(
      manager.start({ conversationId: 'conv-4', projectId: 'proj-1', prompt: 'test' }),
    ).rejects.toMatchObject({ statusCode: 400 })
  })

  it('stops an active run', async () => {
    await manager.start({ conversationId: 'conv-1', projectId: 'proj-1', prompt: 'test' })
    const stopSpy = vi.spyOn(devin, 'stop').mockImplementation(() => {})
    const run = await manager.stop('conv-1')
    expect(run?.status).toBe('stopped')
    expect(manager.isConversationActive('conv-1')).toBe(false)
    expect(stopSpy).toHaveBeenCalled()
  })

  it('returns null when stopping a non-existent run', async () => {
    const run = await manager.stop('nonexistent')
    expect(run).toBeNull()
  })

  it('lists active runs', async () => {
    await manager.start({ conversationId: 'conv-1', projectId: 'proj-1', prompt: 'test' })
    const active = manager.listActiveRuns()
    expect(active).toHaveLength(1)
    expect(active[0].conversationId).toBe('conv-1')
  })

  it('returns status for a conversation', async () => {
    await manager.start({ conversationId: 'conv-1', projectId: 'proj-1', prompt: 'test' })
    const status = manager.getStatus('conv-1')
    expect(status?.conversationId).toBe('conv-1')
    expect(status?.status).toBe('running')
  })

  it('returns null status for unknown conversation', () => {
    expect(manager.getStatus('nonexistent')).toBeNull()
  })

  it('extracts conversation ID from session name', async () => {
    await manager.start({ conversationId: 'conv-1', projectId: 'proj-1', prompt: 'test' })
    const run = manager.getStatus('conv-1')
    expect(run?.sessionName).toContain('conv-1')
  })

  it('does not register a watcher until the transaction commits', () => {
    vi.useFakeTimers()
    try {
      const setIntervalSpy = vi.spyOn(globalThis, 'setInterval')
      const prepared = manager.prepareRun({
        conversationId: 'conv-1',
        projectSlug: mockProject.slug,
        cwd: mockProject.path,
        prompt: 'prepare this run',
      })

      expect(manager.getStatus('conv-1')).toBeNull()
      expect(manager.isConversationActive('conv-1')).toBe(false)
      expect(setIntervalSpy).not.toHaveBeenCalled()

      const run = prepared.commit()
      expect(run.status).toBe('running')
      expect(manager.getStatus('conv-1')).toBe(run)
      expect(manager.isConversationActive('conv-1')).toBe(true)
      expect(setIntervalSpy).toHaveBeenCalledOnce()

      prepared.commit()
      expect(setIntervalSpy).toHaveBeenCalledOnce()
    } finally {
      vi.useRealTimers()
    }
  })

  it('rollback kills the prepared tmux session and clears pending state', () => {
    const forceKillSpy = vi.spyOn(devin, 'forceKill').mockImplementation(() => {})
    const prepared = manager.prepareRun({
      conversationId: 'conv-1',
      projectSlug: mockProject.slug,
      cwd: mockProject.path,
      prompt: 'roll this back',
    })

    prepared.rollback()

    expect(forceKillSpy).toHaveBeenCalledWith('jheckbot-test-project-conv-1')
    expect(manager.getStatus('conv-1')).toBeNull()
    expect(manager.isConversationActive('conv-1')).toBe(false)
  })

  it('persists one assistant message and terminal event when a run completes', async () => {
    vi.useFakeTimers()
    try {
      let alive = true
      vi.mocked(devin.isRunning).mockImplementation(() => alive)
      vi.mocked(devin.captureOutput).mockReturnValue(['Devin CLI', 'Inspecting package.json...'])

      await manager.start({ conversationId: 'conv-1', projectId: 'proj-1', prompt: 'complete this' })
      await vi.advanceTimersByTimeAsync(100)

      alive = false
      await vi.advanceTimersByTimeAsync(100)

      expect(messageRepo.create).toHaveBeenCalledOnce()
      expect(messageRepo.create).toHaveBeenCalledWith({
        conversationId: 'conv-1',
        role: 'assistant',
        content: 'Inspecting package.json...',
        messageType: 'output',
        model: 'glm-5-2',
      })
      expect(eventRepo.create).toHaveBeenCalledWith(expect.objectContaining({
        conversationId: 'conv-1',
        eventType: 'status',
        content: JSON.stringify({ status: 'completed' }),
      }))
      expect(manager.getStatus('conv-1')?.status).toBe('completed')
      expect(manager.isConversationActive('conv-1')).toBe(false)
      expect(conversationRepo.updateAgentStatus).toHaveBeenLastCalledWith('conv-1', 'idle')
    } finally {
      vi.useRealTimers()
    }
  })

  it('persists a visible error and releases the lock after failure', async () => {
    vi.useFakeTimers()
    try {
      let alive = true
      vi.mocked(devin.isRunning).mockImplementation(() => alive)
      vi.mocked(devin.getExitCode).mockReturnValue(1)
      vi.mocked(devin.captureOutput).mockReturnValue([])

      await manager.start({ conversationId: 'conv-1', projectId: 'proj-1', prompt: 'fail this' })
      alive = false
      await vi.advanceTimersByTimeAsync(100)

      expect(manager.getStatus('conv-1')?.status).toBe('failed')
      expect(manager.isConversationActive('conv-1')).toBe(false)
      expect(messageRepo.create).toHaveBeenCalledWith({
        conversationId: 'conv-1',
        role: 'system',
        content: 'Devin exited with code 1',
        messageType: 'error',
      })
      expect(eventRepo.create).toHaveBeenCalledWith(expect.objectContaining({
        eventType: 'status',
        content: JSON.stringify({ status: 'failed', error: 'Devin exited with code 1' }),
      }))
    } finally {
      vi.useRealTimers()
    }
  })

  it('flushes output as soon as it reaches the byte threshold', async () => {
    vi.useFakeTimers()
    try {
      // A payload larger than the 512-byte flush threshold should flush on the first tick.
      vi.mocked(devin.captureOutput).mockReturnValue(['x'.repeat(600)])

      await manager.start({ conversationId: 'conv-1', projectId: 'proj-1', prompt: 'flush this' })
      await vi.advanceTimersByTimeAsync(100)

      // Both an output event and a log event are flushed on each capture
      const calls = vi.mocked(eventRepo.create).mock.calls
      const outputCall = calls.find((c) => c[0].eventType === 'output')
      expect(outputCall).toBeDefined()
      expect(outputCall![0]).toMatchObject({
        eventType: 'output',
        content: JSON.stringify({ content: 'x'.repeat(600) }),
      })
    } finally {
      vi.useRealTimers()
    }
  })

  it('recovers a matching active tmux session and starts one watcher', async () => {
    vi.useFakeTimers()
    try {
      const activeConversation = {
        ...({
          id: 'conv-1',
          project_id: 'proj-1',
          title: 'Active conversation',
          status: 'active',
          agent_type: 'devin',
          agent_session_id: 'devin-session-1',
          agent_status: 'running',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          last_message_at: null,
        } satisfies ConversationRecord),
      }
      vi.mocked(conversationRepo.findActive).mockResolvedValue([activeConversation])
      vi.mocked(devin.listSessions).mockReturnValue([
        {
          name: 'jheckbot-test-project-conv-1',
          pid: 123,
          created: '1700000000',
          attached: false,
        },
        {
          name: 'jheckbot-test-project-conv-1-not-the-conversation',
          pid: 456,
          created: '1700000001',
          attached: false,
        },
      ])

      await manager.recoverSessions()

      const run = manager.getStatus('conv-1')
      expect(run?.status).toBe('running')
      expect(run?.sessionName).toBe('jheckbot-test-project-conv-1')
      expect(run?.devinSessionId).toBe('devin-session-1')
      expect(manager.isConversationActive('conv-1')).toBe(true)
      expect(vi.getTimerCount()).toBe(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('reconciles an active conversation with no exact tmux session', async () => {
    const activeConversation = {
      ...({
        id: 'conv-1',
        project_id: 'proj-1',
        title: 'Stale conversation',
        status: 'active',
        agent_type: 'devin',
        agent_session_id: null,
        agent_status: 'running',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        last_message_at: null,
      } satisfies ConversationRecord),
    }
    vi.mocked(conversationRepo.findActive).mockResolvedValue([activeConversation])
    vi.mocked(devin.listSessions).mockReturnValue([
      {
        name: 'jheckbot-test-project-conv-1-with-suffix',
        pid: 123,
        created: '1700000000',
        attached: false,
      },
    ])

    await manager.recoverSessions()

    expect(manager.getStatus('conv-1')).toBeNull()
    expect(manager.isConversationActive('conv-1')).toBe(false)
    expect(messageRepo.create).toHaveBeenCalledWith(expect.objectContaining({
      conversationId: 'conv-1',
      role: 'system',
      messageType: 'error',
    }))
    expect(eventRepo.create).toHaveBeenCalledWith(expect.objectContaining({
      conversationId: 'conv-1',
      eventType: 'status',
      content: expect.stringContaining('"status":"failed"'),
    }))
    expect(conversationRepo.updateAgentStatus).toHaveBeenCalledWith('conv-1', 'idle')
  })

  it('flushes small output within the real-time window after the run starts', async () => {
    vi.useFakeTimers()
    try {
      vi.mocked(devin.captureOutput).mockReturnValue(['small output'])
      await manager.start({ conversationId: 'conv-1', projectId: 'proj-1', prompt: 'stream this' })

      // Advance one watcher tick; with a 100 ms flush window the pending
      // output should be persisted and published to subscribers.
      await vi.advanceTimersByTimeAsync(100)

      expect(eventRepo.create).toHaveBeenCalledWith(expect.objectContaining({
        conversationId: 'conv-1',
        eventType: 'output',
        content: expect.stringContaining('small output'),
      }))
    } finally {
      vi.useRealTimers()
    }
  })

  it('publishes persisted output and terminal events to subscribers once', async () => {
    vi.useFakeTimers()
    try {
      let alive = true
      const received: AgentEventRecord[] = []
      vi.mocked(devin.isRunning).mockImplementation(() => alive)
      vi.mocked(devin.captureOutput).mockReturnValue(['Useful output'])
      manager.subscribe('conv-1', (event) => received.push(event))

      await manager.start({ conversationId: 'conv-1', projectId: 'proj-1', prompt: 'stream this' })
      await vi.advanceTimersByTimeAsync(100)
      alive = false
      await vi.advanceTimersByTimeAsync(100)

      // output + log (during run) + log (final flush) + status (terminal)
      const types = received.map((event) => event.event_type)
      expect(types).toContain('output')
      expect(types).toContain('status')
      expect(types.filter((t) => t === 'status')).toHaveLength(1)
      expect(types.filter((t) => t === 'output')).toHaveLength(1)
    } finally {
      vi.useRealTimers()
    }
  })

  // Regression: a --resume that fails because the target Devin session is
  // locked by another process ("failed to start ACP agent session") must
  // clear the stale session ID and retry once as a fresh (non-resume) run.
  it('retries without --resume when a session-locked error is detected', async () => {
    vi.useFakeTimers()
    try {
      // Conversation has a prior session ID so start() passes --resume
      vi.mocked(conversationRepo.findById).mockResolvedValue({
        id: 'conv-1',
        project_id: 'proj-1',
        title: 'Test',
        status: 'active',
        agent_type: 'devin',
        agent_session_id: 'locked-session',
        agent_status: 'idle',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        last_message_at: null,
      })

      let alive = true
      let startCallCount = 0
      vi.mocked(devin.isRunning).mockImplementation(() => alive)
      vi.mocked(devin.getExitCode).mockReturnValue(1)
      vi.mocked(devin.captureOutput).mockReturnValue(['Error: failed to start ACP agent session'])
      vi.mocked(devin.start).mockImplementation(() => {
        startCallCount++
        // First call (resume) fails immediately; second call (retry) stays alive
        alive = startCallCount === 1 ? false : true
        return {
          sessionName: 'jheckbot-test-project-conv-1',
          devinSessionId: startCallCount === 1 ? 'locked-session' : undefined,
          status: 'starting',
          startedAt: new Date().toISOString(),
        }
      })

      await manager.start({ conversationId: 'conv-1', projectId: 'proj-1', prompt: 'retry me' })

      // First watcher tick: process is dead, output contains session-locked error
      await vi.advanceTimersByTimeAsync(100)

      // Should have retried: start called twice, second time without resumeSessionId
      expect(startCallCount).toBe(2)
      const secondCall = vi.mocked(devin.start).mock.calls[1][0]
      expect(secondCall.resumeSessionId).toBeUndefined()

      // Stale session ID should be cleared
      expect(conversationRepo.clearAgentSessionId).toHaveBeenCalledWith('conv-1')

      // Run should still be active (retry is running)
      expect(manager.isConversationActive('conv-1')).toBe(true)
      expect(manager.getStatus('conv-1')?.status).toBe('running')
    } finally {
      vi.useRealTimers()
    }
  })

  it('does not retry when the failure is not a session-locked error', async () => {
    vi.useFakeTimers()
    try {
      vi.mocked(conversationRepo.findById).mockResolvedValue({
        id: 'conv-1',
        project_id: 'proj-1',
        title: 'Test',
        status: 'active',
        agent_type: 'devin',
        agent_session_id: 'prior-session',
        agent_status: 'idle',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        last_message_at: null,
      })

      let alive = true
      vi.mocked(devin.isRunning).mockImplementation(() => alive)
      vi.mocked(devin.getExitCode).mockReturnValue(1)
      // Generic error, not session-locked
      vi.mocked(devin.captureOutput).mockReturnValue(['Error: model server unreachable'])
      vi.mocked(devin.start).mockImplementation(() => {
        alive = false
        return {
          sessionName: 'jheckbot-test-project-conv-1',
          devinSessionId: 'prior-session',
          status: 'starting',
          startedAt: new Date().toISOString(),
        }
      })

      await manager.start({ conversationId: 'conv-1', projectId: 'proj-1', prompt: 'fail me' })
      await vi.advanceTimersByTimeAsync(100)

      // Should NOT retry — only one start call
      expect(devin.start).toHaveBeenCalledOnce()
      expect(manager.getStatus('conv-1')?.status).toBe('failed')
    } finally {
      vi.useRealTimers()
    }
  })

  it('does not retry a second time after a session-locked retry', async () => {
    vi.useFakeTimers()
    try {
      vi.mocked(conversationRepo.findById).mockResolvedValue({
        id: 'conv-1',
        project_id: 'proj-1',
        title: 'Test',
        status: 'active',
        agent_type: 'devin',
        agent_session_id: 'locked-session',
        agent_status: 'idle',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        last_message_at: null,
      })

      let startCallCount = 0
      vi.mocked(devin.isRunning).mockImplementation(() => false)
      vi.mocked(devin.getExitCode).mockReturnValue(1)
      vi.mocked(devin.captureOutput).mockReturnValue(['Error: failed to start ACP agent session'])
      vi.mocked(devin.start).mockImplementation(() => {
        startCallCount++
        return {
          sessionName: 'jheckbot-test-project-conv-1',
          devinSessionId: startCallCount === 1 ? 'locked-session' : undefined,
          status: 'starting',
          startedAt: new Date().toISOString(),
        }
      })

      await manager.start({ conversationId: 'conv-1', projectId: 'proj-1', prompt: 'retry twice' })
      // First tick: retry triggered
      await vi.advanceTimersByTimeAsync(100)
      // Second tick: retry also fails, but should NOT retry again
      await vi.advanceTimersByTimeAsync(100)

      expect(startCallCount).toBe(2)
      expect(manager.getStatus('conv-1')?.status).toBe('failed')
    } finally {
      vi.useRealTimers()
    }
  })

  // Regression: discoverSessionId returns a per-directory session ID that may
  // belong to another conversation. The manager must not persist it if another
  // conversation already claims it.
  it('does not persist a discovered session ID claimed by another conversation', async () => {
    vi.useFakeTimers()
    try {
      let alive = true
      vi.mocked(devin.isRunning).mockImplementation(() => alive)
      vi.mocked(devin.captureOutput).mockReturnValue(['Task complete'])
      vi.mocked(devin.getExitCode).mockReturnValue(0)
      // Scraping fails (as in --print mode); discovery returns a shared ID
      vi.mocked(devin.getDevinSessionId).mockReturnValue(undefined)
      vi.mocked(devin.getLatestSessionId).mockReturnValue('shared-session')
      // Another conversation already has this session ID
      vi.mocked(conversationRepo.findByAgentSessionId).mockResolvedValue([
        {
          id: 'other-conv',
          project_id: 'proj-1',
          title: 'Other',
          status: 'active',
          agent_type: 'devin',
          agent_session_id: 'shared-session',
          agent_status: 'idle',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          last_message_at: null,
        },
      ])

      await manager.start({ conversationId: 'conv-1', projectId: 'proj-1', prompt: 'discover me' })
      alive = false
      await vi.advanceTimersByTimeAsync(100)

      // The shared session ID must NOT be persisted to this conversation
      expect(conversationRepo.updateAgentSessionId).not.toHaveBeenCalledWith(
        'conv-1',
        'shared-session',
      )
    } finally {
      vi.useRealTimers()
    }
  })

  it('persists a discovered session ID when no other conversation claims it', async () => {
    vi.useFakeTimers()
    try {
      let alive = true
      vi.mocked(devin.isRunning).mockImplementation(() => alive)
      vi.mocked(devin.captureOutput).mockReturnValue(['Task complete'])
      vi.mocked(devin.getExitCode).mockReturnValue(0)
      vi.mocked(devin.getDevinSessionId).mockReturnValue(undefined)
      vi.mocked(devin.getLatestSessionId).mockReturnValue('unique-session')
      // No other conversation has this session ID
      vi.mocked(conversationRepo.findByAgentSessionId).mockResolvedValue([])

      await manager.start({ conversationId: 'conv-1', projectId: 'proj-1', prompt: 'discover me' })
      alive = false
      await vi.advanceTimersByTimeAsync(100)

      expect(conversationRepo.updateAgentSessionId).toHaveBeenCalledWith('conv-1', 'unique-session')
    } finally {
      vi.useRealTimers()
    }
  })

  // Regression: media files from a previous run (e.g. capture.mp4) were being
  // re-detected and re-shown in every subsequent response.
  it('seeds known media at run start so old captures are not re-shown', async () => {
    const mediaDir = join(TMP, 'media-seed')
    const mediaService = new MediaService(mediaDir)
    manager.mediaService = mediaService

    const convDir = mediaService.ensureConversationDir('conv-1')
    const oldPath = join(convDir, 'capture.mp4')
    writeFileSync(oldPath, Buffer.from([0x00, 0x00, 0x00, 0x18]))
    const oldTime = new Date(Date.now() - 1000)
    utimesSync(oldPath, oldTime, oldTime)

    vi.useFakeTimers()
    try {
      let alive = true
      vi.mocked(devin.isRunning).mockImplementation(() => alive)
      vi.mocked(devin.captureOutput).mockReturnValue(['Working'])

      await manager.start({ conversationId: 'conv-1', projectId: 'proj-1', prompt: 'text question' })
      await vi.advanceTimersByTimeAsync(100)

      // No media event should be emitted for the stale capture.mp4
      const mediaEvents = vi.mocked(eventRepo.create).mock.calls
        .filter((call) => call[0].eventType === 'media')
      expect(mediaEvents).toHaveLength(0)
    } finally {
      vi.useRealTimers()
    }
  })

  // Regression: when the agent overwrote capture.mp4 with a new video, the
  // previous mtime/size was not detected, so the old video kept showing.
  it('detects overwritten media and updates the rendered URL', async () => {
    const mediaDir = join(TMP, 'media-overwrite')
    const mediaService = new MediaService(mediaDir)
    manager.mediaService = mediaService

    const received: AgentEventRecord[] = []
    manager.subscribe('conv-1', (event) => received.push(event))

    vi.useFakeTimers()
    try {
      let alive = true
      vi.mocked(devin.isRunning).mockImplementation(() => alive)
      vi.mocked(devin.captureOutput).mockReturnValue(['First video done'])

      await manager.start({ conversationId: 'conv-1', projectId: 'proj-1', prompt: 'record a video' })

      // Write the first version after the run has started (so it is not seeded
      // as already-known) and then let the watcher see it after it stabilizes.
      const convDir = mediaService.ensureConversationDir('conv-1')
      const path = join(convDir, 'capture.mp4')
      writeFileSync(path, Buffer.from([0x00, 0x00, 0x00, 0x18]))
      await vi.advanceTimersByTimeAsync(1000)

      // First version is detected
      const firstMedia = received.filter((e) => e.event_type === 'media')
      expect(firstMedia).toHaveLength(1)
      const firstUrl = firstMedia[0].content ? JSON.parse(firstMedia[0].content).url : ''
      expect(firstUrl).toContain('capture.mp4')

      // Simulate the agent overwriting capture.mp4 with new content
      writeFileSync(path, Buffer.from([0x00, 0x00, 0x00, 0x20]))
      vi.mocked(devin.captureOutput).mockReturnValue(['Second video done'])
      await vi.advanceTimersByTimeAsync(1000)

      // Overwrite is detected and a new URL (different cache-bust) is emitted
      const mediaEvents = received.filter((e) => e.event_type === 'media')
      expect(mediaEvents.length).toBeGreaterThanOrEqual(2)
      const latest = mediaEvents[mediaEvents.length - 1]
      const latestUrl = latest.content ? JSON.parse(latest.content).url : ''
      expect(latestUrl).not.toBe(firstUrl)
      expect(latestUrl).toContain('capture.mp4')
    } finally {
      vi.useRealTimers()
    }
  })

  // Regression: text follow-ups were replaying the previous prompt's video.
  it('clears media markdown on sendPrompt', async () => {
    vi.useFakeTimers()
    try {
      vi.mocked(devin.isRunning).mockReturnValue(true)
      vi.spyOn(devin, 'sendPrompt').mockImplementation(() => {})
      await manager.start({ conversationId: 'conv-1', projectId: 'proj-1', prompt: 'record a video' })

      const run = manager.getStatus('conv-1')
      expect(run).not.toBeNull()

      // Manually put a stale media entry in the map to simulate a prior capture
      const state = (manager as unknown as { runs: Map<string, { mediaMarkdown: Map<string, string> }> }).runs.get('conv-1')!
      state.mediaMarkdown.set('capture.mp4', '![media](/api/conversations/conv-1/media/capture.mp4)')
      expect(state.mediaMarkdown.size).toBe(1)

      manager.sendPrompt('conv-1', 'explain this code')
      expect(state.mediaMarkdown.size).toBe(0)
    } finally {
      vi.useRealTimers()
    }
  })
})
