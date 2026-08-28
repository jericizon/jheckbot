// Periodically refresh a project's conversation list so background agent
// runs (starting/running/stopping) are reflected in the sidebar without a
// manual reload. Polls only while the document is visible.
export function useConversationPolling(
  projectId: () => string | null | undefined,
  onRefresh: (conversations: any[]) => void,
  intervalMs = 8000,
) {
  let timer: ReturnType<typeof setInterval> | null = null

  async function tick() {
    if (typeof document !== 'undefined' && document.hidden) return
    const pid = projectId()
    if (!pid) return
    try {
      const convApi = useConversations()
      const convs = await convApi.listByProject(pid)
      onRefresh(convs)
    } catch {
      // ignore — next tick will retry
    }
  }

  function start() {
    if (timer) return
    timer = setInterval(tick, intervalMs)
  }

  function stop() {
    if (timer) {
      clearInterval(timer)
      timer = null
    }
  }

  onMounted(start)
  onUnmounted(stop)

  return { start, stop, refresh: tick }
}
