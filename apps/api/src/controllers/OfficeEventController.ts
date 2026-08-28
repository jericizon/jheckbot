import type { Request, Response } from 'express'
import type { OfficeEvent } from '@jheckbot/shared'
import { isValidEventType, isValidUuid } from '@jheckbot/shared'
import { OfficeEventService } from '../services/OfficeEventService.js'

function getParam(req: Request, name: string): string {
  const value = req.params[name]
  return Array.isArray(value) ? value[0] : value ?? ''
}

function validateIdParam(req: Request, res: Response, name = 'id'): string | null {
  const value = getParam(req, name)
  if (!isValidUuid(value)) {
    res.status(400).json({ error: `Invalid ${name} format` })
    return null
  }
  return value
}

export class OfficeEventController {
  constructor(private service: OfficeEventService) {}

  async listByOffice(req: Request, res: Response): Promise<void> {
    const officeId = validateIdParam(req, res, 'officeId')
    if (!officeId) return

    const events = await this.service.listByOffice(officeId)
    res.json(events)
  }

  async get(req: Request, res: Response): Promise<void> {
    const id = validateIdParam(req, res)
    if (!id) return

    const event = await this.service.getById(id)
    if (!event) {
      res.status(404).json({ error: 'Event not found' })
      return
    }
    res.json(event)
  }

  async create(req: Request, res: Response): Promise<void> {
    const officeId = validateIdParam(req, res, 'officeId')
    if (!officeId) return

    const body = typeof req.body === 'object' && req.body !== null ? req.body : {}
    if (!isValidEventType(body.eventType)) {
      res.status(400).json({ error: 'Invalid eventType' })
      return
    }

    const event = await this.service.create({
      officeId,
      eventType: body.eventType,
      content: body.content ?? null,
      metadata: body.metadata ?? null,
    })
    res.status(201).json(event)
  }

  async stream(req: Request, res: Response): Promise<void> {
    const officeId = validateIdParam(req, res, 'officeId')
    if (!officeId) return

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    })
    res.socket?.setNoDelay?.(true)

    let closed = false
    const buffer: OfficeEvent[] = []

    const unsubscribe = this.service.subscribe(officeId, (event) => {
      if (closed) return
      buffer.push(event)
    })

    const events = await this.service.listByOffice(officeId)
    // Replay in chronological order (oldest first).
    for (const event of events.slice().reverse()) {
      this.writeSseEvent(res, event)
    }

    // Flush any live events that arrived during replay.
    for (const event of buffer) {
      this.writeSseEvent(res, event)
    }

    const writeNext = () => {
      while (buffer.length > 0) {
        const event = buffer.shift()!
        this.writeSseEvent(res, event)
      }
    }

    unsubscribe()
    const liveUnsubscribe = this.service.subscribe(officeId, (event) => {
      if (closed) return
      buffer.push(event)
      writeNext()
    })

    req.on('close', () => {
      closed = true
      liveUnsubscribe()
      res.end()
    })
  }

  private writeSseEvent(res: Response, event: OfficeEvent): void {
    res.write(`id: ${event.id}\n`)
    res.write('event: office\n')
    res.write(`data: ${JSON.stringify(event)}\n\n`)
    ;(res as Response & { flush?: () => void }).flush?.()
  }
}
