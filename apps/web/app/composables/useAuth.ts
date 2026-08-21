interface User {
  id: string
  username: string
}

export function useAuth() {
  const user = useState<User | null>('user', () => null)

  async function login(username: string, password: string): Promise<boolean> {
    try {
      const res = await $fetch<User>('/api/auth/login', {
        method: 'POST',
        body: { username, password },
        credentials: 'include',
      })
      user.value = res
      return true
    } catch {
      return false
    }
  }

  async function logout(): Promise<void> {
    try {
      await $fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      })
    } catch {
      // ignore
    }
    user.value = null
    await navigateTo('/login')
  }

  async function fetchUser(): Promise<void> {
    try {
      // Forward the incoming request cookie during SSR so the API
      // can authenticate the server-side render.
      const headers = import.meta.server
        ? useRequestHeaders(['cookie'])
        : undefined
      const res = await $fetch<User>('/api/auth/me', {
        credentials: 'include',
        headers,
      })
      user.value = res
    } catch {
      user.value = null
    }
  }

  return { user, login, logout, fetchUser }
}
