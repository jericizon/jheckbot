import type { EventType, OfficeEvent } from '@jheckbot/shared'
import { OfficeEventRepository, type OfficeEventCreateData } from '../repositories/OfficeEventRepository.js'

export interface CreateOfficeEventInput {
  officeId: string
  eventType: EventType
  content?: string | null
  metadata?: Record<string, unknown> | null
}

export class OfficeEventService {
  constructor(private repo: OfficeEventRepository) {}

  async create(input: CreateOfficeEventInput): Promise<OfficeEvent> {
    return this.repo.create({
      officeId: input.officeId,
      eventType: input.eventType,
      content: input.content ?? null,
      metadata: input.metadata ?? null,
    } as OfficeEventCreateData)
  }

  async listByOffice(officeId: string): Promise<OfficeEvent[]> {
    return this.repo.listByOffice(officeId)
  }
}
