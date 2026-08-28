import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Test the atomic send contract: one POST call with { content, model },
// returning { message, run }. This verifies the composable's API shape
// without requiring a Nuxt runtime.

interface SendMessageResponse {
  message: {
    id: string
    conversation_id: string
    role: string
    content: string
    message_type: string
    created_at: string
  }
  run: {
    conversationId: string
    status: string
    sessionName: string
  }
}

describe('useConversations atomic send contract', () => {
  let mockPost: ReturnType<typeof vi.fn>
  let mockGet: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockPost = vi.fn()
    mockGet = vi.fn()
    // Nuxt auto-imports are globals; provide a mock useApi
    ;(globalThis as Record<string, unknown>).useApi = () => ({
      post: mockPost,
      get: mockGet,
    })
  })

  afterEach(() => {
    delete (globalThis as Record<string, unknown>).useApi
  })

  it('sendMessage makes one POST with { content, model } and returns { message, run }', async () => {
    const expected: SendMessageResponse = {
      message: {
        id: 'msg-uuid-1',
        conversation_id: 'conv-1',
        role: 'user',
        content: 'Fix the tests',
        message_type: 'prompt',
        created_at: new Date().toISOString(),
      },
      run: {
        conversationId: 'conv-1',
        status: 'running',
        sessionName: 'jheckbot-test-conv-1',
      },
    }
    mockPost.mockResolvedValue(expected)

    const { useConversations } = await import('../app/composables/useConversations')
    const conv = useConversations()
    const result = await conv.sendMessage('conv-1', 'Fix the tests', 'glm-5-2')

    expect(mockPost).toHaveBeenCalledOnce()
    expect(mockPost).toHaveBeenCalledWith('/api/conversations/conv-1/messages', {
      content: 'Fix the tests',
      model: 'glm-5-2',
    })
    expect(result).toEqual(expected)
    expect(result.message.id).toBe('msg-uuid-1')
    expect(result.run.status).toBe('running')
  })

  it('sendMessage does not send a role field (server controls role)', async () => {
    mockPost.mockResolvedValue({ message: {}, run: {} })

    const { useConversations } = await import('../app/composables/useConversations')
    const conv = useConversations()
    await conv.sendMessage('conv-1', 'test prompt')

    const callBody = mockPost.mock.calls[0][1] as Record<string, unknown>
    expect(callBody.role).toBeUndefined()
    expect(callBody.content).toBe('test prompt')
  })

  it('sendMessage propagates errors for the page to display', async () => {
    mockPost.mockRejectedValue({
      data: { error: 'Agent is currently working' },
    })

    const { useConversations } = await import('../app/composables/useConversations')
    const conv = useConversations()

    await expect(conv.sendMessage('conv-1', 'test')).rejects.toMatchObject({
      data: { error: 'Agent is currently working' },
    })
  })

  it('sendMessage works without a model parameter', async () => {
    mockPost.mockResolvedValue({ message: {}, run: {} })

    const { useConversations } = await import('../app/composables/useConversations')
    const conv = useConversations()
    await conv.sendMessage('conv-1', 'no model')

    const callBody = mockPost.mock.calls[0][1] as Record<string, unknown>
    expect(callBody.model).toBeUndefined()
    expect(callBody.content).toBe('no model')
  })

  it('does not expose startAgent (removed from composable)', async () => {
    const { useConversations } = await import('../app/composables/useConversations')
    const conv = useConversations()

    expect((conv as Record<string, unknown>).startAgent).toBeUndefined()
  })
})
