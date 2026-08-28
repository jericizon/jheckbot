const STORAGE_PREFIX = 'conversation-logs-open:'
const hasLocalStorage = () => typeof localStorage !== 'undefined'

const prefs = ref<Record<string, boolean>>({})
let loaded = false

function load() {
  if (loaded || !hasLocalStorage()) return
  loaded = true
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key && key.startsWith(STORAGE_PREFIX)) {
      const id = key.slice(STORAGE_PREFIX.length)
      prefs.value[id] = localStorage.getItem(key) === '1'
    }
  }
}

export function useConversationLogsOpen() {
  load()

  return {
    prefs,
    getLogsOpen: (id: string) => prefs.value[id] ?? false,
    hasLogsOpenPreference: (id: string) => id in prefs.value,
    setLogsOpen: (id: string, value: boolean) => {
      prefs.value[id] = value
      if (hasLocalStorage()) localStorage.setItem(`${STORAGE_PREFIX}${id}`, value ? '1' : '0')
    },
    clearLogsOpen: (id: string) => {
      delete prefs.value[id]
      if (hasLocalStorage()) localStorage.removeItem(`${STORAGE_PREFIX}${id}`)
    },
  }
}
