import type { OfficeTask } from '@jheckbot/shared'

export function useTasks() {
  const api = useApi()

  return {
    listByOffice: (officeId: string) =>
      api.get<OfficeTask[]>(`/api/offices/${officeId}/tasks`),

    get: (id: string) => api.get<OfficeTask>(`/api/tasks/${id}`),
  }
}
