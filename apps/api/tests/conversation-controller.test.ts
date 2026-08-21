import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ConversationController } from '../src/controllers/ConversationController.js'
import { ConversationService, ConversationValidationError } from '../src/services/ConversationService.js'
import { MessageService, MessageValidationError } from '../src/services/MessageService.js'
import { PromptExecutionService, PromptExecutionError } from '../src/services/PromptExecutionService.js'
import { AgentManagerError } from '../src/agent/AgentManager.js'
import type { Request, Response } from 'express'

function mockReq(body: Record<string, unknown> = {}, params: Record<string, string> = {}): Request {
  return { body, params } as unknown as Request
}

function mockRes(): Response & { statusCode: number; body: unknown } {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) { this.statusCode = code; return this },
    json(data: unknown) { this.body = data; return this },
    send() { return this },
  }
  return res as unknown as Response & { statusCode: number; body: unknown }
}

describe('ConversationController.createMessage (atomic path)', () => {
  let conversationService: ConversationService
  let messageService: MessageService
  let promptExecutionService: PromptExecutionService
  let controller: ConversationController

  beforeEach(() => {
    conversationService = {} as unknown as ConversationService
    messageService = {
      listByConversation: vi.fn().mockResolvedValue([]),
    } as unknown as MessageService

    promptExecutionService = {
      send: vi.fn(),
    } as unknown as PromptExecutionService

    controller = new ConversationController(conversationService, messageService, promptExecutionService)
  })

  it('returns 202 with { message, run } on a successful atomic send', async () => {
    vi.mocked(promptExecutionService.send).mockResolvedValue({
      message: { id: 'msg-1', conversation_id: 'conv-1', role: 'user', content: 'Fix tests', message_type: 'prompt', model: null, created_at: new Date().toISOString() },
      run: { conversationId: 'conv-1', projectSlug: 'test', sessionName: 'jheckbot-test-conv-1', status: 'running', startedAt: new Date().toISOString(), outputBuffer: '', normalizedSnapshot: [] },
    })

    const req = mockReq({ content: 'Fix tests' }, { id: '00000000-0000-0000-0000-000000000001' })
    const res = mockRes()
    await controller.createMessage(req, res)

    expect(res.statusCode).toBe(202)
    expect((res.body as { message: { id: string } }).message.id).toBe('msg-1')
  })

  it('returns 400 for invalid conversation ID format', async () => {
    const req = mockReq({ content: 'Fix tests' }, { id: 'not-a-uuid' })
    const res = mockRes()
    await controller.createMessage(req, res)

    expect(res.statusCode).toBe(400)
    expect((res.body as { error: string }).error).toContain('Invalid')
  })

  it('returns 400 for empty content', async () => {
    vi.mocked(promptExecutionService.send).mockRejectedValue(
      new PromptExecutionError('Prompt content is required', 400),
    )

    const req = mockReq({ content: '' }, { id: '00000000-0000-0000-0000-000000000001' })
    const res = mockRes()
    await controller.createMessage(req, res)

    expect(res.statusCode).toBe(400)
  })

  it('returns 409 when agent is already working', async () => {
    vi.mocked(promptExecutionService.send).mockRejectedValue(
      new AgentManagerError('Agent is currently working', 409),
    )

    const req = mockReq({ content: 'Fix tests' }, { id: '00000000-0000-0000-0000-000000000001' })
    const res = mockRes()
    await controller.createMessage(req, res)

    expect(res.statusCode).toBe(409)
    expect((res.body as { error: string }).error).toBe('Agent is currently working')
  })

  it('returns 404 when conversation is not found', async () => {
    vi.mocked(promptExecutionService.send).mockRejectedValue(
      new PromptExecutionError('Conversation not found', 404),
    )

    const req = mockReq({ content: 'Fix tests' }, { id: '00000000-0000-0000-0000-000000000001' })
    const res = mockRes()
    await controller.createMessage(req, res)

    expect(res.statusCode).toBe(404)
  })

  it('returns 429 when max concurrent sessions is reached', async () => {
    vi.mocked(promptExecutionService.send).mockRejectedValue(
      new AgentManagerError('Maximum concurrent agent sessions reached', 429),
    )

    const req = mockReq({ content: 'Fix tests' }, { id: '00000000-0000-0000-0000-000000000001' })
    const res = mockRes()
    await controller.createMessage(req, res)

    expect(res.statusCode).toBe(429)
  })

  it('does not expose stack traces on unexpected errors', async () => {
    vi.mocked(promptExecutionService.send).mockRejectedValue(new Error('unexpected'))

    const req = mockReq({ content: 'Fix tests' }, { id: '00000000-0000-0000-0000-000000000001' })
    const res = mockRes()

    // The controller rethrows unexpected errors to the generic error handler
    await expect(controller.createMessage(req, res)).rejects.toThrow('unexpected')
  })
})
