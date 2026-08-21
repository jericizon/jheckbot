import type { Request, Response } from 'express'
import { isValidUuid } from '@jheckbot/shared'
import { AgentManager, AgentManagerError } from '../agent/AgentManager.js'
import { AgentEventRepository, type AgentEventRecord } from '../repositories/AgentEventRepository.js'
import { PromptExecutionService, PromptExecutionError } from '../services/PromptExecutionService.js'

function getParam(req: Request, name: string): string {
  const value = req.params[name]
  return Array.isArray(value) ? value[0] : value
}

function validateIdParam(req: Request, res: Response): string | null {
  const value = getParam(req, 'id')
  if (!isValidUuid(value)) {
    res.status(400).json({ error: 'Invalid conversation ID format' })
    return null
  }
  return value
}

export class AgentController {
  constructor(
    private agentManager: AgentManager,
    private eventRepo: AgentEventRepository,
    private promptExecutionService?: PromptExecutionService,
  ) {}

  async getStatus(req: Request, res: Response): Promise<void> {
    const conversationId = validateIdParam(req, res)
    if (!conversationId) return
    const run = this.agentManager.getStatus(conversationId)
    if (!run) {
      res.status(404).json({ error: 'No agent run for this conversation' })
      return
    }
    res.json(run)
  }

  async start(req: Request, res: Response): Promise<void> {
    const conversationId = validateIdParam(req, res)
    if (!conversationId) return
    try {
      // Delegate to the atomic prompt service when available
      if (this.promptExecutionService) {
        const result = await this.promptExecutionService.send({
          conversationId,
          prompt: req.body.prompt,
          model: req.body.model,
        })
        res.status(202).json(result)
        return
      }

      // Legacy compatibility path
      const run = await this.agentManager.start({
        conversationId,
        projectId: req.body.projectId,
        prompt: req.body.prompt,
        devinSessionId: req.body.devinSessionId,
        model: req.body.model,
      })
      await this.eventRepo.create({
        conversationId,
        eventType: 'status',
        content: JSON.stringify({ status: run.status }),
      })
      res.status(202).json(run)
    } catch (err) {
      if (err instanceof AgentManagerError) {
        res.status(err.statusCode).json({ error: err.message })
        return
      }
      if (err instanceof PromptExecutionError) {
        res.status(err.statusCode).json({ error: err.message })
        return
      }
      throw err
    }
  }

  async stop(req: Request, res: Response): Promise<void> {
    const conversationId = validateIdParam(req, res)
    if (!conversationId) return
    const run = await this.agentManager.stop(conversationId)
    if (!run) {
      res.status(404).json({ error: 'No agent run for this conversation' })
      return
    }
    await this.eventRepo.create({
      conversationId,
      eventType: 'status',
      content: JSON.stringify({ status: 'stopped' }),
    })
    res.json(run)
  }

  /** SSE endpoint for streaming agent output. */
  async streamEvents(req: Request, res: Response): Promise<void> {
    const conversationId = validateIdParam(req, res)
    if (!conversationId) return
    const lastEventId = (req.headers['last-event-id'] as string) || undefined

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    })

    // Buffer live events received during replay so none are lost or duplicated
    const buffer: AgentEventRecord[] = []
    let closed = false

    const unsubscribe = this.agentManager.subscribe(conversationId, (event) => {
      if (closed) return
      buffer.push(event)
    })

    // Replay persisted events in sequence order
    const events = await this.eventRepo.findByConversation(conversationId, lastEventId)
    let watermark = 0
    for (const event of events) {
      this.writeSseEvent(res, event)
      const seq = Number(event.event_sequence)
      if (Number.isFinite(seq) && seq > watermark) watermark = seq
    }

    // Flush buffered live events that are newer than the replay watermark
    for (const event of buffer) {
      const seq = Number(event.event_sequence)
      if (Number.isFinite(seq) && seq > watermark) {
        this.writeSseEvent(res, event)
        if (seq > watermark) watermark = seq
      }
    }

    // Check if the run is already terminal
    const run = this.agentManager.getStatus(conversationId)
    const isTerminal = run && (run.status === 'completed' || run.status === 'failed' || run.status === 'stopped')

    if (isTerminal) {
      // The terminal status event was already replayed or buffered; just close
      unsubscribe()
      res.end()
      return
    }

    // Continue listening for live events
    const flushBuffer = () => {
      while (buffer.length > 0) {
        const event = buffer.shift()!
        const seq = Number(event.event_sequence)
        if (Number.isFinite(seq) && seq > watermark) {
          this.writeSseEvent(res, event)
          if (seq > watermark) watermark = seq
          // Close on terminal status
          if (event.event_type === 'status') {
            const content = event.content ? JSON.parse(event.content) : {}
            if (content.status === 'completed' || content.status === 'failed' || content.status === 'stopped') {
              closed = true
              unsubscribe()
              res.end()
              return
            }
          }
        }
      }
    }

    // Replace the subscriber with one that writes directly
    unsubscribe()
    const liveUnsubscribe = this.agentManager.subscribe(conversationId, (event) => {
      if (closed) return
      buffer.push(event)
      flushBuffer()
    })

    req.on('close', () => {
      closed = true
      liveUnsubscribe()
    })
  }

  private writeSseEvent(res: Response, event: AgentEventRecord): void {
    res.write(`id: ${event.event_sequence}\n`)
    res.write(`event: ${event.event_type}\n`)
    res.write(`data: ${event.content ?? ''}\n\n`)
  }
}
