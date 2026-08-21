import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AgentController } from '../src/controllers/AgentController.js'
import { AgentManager, type AgentRun } from '../src/agent/AgentManager.js'
import { AgentEventRepository, type AgentEventRecord } from '../src/repositories/AgentEventRepository.js'
import type { Request, Response } from 'express'

function makeEvent(seq: number, type: string, content: string): AgentEventRecord {
  return {
    id: `event-${seq}`,
    conversation_id: 'conv-1',
    event_type: type,
    content,
    event_sequence: String(seq),
    created_at: new Date().toISOString(),
  }
}

function mockReqRes(lastEventId?: string): { req: Request; res: Response & { written: string[]; ended: boolean; statusCode: number } } {
  const written: string[] = []
  const res = {
    statusCode: 200,
    written,
    ended: false,
    writeHeadCalled: false as boolean,
    headers: {} as Record<string, string>,
    writeHead(_status: number, headers: Record<string, string>) {
      this.writeHeadCalled = true
      this.headers = headers
    },
    write(data: string) {
      this.written.push(data)
      return true
    },
    end() {
      this.ended = true
    },
    on: vi.fn(),
  }
  const req = {
    params: { id: '00000000-0000-0000-0000-000000000001' },
    headers: lastEventId ? { 'last-event-id': lastEventId } : {},
    on: vi.fn(),
  }
  return { req: req as unknown as Request, res: res as unknown as Response & { written: string[]; ended: boolean; statusCode: number } }
}

