import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MessageService, MessageValidationError } from '../src/services/MessageService.js'
import { MessageRepository, type MessageRecord } from '../src/repositories/MessageRepository.js'
import {
  ConversationRepository,
  type ConversationRecord,
} from '../src/repositories/ConversationRepository.js'

vi.mock('../db/pool.js', () => ({
  pool: { query: vi.fn(), on: vi.fn(), end: vi.fn() },
}))

describe('MessageService', () => {
  let messageRepo: MessageRepository
  let conversationRepo: ConversationRepository
  let service: MessageService
  let mockMessage: MessageRecord
  let mockConversation: ConversationRecord

  beforeEach(() => {
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
      message_type: 'text',
      model: null,
      created_at: new Date().toISOString(),
    }

    messageRepo = {
      findByConversation: vi.fn().mockResolvedValue([mockMessage]),
      create: vi.fn().mockResolvedValue(mockMessage),
      countByConversation: vi.fn().mockResolvedValue(1),
    } as unknown as MessageRepository

    conversationRepo = {
      findById: vi.fn().mockResolvedValue(mockConversation),
      touchLastMessage: vi.fn().mockResolvedValue(undefined),
      update: vi.fn().mockResolvedValue(mockConversation),
    } as unknown as ConversationRepository

    service = new MessageService(messageRepo, conversationRepo)
  })

  it('creates a user message', async () => {
    const msg = await service.create({
      conversationId: 'conv-1',
      role: 'user',
      content: 'Fix the tests',
    })
    expect(msg).toEqual(mockMessage)
    expect(messageRepo.create).toHaveBeenCalledOnce()
    expect(conversationRepo.touchLastMessage).toHaveBeenCalledWith('conv-1')
  })

  it('auto-generates title from first user message', async () => {
    await service.create({
      conversationId: 'conv-1',
      role: 'user',
      content: 'Fix the failing restaurant authentication tests',
    })
    expect(conversationRepo.update).toHaveBeenCalledWith('conv-1', {
      title: 'Fix the failing restaurant authentication tests',
    })
  })

  it('does not auto-generate title if conversation already has a custom title', async () => {
    vi.mocked(conversationRepo.findById).mockResolvedValueOnce({
      ...mockConversation,
      title: 'Custom Title',
    })
    await service.create({
      conversationId: 'conv-1',
      role: 'user',
      content: 'Some prompt',
    })
    expect(conversationRepo.update).not.toHaveBeenCalled()
  })

  it('does not auto-generate title for assistant messages', async () => {
    await service.create({
      conversationId: 'conv-1',
      role: 'assistant',
      content: 'Working on it',
    })
    expect(conversationRepo.update).not.toHaveBeenCalled()
  })

  it('rejects creation with empty content', async () => {
    await expect(
      service.create({ conversationId: 'conv-1', role: 'user', content: '' }),
    ).rejects.toThrow(MessageValidationError)
  })

  it('rejects creation with empty conversation ID', async () => {
    await expect(
      service.create({ conversationId: '', role: 'user', content: 'test' }),
    ).rejects.toThrow(MessageValidationError)
  })

  it('rejects creation when conversation is not found (404)', async () => {
    vi.mocked(conversationRepo.findById).mockResolvedValueOnce(null)
    await expect(
      service.create({ conversationId: 'nonexistent', role: 'user', content: 'test' }),
    ).rejects.toMatchObject({ statusCode: 404 })
  })

  it('lists messages by conversation', async () => {
    const messages = await service.listByConversation('conv-1')
    expect(messages).toHaveLength(1)
    expect(messages[0]).toEqual(mockMessage)
  })

  it('passes limit and offset to repository', async () => {
    await service.listByConversation('conv-1', 50, 10)
    expect(messageRepo.findByConversation).toHaveBeenCalledWith('conv-1', 50, 10)
  })
})
