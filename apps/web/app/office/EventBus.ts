import type { OfficeEvent, OfficeEventHandler } from './types'

// Minimal typed pub/sub. The simulation/runtime publishes; the renderer
// subscribes. Keeps the visual layer decoupled from AI logic (spec §27/§28).
export class EventBus {
  private handlers = new Set<OfficeEventHandler>()

  on(handler: OfficeEventHandler): () => void {
    this.handlers.add(handler)
    return () => this.handlers.delete(handler)
  }

  emit(event: OfficeEvent): void {
    for (const handler of this.handlers) handler(event)
  }

  clear(): void {
    this.handlers.clear()
  }
}
