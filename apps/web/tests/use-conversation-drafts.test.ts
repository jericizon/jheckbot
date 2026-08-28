import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref } from 'vue'

// Composable uses Nuxt auto-imports; provide the same globals in the node env.
function createLocalStorage() {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { store = {} },
    get length() { return Object.keys(store).length },
    key: (index: number) => Object.keys(store)[index] ?? null,
  }
}

describe('useConversationDrafts', () => {
  beforeEach(() => {
    ;(globalThis as Record<string, unknown>).ref = ref
    ;(globalThis as Record<string, unknown>).localStorage = createLocalStorage()
    vi.resetModules()
  })

  afterEach(() => {
    delete (globalThis as Record<string, unknown>).ref
    delete (globalThis as Record<string, unknown>).localStorage
    vi.resetModules()
  })

  it('returns empty draft for a conversation with no saved text', async () => {
    const { useConversationDrafts } = await import('../app/composables/useConversationDrafts')
    const { getDraft, hasDraft } = useConversationDrafts()

    expect(getDraft('conv-1')).toBe('')
    expect(hasDraft('conv-1')).toBe(false)
  })

  it('stores a draft and persists it to localStorage', async () => {
    const { useConversationDrafts } = await import('../app/composables/useConversationDrafts')
    const { setDraft, getDraft, hasDraft } = useConversationDrafts()

    setDraft('conv-1', 'Unsent message')

    expect(getDraft('conv-1')).toBe('Unsent message')
    expect(hasDraft('conv-1')).toBe(true)
    expect(localStorage.getItem('conversation-draft:conv-1')).toBe('Unsent message')
  })

  it('removes the draft when set to empty string', async () => {
    const { useConversationDrafts } = await import('../app/composables/useConversationDrafts')
    const { setDraft, hasDraft } = useConversationDrafts()

    setDraft('conv-1', 'Unsent message')
    setDraft('conv-1', '')

    expect(hasDraft('conv-1')).toBe(false)
    expect(localStorage.getItem('conversation-draft:conv-1')).toBeNull()
  })

  it('clears a draft explicitly', async () => {
    const { useConversationDrafts } = await import('../app/composables/useConversationDrafts')
    const { setDraft, clearDraft, hasDraft } = useConversationDrafts()

    setDraft('conv-1', 'Unsent message')
    clearDraft('conv-1')

    expect(hasDraft('conv-1')).toBe(false)
    expect(localStorage.getItem('conversation-draft:conv-1')).toBeNull()
  })

  it('shares state across separate component instances', async () => {
    const { useConversationDrafts } = await import('../app/composables/useConversationDrafts')
    const sidebar = useConversationDrafts()
    sidebar.setDraft('conv-1', 'Sidebar typed this')

    vi.resetModules()
    const { useConversationDrafts: useConversationDrafts2 } = await import('../app/composables/useConversationDrafts')
    const chat = useConversationDrafts2()

    expect(chat.getDraft('conv-1')).toBe('Sidebar typed this')
    expect(chat.hasDraft('conv-1')).toBe(true)
  })

  it('loads existing localStorage drafts on first call', async () => {
    localStorage.setItem('conversation-draft:conv-1', 'From previous session')

    const { useConversationDrafts } = await import('../app/composables/useConversationDrafts')
    const { getDraft, hasDraft } = useConversationDrafts()

    expect(getDraft('conv-1')).toBe('From previous session')
    expect(hasDraft('conv-1')).toBe(true)
  })
})