describe('AgentController.streamEvents (SSE)', () => {
  let agentManager: AgentManager
  let eventRepo: AgentEventRepository
  let controller: AgentController
  let subscribers: Map<string, (event: AgentEventRecord) => void>

  beforeEach(() => {
    subscribers = new Map()

    agentManager = {
      getStatus: vi.fn().mockReturnValue(null),
      subscribe: vi.fn().mockImplementation((conversationId: string, listener: (event: AgentEventRecord) => void) => {
        subscribers.set(conversationId, listener)
        return () => subscribers.delete(conversationId)
      }),
      isConversationActive: vi.fn().mockReturnValue(false),
    } as unknown as AgentManager

    eventRepo = {
      findByConversation: vi.fn().mockResolvedValue([]),
      findLatestRunStart: vi.fn().mockResolvedValue(null),
      create: vi.fn(),
    } as unknown as AgentEventRepository

    controller = new AgentController(agentManager, eventRepo)
  })

  it('replays events after a monotonic Last-Event-ID cursor', async () => {
    const replayEvents = [makeEvent(5, 'output', '{"content":"hello"}'), makeEvent(6, 'status', '{"status":"running"}')]
    vi.mocked(eventRepo.findByConversation).mockResolvedValue(replayEvents)

    const { req, res } = mockReqRes('4')
    await controller.streamEvents(req, res)

    // With Last-Event-ID present, findLatestRunStart is not called
    expect(eventRepo.findLatestRunStart).not.toHaveBeenCalled()
    expect(eventRepo.findByConversation).toHaveBeenCalledWith(
      '00000000-0000-0000-0000-000000000001',
      '4',
    )
    // Replay events written in sequence order
    expect(res.written.join('')).toContain('id: 5')
    expect(res.written.join('')).toContain('id: 6')
  })

  it('on first connect, only replays events from the latest starting status', async () => {
    // Simulate: run 1 (seq 1-3) completed, run 2 (seq 4+) is current
    vi.mocked(eventRepo.findLatestRunStart).mockResolvedValue('4')
    const replayEvents = [
      makeEvent(4, 'status', '{"status":"starting"}'),
      makeEvent(5, 'output', '{"content":"current run output"}'),
    ]
    vi.mocked(eventRepo.findByConversation).mockResolvedValue(replayEvents)

    const { req, res } = mockReqRes() // no Last-Event-ID
    await controller.streamEvents(req, res)

    // findLatestRunStart was called
    expect(eventRepo.findLatestRunStart).toHaveBeenCalledWith('00000000-0000-0000-0000-000000000001')
    // findByConversation was called with cursor = seq-1 = '3' so the starting event is included
    expect(eventRepo.findByConversation).toHaveBeenCalledWith(
      '00000000-0000-0000-0000-000000000001',
      '3',
    )
    // Only current run events are replayed (seq 4 and 5), not historical (seq 1-3)
    const output = res.written.join('')
    expect(output).toContain('id: 4')
    expect(output).toContain('id: 5')
    expect(output).not.toContain('id: 1')
    expect(output).not.toContain('id: 2')
    expect(output).not.toContain('id: 3')
  })

  it('on first connect with no starting event, replays all events', async () => {
    vi.mocked(eventRepo.findLatestRunStart).mockResolvedValue(null)
    const replayEvents = [makeEvent(1, 'output', '{"content":"legacy"}')]
    vi.mocked(eventRepo.findByConversation).mockResolvedValue(replayEvents)

    const { req, res } = mockReqRes()
    await controller.streamEvents(req, res)

    // No cursor — findByConversation called with undefined
    expect(eventRepo.findByConversation).toHaveBeenCalledWith(
      '00000000-0000-0000-0000-000000000001',
      undefined,
    )
    expect(res.written.join('')).toContain('id: 1')
  })

  it('does not create database rows from an SSE GET request', async () => {
    const { req, res } = mockReqRes()
    await controller.streamEvents(req, res)

    expect(eventRepo.create).not.toHaveBeenCalled()
  })

  it('delivers queued live events after replay without duplication', async () => {
    const replayEvents = [makeEvent(1, 'output', '{"content":"old"}')]
    vi.mocked(eventRepo.findByConversation).mockResolvedValue(replayEvents)

    const run: AgentRun = {
      conversationId: 'conv-1',
      projectSlug: 'test',
      sessionName: 'jheckbot-test-conv-1',
      status: 'running',
      startedAt: new Date().toISOString(),
      outputBuffer: '',
      normalizedSnapshot: [],
    }
    vi.mocked(agentManager.getStatus).mockReturnValue(run)

    const { req, res } = mockReqRes()
    await controller.streamEvents(req, res)

    // Simulate a live event from the manager watcher
    const liveEvent = makeEvent(2, 'output', '{"content":"new"}')
    subscribers.get('00000000-0000-0000-0000-000000000001')?.(liveEvent)

    // Replay event 1 should appear once, live event 2 should appear once
    const output = res.written.join('')
    expect(output).toContain('id: 1')
    expect(output).toContain('id: 2')
    // No duplication
    expect((output.match(/id: 1/g) || []).length).toBe(1)
    expect((output.match(/id: 2/g) || []).length).toBe(1)
  })

  it('sends exactly one terminal status event and closes', async () => {
    const { req, res } = mockReqRes()
    await controller.streamEvents(req, res)

    // Simulate a terminal status event
    const terminalEvent = makeEvent(1, 'status', JSON.stringify({ status: 'completed' }))
    subscribers.get('00000000-0000-0000-0000-000000000001')?.(terminalEvent)

    expect(res.ended).toBe(true)
    const output = res.written.join('')
    expect(output).toContain('"status":"completed"')
  })

  it('skips live events already covered by replay watermark', async () => {
    const replayEvents = [makeEvent(1, 'output', '{"content":"old"}'), makeEvent(2, 'output', '{"content":"replayed"}')]
    vi.mocked(eventRepo.findByConversation).mockResolvedValue(replayEvents)

    const run: AgentRun = {
      conversationId: 'conv-1',
      projectSlug: 'test',
      sessionName: 'jheckbot-test-conv-1',
      status: 'running',
      startedAt: new Date().toISOString(),
      outputBuffer: '',
      normalizedSnapshot: [],
    }
    vi.mocked(agentManager.getStatus).mockReturnValue(run)

    const { req, res } = mockReqRes()
    await controller.streamEvents(req, res)

    // Simulate a live event with sequence <= replay watermark
    const staleEvent = makeEvent(2, 'output', '{"content":"replayed"}')
    subscribers.get('00000000-0000-0000-0000-000000000001')?.(staleEvent)

    const output = res.written.join('')
    // Event 2 should appear only once (from replay, not from live)
    expect((output.match(/id: 2/g) || []).length).toBe(1)
  })

  it('closes the response when the client disconnects', async () => {
    const { req, res } = mockReqRes()

    await controller.streamEvents(req, res)

    // The controller should register a close handler on the request
    expect(req.on).toHaveBeenCalledWith('close', expect.any(Function))
  })
})
