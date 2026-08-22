import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  ConversationService,
  ConversationValidationError,
} from '../src/services/ConversationService.js'
import {
  ConversationRepository,
  type ConversationRecord,
} from '../src/repositories/ConversationRepository.js'
import { ProjectRepository, type ProjectRecord } from '../src/repositories/ProjectRepository.js'

vi.mock('../db/pool.js', () => ({
  pool: { query: vi.fn(), on: vi.fn(), end: vi.fn() },
}))

describe('ConversationService', () => {
  let conversationRepo: ConversationRepository
  let projectRepo: ProjectRepository
  let service: ConversationService
  let mockConversation: ConversationRecord
  let mockProject: ProjectRecord

  beforeEach(() => {
    mockProject = {
      id: 'proj-1',
      name: 'Test Project',
      slug: 'test-project',
      path: '/tmp/test',
      description: null,
      enabled: true,
      default_provider_id: null,
      default_provider_config: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    mockConversation = {
      id: 'conv-1',
      project_id: 'proj-1',
      title: 'New Conversation',
      status: 'active',
      agent_type: 'devin',
      provider_config: null,
      agent_session_id: null,
      agent_status: 'idle',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_message_at: null,
    }

    conversationRepo = {
      findByProject: vi.fn().mockResolvedValue([mockConversation]),
      findById: vi.fn().mockResolvedValue(mockConversation),
      create: vi.fn().mockResolvedValue(mockConversation),
      update: vi.fn().mockResolvedValue(mockConversation),
      delete: vi.fn().mockResolvedValue(true),
      touchLastMessage: vi.fn().mockResolvedValue(undefined),
      search: vi.fn().mockResolvedValue([]),
    } as unknown as ConversationRepository

    projectRepo = {
      findById: vi.fn().mockResolvedValue(mockProject),
    } as unknown as ProjectRepository

    service = new ConversationService(conversationRepo, projectRepo)
  })

  it('creates a conversation for a valid project', async () => {
    const conv = await service.create({ projectId: 'proj-1', title: 'My Task' })
    expect(conv).toEqual(mockConversation)
    expect(conversationRepo.create).toHaveBeenCalledWith({
      projectId: 'proj-1',
      title: 'My Task',
      agentType: 'devin',
      providerConfig: null,
    })
  })

  it('creates a conversation with default title when none provided', async () => {
    await service.create({ projectId: 'proj-1' })
    expect(conversationRepo.create).toHaveBeenCalledWith({
      projectId: 'proj-1',
      title: 'New Conversation',
      agentType: 'devin',
      providerConfig: null,
    })
  })

  it('rejects creation with empty project ID', async () => {
    await expect(service.create({ projectId: '' })).rejects.toThrow(ConversationValidationError)
  })

  it('rejects creation when project is not found (404)', async () => {
    vi.mocked(projectRepo.findById).mockResolvedValueOnce(null)
    await expect(service.create({ projectId: 'nonexistent' })).rejects.toMatchObject({
      statusCode: 404,
    })
  })

  it('rejects creation when project is disabled', async () => {
    vi.mocked(projectRepo.findById).mockResolvedValueOnce({ ...mockProject, enabled: false })
    await expect(service.create({ projectId: 'proj-1' })).rejects.toMatchObject({
      statusCode: 400,
    })
  })

  it('updates a conversation title', async () => {
    const updated = await service.update('conv-1', { title: 'New Title' })
    expect(updated).toEqual(mockConversation)
    expect(conversationRepo.update).toHaveBeenCalledWith('conv-1', expect.objectContaining({ title: 'New Title' }))
  })

  it('rejects update with empty title', async () => {
    await expect(service.update('conv-1', { title: '' })).rejects.toThrow(ConversationValidationError)
  })

  it('returns null when updating a non-existent conversation', async () => {
    vi.mocked(conversationRepo.findById).mockResolvedValueOnce(null)
    const result = await service.update('nonexistent', { title: 'New' })
    expect(result).toBeNull()
  })

  it('archives a conversation', async () => {
    const result = await service.archive('conv-1')
    expect(conversationRepo.update).toHaveBeenCalledWith('conv-1', { status: 'archived' })
    expect(result).toEqual(mockConversation)
  })

  it('deletes a conversation', async () => {
    const result = await service.delete('conv-1')
    expect(result).toBe(true)
  })

  it('lists conversations by project', async () => {
    const result = await service.listByProject('proj-1')
    expect(result).toHaveLength(1)
  })

  it('searches with a query', async () => {
    vi.mocked(conversationRepo.search).mockResolvedValueOnce([
      {
        conversation_id: 'conv-1',
        project_id: 'proj-1',
        project_name: 'Test Project',
        conversation_title: 'Stripe issue',
        created_at: new Date().toISOString(),
      },
    ])
    const results = await service.search('stripe')
    expect(results).toHaveLength(1)
    expect(results[0].conversation_title).toBe('Stripe issue')
  })

  it('returns empty array for empty search query', async () => {
    const results = await service.search('')
    expect(results).toEqual([])
  })

  it('generates a title from a prompt', () => {
    expect(service.generateTitle('Fix the failing tests')).toBe('Fix the failing tests')
  })

  it('truncates long prompts in title generation', () => {
    const longPrompt = 'A'.repeat(100)
    const title = service.generateTitle(longPrompt)
    expect(title.length).toBeLessThanOrEqual(60)
    expect(title).toMatch(/\.\.\.$/)
  })
})
