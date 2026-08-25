// Polls active conversations across all projects so the sidebar's "Active"
// section reflects background agent runs without a manual reload. Polls only
// while the document is visible. Shared across pages via a module-level ref.

interface ActiveConversation {
  id: string
  project_id: string
  project_name: string
  title: string
  agent_status: string
  is_pinned: boolean
}

const activeConversations = ref<ActiveConversation[]>([])
let timer: ReturnType<typeof setInterval> | null = null
let started = false

const POLL_INTERVAL = 8000

async function tick() {
  if (typeof document !== 'undefined' && document.hidden) return
  try {
    const convApi = useConversations()
    activeConversations.value = await convApi.listActive()
  } catch {
    // ignore — next tick will retry
  }
}

function start() {
  if (started) return
  started = true
  tick()
  timer = setInterval(tick, POLL_INTERVAL)
}

export function useActiveConversations() {
  onMounted(start)
  onUnmounted(() => {
    // Keep polling across page navigations; only stop when the last consumer
    // unmounts. A simple ref-count could be added, but the interval is cheap
    // and the sidebar is used on every authenticated page.
  })

  return {
    activeConversations,
    refresh: tick,
  }
}
