export default defineNuxtRouteMiddleware(async (to) => {
  const { fetchUser, user } = useAuth()
  const publicPaths = ['/login']

  if (publicPaths.includes(to.path)) return

  if (!user.value) {
    await fetchUser()
    if (!user.value) {
      return navigateTo('/login')
    }
  }
})
