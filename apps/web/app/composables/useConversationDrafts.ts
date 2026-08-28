const STORAGE_PREFIX = 'conversation-draft:'
const hasLocalStorage = () => typeof localStorage !== 'undefined'

const drafts = ref<Record<string, string>>({})
let loaded = false

function load() {
  if (loaded || !hasLocalStorage()) return
  loaded = true
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key && key.startsWith(STORAGE_PREFIX)) {
      const id = key.slice(STORAGE_PREFIX.length)
      drafts.value[id] = localStorage.getItem(key) ?? ''
    }
  }
}

export function useConversationDrafts() {
  load()

  return {
    drafts,
    getDraft: (id: string) => drafts.value[id] ?? '',
    hasDraft: (id: string) => (drafts.value[id] ?? '') !== '',
    setDraft: (id: string, value: string) => {
      if (value === '') {
        delete drafts.value[id]
        if (hasLocalStorage()) localStorage.removeItem(`${STORAGE_PREFIX}${id}`)
      } else {
        drafts.value[id] = value
        if (hasLocalStorage()) localStorage.setItem(`${STORAGE_PREFIX}${id}`, value)
      }
    },
    clearDraft: (id: string) => {
      delete drafts.value[id]
      if (hasLocalStorage()) localStorage.removeItem(`${STORAGE_PREFIX}${id}`)
    },
  }
}
