export function useApi() {
  // Use relative paths so requests go through the Nuxt proxy (no CORS)
  // In dev, Nuxt proxies /api/** to the Express API at localhost:8801
  async function request<T>(
    path: string,
    options: { method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'; body?: Record<string, unknown> } = {},
  ): Promise<T> {
    const res = await $fetch<T>(path, {
      method: options.method ?? 'GET',
      body: options.body as Record<string, unknown> | undefined,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    })
    return res
  }

  return {
    get: <T>(path: string) => request<T>(path),
    post: <T>(path: string, body?: Record<string, unknown>) => request<T>(path, { method: 'POST', body }),
    patch: <T>(path: string, body?: Record<string, unknown>) => request<T>(path, { method: 'PATCH', body }),
    delete: <T>(path: string, body?: Record<string, unknown>) => request<T>(path, { method: 'DELETE', body }),
  }
}
