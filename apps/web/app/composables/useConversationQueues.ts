interface QueuedMessage {
  id: string
  content: string
}

const STORAGE_PREFIX = 'conversation-queue:'
const hasLocalStorage = () => typeof localStorage !== 'undefined'

const queues = ref<Record<string, QueuedMessage[]>>({})
let loaded = false

function load() {
  if (loaded || !hasLocalStorage()) return
  loaded = true
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key && key.startsWith(STORAGE_PREFIX)) {
      const id = key.slice(STORAGE_PREFIX.length)
      try {
        const raw = localStorage.getItem(key)
        queues.value[id] = raw ? (JSON.parse(raw) as QueuedMessage[]) : []
      } catch {
        queues.value[id] = []
      }
    }
  }
}

function persist(id: string, value: QueuedMessage[]) {
  if (!hasLocalStorage()) return
  if (value.length === 0) {
    localStorage.removeItem(`${STORAGE_PREFIX}${id}`)
  } else {
    localStorage.setItem(`${STORAGE_PREFIX}${id}`, JSON.stringify(value))
  }
}

export function useConversationQueues() {
  load()

  return {
    queues,
    getQueue: (id: string) => queues.value[id] ?? [],
    setQueue: (id: string, value: QueuedMessage[]) => {
      if (value.length === 0) {
        delete queues.value[id]
      } else {
        queues.value[id] = value
      }
      persist(id, value)
    },
    clearQueue: (id: string) => {
      delete queues.value[id]
      if (hasLocalStorage()) localStorage.removeItem(`${STORAGE_PREFIX}${id}`)
    },
  }
}
