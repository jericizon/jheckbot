import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { OfficeAgent, OfficeAgentMessage, MessageType } from '@jheckbot/shared'
import { pool } from '../src/db/pool.js'
import { OfficeAgentRepository } from '../src/repositories/OfficeAgentRepository.js'
import { OfficeAgentMessageRepository } from '../src/repositories/OfficeAgentMessageRepository.js'
import { OfficeEventService } from '../src/services/OfficeEventService.js'
import {
  OfficeAgentMessageService,
  OfficeAgentMessageValidationError,
} from '../src/services/OfficeAgentMessageService.js'

vi.mock('../src/db/pool.js', () => ({
  pool: { query: vi.fn(), on: vi.fn(), end: vi.fn() },
}))

const FROM_AGENT_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const TO_AGENT_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
const OTHER_AGENT_ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc'
const OFFICE_ID = '11111111-1111-1111-1111-111111111111'

function makeAgent(overrides: Partial<OfficeAgent> = {}): OfficeAgent {
  const now = new Date().toISOString()
  return {
    id: FROM_AGENT_ID,
    officeId: OFFICE_ID,
    name: 'Alfred',
    role: 'Senior Backend Developer',
    status: 'idle',
    enabled: true,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

function makeMessage(overrides: Partial<OfficeAgentMessage> = {}): OfficeAgentMessage {
  const now = new Date().toISOString()
  return {
    id: 'message-1',
    officeId: OFFICE_ID,
    taskId: 'task-1',
    fromAgentId: FROM_AGENT_ID,
    toAgentId: TO_AGENT_ID,
    type: 'HANDOFF',
    content: 'Handing this off.',
    createdAt: now,
    ...overrides,
  }
}

describe('OfficeAgentMessageService', () => {
  let repo: OfficeAgentMessageRepository
  let agentRepo: OfficeAgentRepository
  let eventService: OfficeEventService
  let service: OfficeAgentMessageService
  let mockMessage: OfficeAgentMessage

  beforeEach(() => {
    mockMessage = makeMessage()

    repo = {
      create: vi.fn().mockResolvedValue(mockMessage),
      listByOffice: vi.fn().mockResolvedValue([mockMessage]),
      listByTask: vi.fn().mockResolvedValue([mockMessage]),
      listByAgent: vi.fn().mockResolvedValue([mockMessage]),
      getById: vi.fn().mockResolvedValue(mockMessage),
      markRead: vi.fn().mockResolvedValue(mockMessage),
      getThread: vi.fn().mockResolvedValue({ root: mockMessage, replies: [] }),
    } as unknown as OfficeAgentMessageRepository

    agentRepo = {
      getById: vi.fn().mockResolvedValue(makeAgent()),
    } as unknown as OfficeAgentRepository

    eventService = {
      create: vi.fn().mockResolvedValue({}),
      listByOffice: vi.fn().mockResolvedValue([]),
    } as unknown as OfficeEventService

    service = new OfficeAgentMessageService(repo, agentRepo, eventService)
  })

  it('creates a message, verifies agents, and emits an AGENT_MESSAGE event', async () => {
    const fromAgent = makeAgent({ id: FROM_AGENT_ID })
    const toAgent = makeAgent({ id: TO_AGENT_ID })
    vi.mocked(agentRepo.getById)
      .mockResolvedValueOnce(fromAgent)
      .mockResolvedValueOnce(toAgent)

    const result = await service.create({
      officeId: OFFICE_ID,
      fromAgentId: FROM_AGENT_ID,
      toAgentId: TO_AGENT_ID,
      type: 'HANDOFF',
      content: 'Handing this off.',
    })

    expect(result).toEqual(mockMessage)
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        officeId: OFFICE_ID,
        fromAgentId: FROM_AGENT_ID,
        toAgentId: TO_AGENT_ID,
        type: 'HANDOFF',
        content: 'Handing this off.',
      }),
    )
    expect(agentRepo.getById).toHaveBeenCalledWith(FROM_AGENT_ID)
    expect(agentRepo.getById).toHaveBeenCalledWith(TO_AGENT_ID)
    expect(eventService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        officeId: OFFICE_ID,
        eventType: 'AGENT_MESSAGE',
        metadata: expect.objectContaining({
          messageId: mockMessage.id,
          fromAgentId: FROM_AGENT_ID,
          toAgentId: TO_AGENT_ID,
          type: 'HANDOFF',
        }),
      }),
    )
  })

  it('creates a message without a recipient and still verifies the sender', async () => {
    mockMessage = makeMessage({ toAgentId: undefined })
    vi.mocked(repo.create).mockResolvedValue(mockMessage)

    const result = await service.create({
      officeId: OFFICE_ID,
      fromAgentId: FROM_AGENT_ID,
      type: 'PROGRESS',
      content: 'Making progress.',
    })

    expect(result).toEqual(mockMessage)
    expect(agentRepo.getById).toHaveBeenCalledTimes(1)
    expect(agentRepo.getById).toHaveBeenCalledWith(FROM_AGENT_ID)
    expect(eventService.create).toHaveBeenCalled()
  })

  it('trims message content when creating', async () => {
    await service.create({
      officeId: OFFICE_ID,
      fromAgentId: FROM_AGENT_ID,
      type: 'PROGRESS',
      content: '  Making progress.  ',
    })

    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ content: 'Making progress.' }))
  })

  it('rejects creation with empty office id', async () => {
    await expect(
      service.create({
        officeId: '',
        fromAgentId: FROM_AGENT_ID,
        type: 'HANDOFF',
        content: 'Hello',
      }),
    ).rejects.toThrow(OfficeAgentMessageValidationError)
  })

  it('rejects creation with empty from agent id', async () => {
    await expect(
      service.create({
        officeId: OFFICE_ID,
        fromAgentId: '',
        type: 'HANDOFF',
        content: 'Hello',
      }),
    ).rejects.toThrow(OfficeAgentMessageValidationError)
  })

  it('rejects creation with an invalid from agent uuid', async () => {
    await expect(
      service.create({
        officeId: OFFICE_ID,
        fromAgentId: 'not-a-uuid',
        type: 'HANDOFF',
        content: 'Hello',
      }),
    ).rejects.toThrow(OfficeAgentMessageValidationError)
  })

  it('rejects creation with an empty to agent id', async () => {
    await expect(
      service.create({
        officeId: OFFICE_ID,
        fromAgentId: FROM_AGENT_ID,
        toAgentId: '',
        type: 'HANDOFF',
        content: 'Hello',
      }),
    ).rejects.toThrow(OfficeAgentMessageValidationError)
  })

  it('rejects creation with an invalid to agent uuid', async () => {
    await expect(
      service.create({
        officeId: OFFICE_ID,
        fromAgentId: FROM_AGENT_ID,
        toAgentId: 'not-a-uuid',
        type: 'HANDOFF',
        content: 'Hello',
      }),
    ).rejects.toThrow(OfficeAgentMessageValidationError)
  })

  it('rejects creation with an invalid message type', async () => {
    await expect(
      service.create({
        officeId: OFFICE_ID,
        fromAgentId: FROM_AGENT_ID,
        type: 'UNKNOWN' as MessageType,
        content: 'Hello',
      }),
    ).rejects.toThrow(OfficeAgentMessageValidationError)
  })

  it('rejects creation with empty content', async () => {
    await expect(
      service.create({
        officeId: OFFICE_ID,
        fromAgentId: FROM_AGENT_ID,
        type: 'HANDOFF',
        content: '',
      }),
    ).rejects.toThrow(OfficeAgentMessageValidationError)
  })

  it('rejects creation when the from agent is not found', async () => {
    vi.mocked(agentRepo.getById).mockResolvedValueOnce(null)

    await expect(
      service.create({
        officeId: OFFICE_ID,
        fromAgentId: OTHER_AGENT_ID,
        type: 'HANDOFF',
        content: 'Hello',
      }),
    ).rejects.toThrow(OfficeAgentMessageValidationError)
  })

  it('rejects creation when the from agent belongs to a different office', async () => {
    vi.mocked(agentRepo.getById).mockResolvedValueOnce(makeAgent({ officeId: 'other-office' }))

    await expect(
      service.create({
        officeId: OFFICE_ID,
        fromAgentId: FROM_AGENT_ID,
        type: 'HANDOFF',
        content: 'Hello',
      }),
    ).rejects.toThrow(OfficeAgentMessageValidationError)
  })

  it('rejects creation when the to agent is not found', async () => {
    vi.mocked(agentRepo.getById)
      .mockResolvedValueOnce(makeAgent({ id: FROM_AGENT_ID }))
      .mockResolvedValueOnce(null)

    await expect(
      service.create({
        officeId: OFFICE_ID,
        fromAgentId: FROM_AGENT_ID,
        toAgentId: TO_AGENT_ID,
        type: 'HANDOFF',
        content: 'Hello',
      }),
    ).rejects.toThrow(OfficeAgentMessageValidationError)
  })

  it('rejects creation when the to agent belongs to a different office', async () => {
    vi.mocked(agentRepo.getById)
      .mockResolvedValueOnce(makeAgent({ id: FROM_AGENT_ID }))
      .mockResolvedValueOnce(makeAgent({ id: TO_AGENT_ID, officeId: 'other-office' }))

    await expect(
      service.create({
        officeId: OFFICE_ID,
        fromAgentId: FROM_AGENT_ID,
        toAgentId: TO_AGENT_ID,
        type: 'HANDOFF',
        content: 'Hello',
      }),
    ).rejects.toThrow(OfficeAgentMessageValidationError)
  })

  it('lists messages by office', async () => {
    const result = await service.listByOffice(OFFICE_ID)
    expect(result).toEqual([mockMessage])
    expect(repo.listByOffice).toHaveBeenCalledWith(OFFICE_ID)
  })

  it('rejects listing by office with empty id', async () => {
    await expect(service.listByOffice('')).rejects.toThrow(OfficeAgentMessageValidationError)
  })

  it('lists messages by task', async () => {
    const result = await service.listByTask('task-1')
    expect(result).toEqual([mockMessage])
    expect(repo.listByTask).toHaveBeenCalledWith('task-1')
  })

  it('rejects listing by task with empty id', async () => {
    await expect(service.listByTask('')).rejects.toThrow(OfficeAgentMessageValidationError)
  })

  it('lists messages by agent', async () => {
    const result = await service.listByAgent(FROM_AGENT_ID)
    expect(result).toEqual([mockMessage])
    expect(repo.listByAgent).toHaveBeenCalledWith(FROM_AGENT_ID)
  })

  it('rejects listing by agent with empty id', async () => {
    await expect(service.listByAgent('')).rejects.toThrow(OfficeAgentMessageValidationError)
  })

  it('gets a message by id', async () => {
    const result = await service.getById('message-1')
    expect(result).toEqual(mockMessage)
    expect(repo.getById).toHaveBeenCalledWith('message-1')
  })

  it('rejects get with empty id', async () => {
    await expect(service.getById('')).rejects.toThrow(OfficeAgentMessageValidationError)
  })

  it('marks a message as read', async () => {
    const result = await service.markRead('message-1')
    expect(result).toEqual(mockMessage)
    expect(repo.markRead).toHaveBeenCalledWith('message-1')
  })

  it('rejects markRead with empty id', async () => {
    await expect(service.markRead('')).rejects.toThrow(OfficeAgentMessageValidationError)
  })

  it('gets a thread', async () => {
    const result = await service.getThread('message-1')
    expect(result).toEqual({ root: mockMessage, replies: [] })
    expect(repo.getThread).toHaveBeenCalledWith('message-1')
  })

  it('rejects getThread with empty id', async () => {
    await expect(service.getThread('')).rejects.toThrow(OfficeAgentMessageValidationError)
  })
})
