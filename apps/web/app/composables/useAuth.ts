interface User {
  id: string
  username: string
}

export function useAuth() {
  const user = useState<User | null>('user', () => null)
  const config = useRuntimeConfig()
  const baseURL = config.public.apiBase as string

  async function login(username: string, password: string): Promise<boolean> {
    try {
      const res = await $fetch<User>(`${baseURL}/api/auth/login`, {
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
      await $fetch(`${baseURL}/api/auth/logout`, {
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
      const res = await $fetch<User>(`${baseURL}/api/auth/me`, {
        credentials: 'include',
      })
      user.value = res
    } catch {
      user.value = null
    }
  }

  return { user, login, logout, fetchUser }
}
