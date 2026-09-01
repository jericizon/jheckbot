import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { OfficeAgent, OfficeTask } from '@jheckbot/shared'
import type { AgentStreamEvent } from '../src/agent/AgentManager.js'
import type { ConversationRecord } from '../src/repositories/ConversationRepository.js'
import type { PromptSendResult } from '../src/services/PromptExecutionService.js'
import {
  OfficeTaskExecutionService,
  OfficeTaskExecutionError,
} from '../src/services/orchestration/OfficeTaskExecutionService.js'

const now = new Date().toISOString()
const taskId = '22222222-2222-2222-2222-222222222222'
const officeId = '996c3a36-9ded-44c8-a47e-d87d8f6d006a'
const projectId = '11111111-1111-1111-1111-111111111111'
const agentId = '33333333-3333-3333-3333-333333333333'
const conversationId = '44444444-4444-4444-4444-444444444444'

function makeTask(overrides: Partial<OfficeTask> = {}): OfficeTask {
  return {
    id: taskId,
    officeId,
    projectId,
    title: 'Implement backend feature',
    status: 'backlog',
    priority: 'medium',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

function makeAgent(overrides: Partial<OfficeAgent> = {}): OfficeAgent {
  return {
    id: agentId,
    officeId,
    name: 'Support',
    role: 'Support',
    status: 'working',
    enabled: true,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

function makeConversation(overrides: Partial<ConversationRecord> = {}): ConversationRecord {
  return {
    id: conversationId,
    project_id: projectId,
    title: 'CEO task: Implement backend feature',
    status: 'active',
    agent_type: 'devin',
    provider_config: null,
    agent_session_id: null,
    agent_status: 'idle',
    is_pinned: false,
    created_at: now,
    updated_at: now,
    last_message_at: null,
    ...overrides,
  }
}

function makeAgentEvent(status: string, error?: string): AgentStreamEvent {
  return {
    id: 'event-1',
    conversation_id: conversationId,
    event_type: 'status',
    content: JSON.stringify(error ? { status, error } : { status }),
    event_sequence: '1',
    created_at: now,
  }
}

describe('OfficeTaskExecutionService', () => {
  let deps: Parameters<typeof OfficeTaskExecutionService.prototype.start>[0] extends never
    ? ReturnType<typeof OfficeTaskExecutionService>['deps']
    : never
  let service: OfficeTaskExecutionService
  let capturedListener: ((event: AgentStreamEvent) => void) | undefined

  beforeEach(() => {
    capturedListener = undefined

    const taskService = {
      getById: vi.fn().mockResolvedValue(makeTask()),
      setStatus: vi.fn().mockImplementation((id: string, status: string) => {
        return Promise.resolve(makeTask({ status: status as OfficeTask['status'] }))
      }),
      failExecution: vi.fn().mockImplementation((id: string, error?: string) => {
        return Promise.resolve(makeTask({ status: 'failed' }))
      }),
      completeExecution: vi.fn().mockResolvedValue(makeTask({ status: 'completed' })),
      linkExecutionConversation: vi.fn().mockResolvedValue(makeTask({ executionConversationId: conversationId })),
    }

    const taskDispatcher = {
      dispatch: vi.fn().mockResolvedValue({
        task: makeTask({ status: 'assigned', assignedAgentId: agentId }),
        agent: makeAgent(),
      }),
    }

    const conversationService = {
      create: vi.fn().mockResolvedValue(makeConversation()),
      get: vi.fn().mockResolvedValue(makeConversation()),
    }

    const promptExecutionService = {
      send: vi.fn().mockResolvedValue({
        message: { id: 'msg-1' },
        run: { status: 'starting' },
      } as unknown as PromptSendResult),
    }

    const agentManager = {
      subscribe: vi.fn().mockImplementation((conversationId: string, listener: (event: AgentStreamEvent) => void) => {
        capturedListener = listener
        return () => {}
      }),
    }

    const agentService = {
      update: vi.fn().mockImplementation((id: string, input: Partial<OfficeAgent>) => {
        return Promise.resolve(makeAgent(input))
      }),
    }

    const eventService = {
      create: vi.fn().mockResolvedValue({
        id: 'event-1',
        officeId,
        eventType: 'AGENT_STARTED',
        createdAt: now,
      }),
    }

    deps = {
      taskService,
      taskDispatcher,
      conversationService,
      promptExecutionService,
      agentManager,
      agentService,
      eventService,
    } as never

    service = new OfficeTaskExecutionService(deps as never)
  })

  it('starts a task and returns a started summary', async () => {
    const result = await service.start(taskId)

    expect(result.status).toBe('started')
    expect(result.taskId).toBe(taskId)
    expect(result.conversationId).toBe(conversationId)
    expect(result.agentId).toBe(agentId)
    expect(deps.taskService.setStatus).toHaveBeenCalledWith(taskId, 'ready')
    expect(deps.taskService.setStatus).toHaveBeenCalledWith(taskId, 'working')
    expect(deps.conversationService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId,
        title: 'CEO task: Implement backend feature',
        agentType: 'devin',
      }),
    )
    expect(deps.taskService.linkExecutionConversation).toHaveBeenCalledWith(taskId, conversationId)
    expect(deps.agentManager.subscribe).toHaveBeenCalledWith(conversationId, expect.any(Function))
    expect(deps.promptExecutionService.send).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId,
        prompt: expect.stringContaining('Title: Implement backend feature'),
      }),
    )
    expect(deps.eventService.create).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'AGENT_STARTED' }),
    )
  })

  it('subscribes to the agent manager before sending the prompt', async () => {
    const order: string[] = []
    deps.agentManager.subscribe = vi.fn().mockImplementation((id, listener) => {
      order.push('subscribe')
      capturedListener = listener
      return () => {}
    })
    deps.promptExecutionService.send = vi.fn().mockImplementation(async () => {
      order.push('send')
      return { message: { id: 'msg-1' }, run: { status: 'starting' } } as unknown as PromptSendResult
    })

    await service.start(taskId)

    expect(order).toEqual(['subscribe', 'send'])
  })

  it('returns an existing execution state when a conversation is already linked', async () => {
    deps.taskService.getById = vi.fn().mockResolvedValue(
      makeTask({ status: 'working', executionConversationId: conversationId }),
    )

    const result = await service.start(taskId)

    expect(result.status).toBe('started')
    expect(result.conversationId).toBe(conversationId)
    expect(deps.taskDispatcher.dispatch).not.toHaveBeenCalled()
    expect(deps.conversationService.create).not.toHaveBeenCalled()
  })

  it('rejects a missing task', async () => {
    deps.taskService.getById = vi.fn().mockResolvedValue(null)

    const result = await service.start(taskId)

    expect(result.status).toBe('failed')
    expect(result.error).toBe('task_not_found')
  })

  it('rejects a task without a project', async () => {
    deps.taskService.getById = vi.fn().mockResolvedValue(makeTask({ projectId: undefined }))

    const result = await service.start(taskId)

    expect(result.status).toBe('failed')
    expect(result.error).toBe('task_no_project')
  })

  it('rejects a terminal task', async () => {
    deps.taskService.getById = vi.fn().mockResolvedValue(makeTask({ status: 'completed' }))

    const result = await service.start(taskId)

    expect(result.status).toBe('failed')
    expect(result.error).toBe('task_already_terminal')
  })

  it('rejects a non-Devin agent provider', async () => {
    deps.taskDispatcher.dispatch = vi.fn().mockResolvedValue({
      task: makeTask({ status: 'assigned', assignedAgentId: agentId }),
      agent: makeAgent({ provider: 'openai' }),
    })

    const result = await service.start(taskId)

    expect(result.status).toBe('failed')
    expect(result.error).toBe('unsupported_agent_provider')
    expect(deps.taskService.failExecution).toHaveBeenCalledWith(taskId, 'unsupported_agent_provider')
    expect(deps.agentService.update).toHaveBeenCalledWith(agentId, { status: 'error' })
  })

  it('rejects a CEO execution assignment', async () => {
    deps.taskDispatcher.dispatch = vi.fn().mockResolvedValue({
      task: makeTask({ status: 'assigned', assignedAgentId: agentId }),
      agent: makeAgent({ role: 'CEO', name: 'CEO' }),
    })

    const result = await service.start(taskId)

    expect(result.status).toBe('failed')
    expect(result.error).toBe('ceo_cannot_execute')
    expect(deps.taskService.failExecution).toHaveBeenCalledWith(taskId, 'ceo_cannot_execute')
    expect(deps.agentService.update).toHaveBeenCalledWith(agentId, { status: 'error' })
  })

  it('marks the task failed and worker error on prompt startup failure', async () => {
    deps.promptExecutionService.send = vi.fn().mockRejectedValue(new Error('devin is not available'))

    const result = await service.start(taskId)

    expect(result.status).toBe('failed')
    expect(result.error).toBe('devin_start_failed')
    expect(deps.taskService.failExecution).toHaveBeenCalledWith(taskId, 'devin_start_failed')
    expect(deps.agentService.update).toHaveBeenCalledWith(agentId, { status: 'error' })
  })

  it('returns a safe failed result without leaking raw errors', async () => {
    deps.promptExecutionService.send = vi.fn().mockRejectedValue(new Error('tmux session leaked /home/jeric/.secret'))

    const result = await service.start(taskId)

    expect(result.status).toBe('failed')
    expect(result.error).toBe('devin_start_failed')
    expect(result.error).not.toContain('/home/jeric')
    expect(result.error).not.toContain('tmux')
  })

  it('handles a completed terminal event', async () => {
    await service.start(taskId)

    deps.taskService.getById.mockResolvedValueOnce(
      makeTask({
        status: 'working',
        assignedAgentId: agentId,
        executionConversationId: conversationId,
      }),
    )
    capturedListener?.(makeAgentEvent('completed'))

    await vi.waitFor(() => expect(deps.taskService.completeExecution).toHaveBeenCalledWith(taskId))
    await vi.waitFor(() => expect(deps.agentService.update).toHaveBeenCalledWith(agentId, { status: 'idle' }))
    await vi.waitFor(() =>
      expect(deps.eventService.create).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'AGENT_COMPLETED' }),
      ),
    )
  })

  it('handles a failed terminal event', async () => {
    await service.start(taskId)

    deps.taskService.getById.mockResolvedValueOnce(
      makeTask({
        status: 'working',
        assignedAgentId: agentId,
        executionConversationId: conversationId,
      }),
    )
    capturedListener?.(makeAgentEvent('failed', 'devin exited with code 1'))

    await vi.waitFor(() => expect(deps.taskService.failExecution).toHaveBeenCalledWith(taskId, 'failed'))
    await vi.waitFor(() => expect(deps.agentService.update).toHaveBeenCalledWith(agentId, { status: 'error' }))
    await vi.waitFor(() =>
      expect(deps.eventService.create).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'AGENT_FAILED' }),
      ),
    )
  })

  it('handles a stopped terminal event', async () => {
    await service.start(taskId)

    deps.taskService.getById.mockResolvedValueOnce(
      makeTask({
        status: 'working',
        assignedAgentId: agentId,
        executionConversationId: conversationId,
      }),
    )
    capturedListener?.(makeAgentEvent('stopped'))

    await vi.waitFor(() => expect(deps.taskService.failExecution).toHaveBeenCalledWith(taskId, 'stopped'))
    await vi.waitFor(() => expect(deps.agentService.update).toHaveBeenCalledWith(agentId, { status: 'idle' }))
    await vi.waitFor(() =>
      expect(deps.eventService.create).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'AGENT_FAILED' }),
      ),
    )
  })

  it('ignores duplicate terminal events', async () => {
    await service.start(taskId)

    deps.taskService.getById.mockResolvedValueOnce(
      makeTask({
        status: 'working',
        assignedAgentId: agentId,
        executionConversationId: conversationId,
      }),
    )
    capturedListener?.(makeAgentEvent('completed'))
    capturedListener?.(makeAgentEvent('completed'))

    await vi.waitFor(() => expect(deps.taskService.completeExecution).toHaveBeenCalledTimes(1))
  })

  it('ignores non-status and non-terminal agent events', async () => {
    await service.start(taskId)

    capturedListener?.({
      ...makeAgentEvent('starting'),
      content: JSON.stringify({ status: 'starting' }),
    } as AgentStreamEvent)
    capturedListener?.({
      ...makeAgentEvent('running'),
      event_type: 'output',
      content: 'some output',
    } as AgentStreamEvent)

    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(deps.taskService.completeExecution).not.toHaveBeenCalled()
    expect(deps.taskService.failExecution).not.toHaveBeenCalledWith(expect.anything(), expect.anything())
  })

  it('reports failure when conversation creation fails', async () => {
    deps.conversationService.create = vi.fn().mockRejectedValue(
      Object.assign(new Error('project is disabled'), { name: 'ConversationValidationError' }),
    )

    const result = await service.start(taskId)

    expect(result.status).toBe('failed')
    expect(result.error).toBe('conversation_create_failed')
    expect(deps.taskService.failExecution).toHaveBeenCalledWith(taskId, 'conversation_create_failed')
  })

  it('reports failure when task dispatch fails', async () => {
    deps.taskDispatcher.dispatch = vi.fn().mockRejectedValue(
      Object.assign(new Error('No available agent'), { name: 'TaskDispatchError' }),
    )

    const result = await service.start(taskId)

    expect(result.status).toBe('failed')
    expect(result.error).toBe('task_dispatch_failed')
    expect(deps.taskService.failExecution).toHaveBeenCalledWith(taskId, 'task_dispatch_failed')
  })

  it('passes the requested model to the conversation and prompt service', async () => {
    const result = await service.start(taskId, { model: 'devin-pro' })

    expect(result.status).toBe('started')
    expect(deps.conversationService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        providerConfig: { model: 'devin-pro' },
      }),
    )
    expect(deps.promptExecutionService.send).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'devin-pro',
      }),
    )
  })

  it('exposes OfficeTaskExecutionError as a named error', () => {
    const error = new OfficeTaskExecutionError('test', 400)
    expect(error.name).toBe('OfficeTaskExecutionError')
    expect(error.statusCode).toBe(400)
  })
})
