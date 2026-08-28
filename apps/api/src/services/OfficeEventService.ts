import { EventEmitter } from 'node:events'
import type { EventType, OfficeEvent } from '@jheckbot/shared'
import { OfficeEventRepository, type OfficeEventCreateData } from '../repositories/OfficeEventRepository.js'

export interface CreateOfficeEventInput {
  officeId: string
  eventType: EventType
  content?: string | null
  metadata?: Record<string, unknown> | null
}

export type OfficeEventListener = (event: OfficeEvent) => void

export class OfficeEventService {
  private emitter = new EventEmitter()

  constructor(private repo: OfficeEventRepository) {
    this.emitter.setMaxListeners(1000)
  }

  async create(input: CreateOfficeEventInput): Promise<OfficeEvent> {
    const event = await this.repo.create({
      officeId: input.officeId,
      eventType: input.eventType,
      content: input.content ?? null,
      metadata: input.metadata ?? null,
    } as OfficeEventCreateData)
    this.emitter.emit(event.officeId, event)
    return event
  }

  async getById(id: string): Promise<OfficeEvent | null> {
    return this.repo.getById(id)
  }

  async listByOffice(officeId: string): Promise<OfficeEvent[]> {
    return this.repo.listByOffice(officeId)
  }

  subscribe(officeId: string, listener: OfficeEventListener): () => void {
    this.emitter.on(officeId, listener)
    return () => this.emitter.off(officeId, listener)
  }

  emit(event: OfficeEvent): void {
    this.emitter.emit(event.officeId, event)
  }
}
