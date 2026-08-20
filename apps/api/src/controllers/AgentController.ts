import type { Request, Response } from 'express'
import { isValidUuid } from '@jheckbot/shared'
import { AgentManager, AgentManagerError } from '../agent/AgentManager.js'
import { AgentEventRepository } from '../repositories/AgentEventRepository.js'

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
      const run = await this.agentManager.start({
        conversationId,
        projectId: req.body.projectId,
        prompt: req.body.prompt,
        devinSessionId: req.body.devinSessionId,
      })
      // Persist status event
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

    // Send replay of missed events
    const events = await this.eventRepo.findByConversation(conversationId, lastEventId)
    for (const event of events) {
      res.write(`id: ${event.id}\n`)
      res.write(`event: ${event.event_type}\n`)
      res.write(`data: ${event.content ?? ''}\n\n`)
    }

    // Stream live output if agent is running
    const run = this.agentManager.getStatus(conversationId)
    if (run && (run.status === 'running' || run.status === 'starting')) {
      let lastLineCount = 0
      const interval = setInterval(async () => {
        const currentRun = this.agentManager.getStatus(conversationId)
        if (!currentRun || currentRun.status === 'completed' || currentRun.status === 'failed' || currentRun.status === 'stopped') {
          clearInterval(interval)
          res.write(`event: status\ndata: ${JSON.stringify({ status: currentRun?.status ?? 'unknown' })}\n\n`)
          res.end()
          return
        }
        const output = this.agentManager.getOutput(conversationId)
        const newLines = output.slice(lastLineCount)
        lastLineCount = output.length
        for (const line of newLines) {
          if (line.trim()) {
            const event = await this.eventRepo.create({
              conversationId,
              eventType: 'output',
              content: JSON.stringify({ content: line }),
            })
            res.write(`id: ${event.id}\n`)
            res.write(`event: output\n`)
            res.write(`data: ${JSON.stringify({ content: line })}\n\n`)
          }
        }
      }, 1000)

      req.on('close', () => {
        clearInterval(interval)
      })
    } else {
      // No active run — just send replay and close
      res.write(`event: status\ndata: ${JSON.stringify({ status: 'idle' })}\n\n`)
      res.end()
    }
  }
}
