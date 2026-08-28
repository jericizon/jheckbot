import type { OfficeEvent } from '@jheckbot/shared'

export function useOfficeEvents() {
  const api = useApi()

  return {
    listByOffice: (officeId: string) =>
      api.get<OfficeEvent[]>(`/api/offices/${officeId}/events`),

    get: (id: string) => api.get<OfficeEvent>(`/api/events/${id}`),
  }
}
