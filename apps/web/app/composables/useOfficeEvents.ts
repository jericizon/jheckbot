import type { OfficeEvent } from '@jheckbot/shared'

export function useOfficeEvents() {
  const api = useApi()
  let es: EventSource | null = null

  return {
    listByOffice: (officeId: string) =>
      api.get<OfficeEvent[]>(`/api/offices/${officeId}/events`),

    get: (id: string) => api.get<OfficeEvent>(`/api/events/${id}`),

    subscribeToOffice(
      officeId: string,
      onEvent: (event: OfficeEvent) => void,
      onOpen?: () => void,
    ): () => void {
      if (es) {
        es.close()
        es = null
      }

      es = new EventSource(`/api/offices/${officeId}/events/stream`, {
        withCredentials: true,
      })

      es.onopen = () => onOpen?.()

      es.addEventListener('office', (e) => {
        try {
          const data = (e as MessageEvent).data
          const event: OfficeEvent = JSON.parse(data)
          onEvent(event)
        } catch {
          // Ignore malformed events.
        }
      })

      es.onerror = () => {
        // The browser will automatically reconnect on transient errors.
      }

      return () => {
        if (es) {
          es.close()
          es = null
        }
      }
    },

    close(): void {
      if (es) {
        es.close()
        es = null
      }
    },
  }
}
