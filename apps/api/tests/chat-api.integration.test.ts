import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import { ConversationController } from '../src/controllers/ConversationController.js'
import { AgentController } from '../src/controllers/AgentController.js'
import { PromptExecutionService, PromptExecutionError } from '../src/services/PromptExecutionService.js'
import { AgentManagerError } from '../src/agent/AgentManager.js'
import { messageLimiter } from '../src/middleware/rateLimiter.js'
import { createConversationRouter } from '../src/routes/conversation.routes.js'
import { errorHandler } from '../src/middleware/errorHandler.js'

function createTestApp(
  controller: ConversationController,
  agentController: AgentController,
): express.Express {
  const app = express()
  app.use(express.json())
  const router = createConversationRouter(controller, agentController)
  router.use('/:id/messages', messageLimiter)
  app.use('/api/conversations', router)
  app.use(errorHandler)
  return app
}

describe('Chat API integration', () => {
  let conversationController: ConversationController
  let agentController: AgentController
  let promptExecutionService: PromptExecutionService
  let app: express.Express

  beforeEach(() => {
    promptExecutionService = {
      send: vi.fn(),
    } as unknown as PromptExecutionService

    const conversationService = {} as never
    const messageService = {
      listByConversation: vi.fn().mockResolvedValue([]),
    } as never

    conversationController = new ConversationController(
      conversationService,
      messageService,
      promptExecutionService,
    )

    const agentManager = {
      getStatus: vi.fn().mockReturnValue(null),
      subscribe: vi.fn().mockReturnValue(() => {}),
    } as never

    agentController = new AgentController(agentManager, {} as never, promptExecutionService)

    app = createTestApp(conversationController, agentController)
  })

  it('returns 202 with { message, run } on a successful atomic send', async () => {
    vi.mocked(promptExecutionService.send).mockResolvedValue({
      message: {
        id: 'msg-1',
        conversation_id: '00000000-0000-0000-0000-000000000001',
        role: 'user',
        content: 'Fix tests',
        message_type: 'prompt',
        created_at: new Date().toISOString(),
      },
      run: {
        conversationId: '00000000-0000-0000-0000-000000000001',
        projectSlug: 'test',
        sessionName: 'jheckbot-test-conv-1',
        status: 'running',
        startedAt: new Date().toISOString(),
        outputBuffer: '',
        normalizedSnapshot: [],
      },
    })

    const res = await request(app)
      .post('/api/conversations/00000000-0000-0000-0000-000000000001/messages')
      .send({ content: 'Fix tests' })

    expect(res.status).toBe(202)
    expect(res.body).toHaveProperty('message')
    expect(res.body).toHaveProperty('run')
    expect(res.body.message.id).toBe('msg-1')
    expect(res.body.run.status).toBe('running')
  })

  it('returns 400 for invalid conversation UUID', async () => {
    const res = await request(app)
      .post('/api/conversations/not-a-uuid/messages')
      .send({ content: 'Fix tests' })

    expect(res.status).toBe(400)
    expect(res.body.error).toContain('Invalid')
  })

  it('returns 400 for empty content', async () => {
    vi.mocked(promptExecutionService.send).mockRejectedValue(
      new PromptExecutionError('Prompt content is required', 400),
    )

    const res = await request(app)
      .post('/api/conversations/00000000-0000-0000-0000-000000000001/messages')
      .send({ content: '' })

    expect(res.status).toBe(400)
  })

  it('returns 409 when agent is already working', async () => {
    vi.mocked(promptExecutionService.send).mockRejectedValue(
      new AgentManagerError('Agent is currently working', 409),
    )

    const res = await request(app)
      .post('/api/conversations/00000000-0000-0000-0000-000000000001/messages')
      .send({ content: 'Fix tests' })

    expect(res.status).toBe(409)
    expect(res.body.error).toBe('Agent is currently working')
  })

  it('returns 404 when conversation is not found', async () => {
    vi.mocked(promptExecutionService.send).mockRejectedValue(
      new PromptExecutionError('Conversation not found', 404),
    )

    const res = await request(app)
      .post('/api/conversations/00000000-0000-0000-0000-000000000001/messages')
      .send({ content: 'Fix tests' })

    expect(res.status).toBe(404)
  })

  it('returns 429 when max concurrent sessions is reached', async () => {
    vi.mocked(promptExecutionService.send).mockRejectedValue(
      new AgentManagerError('Maximum concurrent agent sessions reached', 429),
    )

    const res = await request(app)
      .post('/api/conversations/00000000-0000-0000-0000-000000000001/messages')
      .send({ content: 'Fix tests' })

    expect(res.status).toBe(429)
  })

  it('returns persisted messages from GET /messages', async () => {
    const messages = [
      { id: 'msg-1', conversation_id: 'conv-1', role: 'user', content: 'Hello', message_type: 'prompt', created_at: new Date().toISOString() },
      { id: 'msg-2', conversation_id: 'conv-1', role: 'assistant', content: 'Hi there', message_type: 'output', created_at: new Date().toISOString() },
    ]
    vi.mocked(conversationController['messageService'].listByConversation).mockResolvedValue(messages)

    const res = await request(app)
      .get('/api/conversations/00000000-0000-0000-0000-000000000001/messages')

    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(2)
    expect(res.body[0].role).toBe('user')
    expect(res.body[1].role).toBe('assistant')
  })

  it('does not expose stack traces on unexpected errors', async () => {
    vi.mocked(promptExecutionService.send).mockRejectedValue(new Error('unexpected'))

    const res = await request(app)
      .post('/api/conversations/00000000-0000-0000-0000-000000000001/messages')
      .send({ content: 'Fix tests' })

    // The generic error handler should return 500 without a stack trace
    expect(res.status).toBe(500)
    expect(res.body).not.toHaveProperty('stack')
  })

  it('rejects client-supplied role — only content and model are passed to the service', async () => {
    vi.mocked(promptExecutionService.send).mockResolvedValue({
      message: { id: 'msg-1', conversation_id: 'conv-1', role: 'user', content: 'test', message_type: 'prompt', created_at: new Date().toISOString() },
      run: { conversationId: 'conv-1', projectSlug: 'test', sessionName: 's', status: 'running', startedAt: '', outputBuffer: '', normalizedSnapshot: [] },
    })

    await request(app)
      .post('/api/conversations/00000000-0000-0000-0000-000000000001/messages')
      .send({ content: 'test', role: 'assistant', messageType: 'output' })

    const call = vi.mocked(promptExecutionService.send).mock.calls[0][0]
    expect(call).not.toHaveProperty('role')
    expect(call).not.toHaveProperty('messageType')
    expect(call).toHaveProperty('prompt', 'test')
  })
})
