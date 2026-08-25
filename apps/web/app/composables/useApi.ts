export function useApi() {
  // Use relative paths so requests go through the Nuxt proxy (no CORS)
  // In dev, Nuxt proxies /api/** to the Express API at localhost:8801
  async function request<T>(
    path: string,
    options: { method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'; body?: Record<string, unknown>; query?: Record<string, string> } = {},
  ): Promise<T> {
    const method = options.method ?? 'GET'
    const tag = `%c[${method}] ${path}`
    const tagStyle = 'color: #6366f1; font-weight: 600'

    if (options.body) console.log(tag, tagStyle, 'payload →', options.body)
    else console.log(tag, tagStyle)

    const res = await $fetch<T>(path, {
      method,
      body: options.body as Record<string, unknown> | undefined,
      query: options.query,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    })

    console.log(`%c[${method}] ${path} ✓`, 'color: #22c55e; font-weight: 600', 'response ←', res)
    return res
  }

  return {
    get: <T>(path: string, query?: Record<string, string>) => request<T>(path, { query }),
    post: <T>(path: string, body?: Record<string, unknown>) => request<T>(path, { method: 'POST', body }),
    patch: <T>(path: string, body?: Record<string, unknown>) => request<T>(path, { method: 'PATCH', body }),
    delete: <T>(path: string, body?: Record<string, unknown>) => request<T>(path, { method: 'DELETE', body }),
  }
}
