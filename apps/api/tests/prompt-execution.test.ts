import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { PromptExecutionService, PromptExecutionError } from '../src/services/PromptExecutionService.js'
import { AgentManager, type AgentRun } from '../src/agent/AgentManager.js'
import { ConversationRepository, type ConversationRecord } from '../src/repositories/ConversationRepository.js'
import { ProjectRepository, type ProjectRecord } from '../src/repositories/ProjectRepository.js'
import { MessageRepository, type MessageRecord } from '../src/repositories/MessageRepository.js'
import { AgentEventRepository, type AgentEventRecord } from '../src/repositories/AgentEventRepository.js'
import { pool } from '../src/db/pool.js'
import { PathValidator, type AllowedRoot } from '../src/services/PathValidator.js'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { mkdirSync, rmSync } from 'node:fs'
import type { PoolClient } from 'pg'

const TMP = join(tmpdir(), 'jheckbot-prompt-exec-test')

function mockClient(): PoolClient {
  return {
    query: vi.fn().mockResolvedValue({ rows: [] }),
    release: vi.fn(),
  } as unknown as PoolClient
}

describe('PromptExecutionService', () => {
  let agentManager: AgentManager
  let conversationRepo: ConversationRepository
  let projectRepo: ProjectRepository
  let messageRepo: MessageRepository
  let eventRepo: AgentEventRepository
  let service: PromptExecutionService
  let mockConversation: ConversationRecord
  let mockProject: ProjectRecord
  let mockMessage: MessageRecord
  let preparedRollback: ReturnType<typeof vi.fn>
  let preparedCommit: ReturnType<typeof vi.fn>
  let client: PoolClient

  beforeEach(() => {
    client = mockClient()
    vi.spyOn(pool, 'connect').mockResolvedValue(client as never)

    mkdirSync(join(TMP, 'test-project'), { recursive: true })
    mkdirSync(join(TMP, 'test-project', '.git'), { recursive: true })

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

    mockConversation = {
      id: 'conv-1',
      project_id: 'proj-1',
      title: 'New Conversation',
      status: 'active',
      agent_type: 'devin',
      agent_session_id: null,
      agent_status: 'idle',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_message_at: null,
    }

    mockMessage = {
      id: 'msg-1',
      conversation_id: 'conv-1',
      role: 'user',
      content: 'Fix the tests',
      message_type: 'prompt',
      model: null,
      created_at: new Date().toISOString(),
    }

    preparedRollback = vi.fn()
    preparedCommit = vi.fn().mockReturnValue({
      conversationId: 'conv-1',
      projectSlug: 'test-project',
      sessionName: 'jheckbot-test-project-conv-1',
      cwd: '/tmp/test-project',
      status: 'running',
      startedAt: new Date().toISOString(),
      outputBuffer: '',
      normalizedSnapshot: [],
    } satisfies AgentRun)

    conversationRepo = {
      findByIdForUpdate: vi.fn().mockResolvedValue(mockConversation),
      findById: vi.fn().mockResolvedValue(mockConversation),
      setAgentStatus: vi.fn().mockResolvedValue(undefined),
      updateAgentStatus: vi.fn().mockResolvedValue(undefined),
      touchLastMessage: vi.fn().mockResolvedValue(undefined),
      update: vi.fn().mockResolvedValue(mockConversation),
      countActiveAgents: vi.fn().mockResolvedValue(0),
    } as unknown as ConversationRepository

    projectRepo = {
      findById: vi.fn().mockResolvedValue(mockProject),
      findAllowedRoots: vi.fn().mockResolvedValue<AllowedRoot[]>([
        { id: 'root-1', name: 'TestRoot', path: TMP, enabled: true },
      ]),
    } as unknown as ProjectRepository

    messageRepo = {
      create: vi.fn().mockResolvedValue(mockMessage),
    } as unknown as MessageRepository

    eventRepo = {
      create: vi.fn().mockResolvedValue({
        id: 'event-1',
        conversation_id: 'conv-1',
        event_type: 'status',
        content: JSON.stringify({ status: 'starting' }),
        event_sequence: '1',
        created_at: new Date().toISOString(),
      } satisfies AgentEventRecord),
    } as unknown as AgentEventRepository

    agentManager = {
      prepareRun: vi.fn().mockReturnValue({
        commit: preparedCommit,
        rollback: preparedRollback,
      }),
      isConversationActive: vi.fn().mockReturnValue(false),
      reconcileStaleLock: vi.fn().mockResolvedValue(undefined),
    } as unknown as AgentManager

    service = new PromptExecutionService(
      agentManager,
      conversationRepo,
      projectRepo,
      messageRepo,
      eventRepo,
      (roots: AllowedRoot[]) => new PathValidator(roots),
    )
  })

  afterEach(() => {
    vi.restoreAllMocks()
    rmSync(TMP, { recursive: true, force: true })
  })

  it('persists one prompt and starts one run in the same accepted command', async () => {
    const result = await service.send({ conversationId: 'conv-1', prompt: 'Fix the tests' })

    expect(result.message).toEqual(mockMessage)
    expect(result.run.status).toBe('running')
    // Advisory lock acquired inside the transaction
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('pg_advisory_xact_lock'),
      expect.any(Array),
    )
    // Conversation row locked
    expect(conversationRepo.findByIdForUpdate).toHaveBeenCalledWith('conv-1', client)
    // Project validated
    expect(projectRepo.findById).toHaveBeenCalledWith('proj-1')
    // User message persisted with message_type='prompt'
    expect(messageRepo.create).toHaveBeenCalledWith({
      conversationId: 'conv-1',
      role: 'user',
      content: 'Fix the tests',
      messageType: 'prompt',
    }, client)
    // Conversation marked starting
    expect(conversationRepo.setAgentStatus).toHaveBeenCalledWith('conv-1', 'starting', client)
    // Agent prepared
    expect(agentManager.prepareRun).toHaveBeenCalledWith(expect.objectContaining({
      conversationId: 'conv-1',
      projectSlug: 'test-project',
      prompt: 'Fix the tests',
      userMessageId: 'msg-1',
    }))
    // Initial status event persisted
    expect(eventRepo.create).toHaveBeenCalledWith(expect.objectContaining({
      conversationId: 'conv-1',
      eventType: 'status',
    }), client)
    // Prepared run committed after transaction
    expect(preparedCommit).toHaveBeenCalledOnce()
    expect(preparedRollback).not.toHaveBeenCalled()
  })

  it('rolls back the prompt and calls prepared.rollback when tmux startup fails', async () => {
    vi.mocked(agentManager.prepareRun).mockImplementation(() => {
      throw new Error('tmux failed to start')
    })

    await expect(
      service.send({ conversationId: 'conv-1', prompt: 'Fix the tests' }),
    ).rejects.toThrow('tmux failed to start')

    // prepareRun threw before returning a prepared run, so rollback is not called
    expect(preparedRollback).not.toHaveBeenCalled()
    expect(preparedCommit).not.toHaveBeenCalled()
  })

  it('returns 409 for a live active conversation before creating a process', async () => {
    vi.mocked(agentManager.isConversationActive).mockReturnValue(true)

    await expect(
      service.send({ conversationId: 'conv-1', prompt: 'Fix the tests' }),
    ).rejects.toMatchObject({ statusCode: 409 })

    expect(agentManager.prepareRun).not.toHaveBeenCalled()
    expect(messageRepo.create).not.toHaveBeenCalled()
  })

  it('rejects a conversation/project mismatch before process creation', async () => {
    vi.mocked(projectRepo.findById).mockResolvedValue(null)

    await expect(
      service.send({ conversationId: 'conv-1', prompt: 'Fix the tests' }),
    ).rejects.toMatchObject({ statusCode: 404 })

    expect(agentManager.prepareRun).not.toHaveBeenCalled()
  })

  it('returns 429 when the global active run count is three', async () => {
    vi.mocked(conversationRepo.countActiveAgents).mockResolvedValue(3)

    await expect(
      service.send({ conversationId: 'conv-1', prompt: 'Fix the tests' }),
    ).rejects.toMatchObject({ statusCode: 429 })

    expect(agentManager.prepareRun).not.toHaveBeenCalled()
    expect(messageRepo.create).not.toHaveBeenCalled()
  })

  it('rejects empty prompt content', async () => {
    await expect(
      service.send({ conversationId: 'conv-1', prompt: '' }),
    ).rejects.toMatchObject({ statusCode: 400 })
  })

  it('rejects oversized prompt content over 32KB', async () => {
    await expect(
      service.send({ conversationId: 'conv-1', prompt: 'x'.repeat(33 * 1024) }),
    ).rejects.toMatchObject({ statusCode: 400 })
  })

  it('calls prepared.rollback and rethrows when the initial event write fails', async () => {
    vi.mocked(eventRepo.create).mockRejectedValue(new Error('event write failed'))

    await expect(
      service.send({ conversationId: 'conv-1', prompt: 'Fix the tests' }),
    ).rejects.toThrow('event write failed')

    expect(preparedRollback).toHaveBeenCalledOnce()
    expect(preparedCommit).not.toHaveBeenCalled()
  })

  it('auto-generates title from the prompt when title is still default', async () => {
    await service.send({ conversationId: 'conv-1', prompt: 'Fix the failing tests' })

    expect(conversationRepo.update).toHaveBeenCalledWith(
      'conv-1',
      { title: 'Fix the failing tests' },
      client,
    )
  })

  it('does not overwrite a custom title', async () => {
    mockConversation.title = 'My Custom Title'
    vi.mocked(conversationRepo.findByIdForUpdate).mockResolvedValue(mockConversation)

    await service.send({ conversationId: 'conv-1', prompt: 'Fix the tests' })

    expect(conversationRepo.update).not.toHaveBeenCalledWith(
      'conv-1',
      expect.objectContaining({ title: expect.any(String) }),
      expect.anything(),
    )
  })

  it('truncates long prompts when generating a title', async () => {
    const longPrompt = 'x'.repeat(100)
    await service.send({ conversationId: 'conv-1', prompt: longPrompt })

    expect(conversationRepo.update).toHaveBeenCalledWith(
      'conv-1',
      { title: 'x'.repeat(57) + '...' },
      client,
    )
  })
})
