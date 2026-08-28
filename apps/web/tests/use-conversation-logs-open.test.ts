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

describe('useConversationLogsOpen', () => {
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

  it('defaults to closed with no preference for a new conversation', async () => {
    const { useConversationLogsOpen } = await import('../app/composables/useConversationLogsOpen')
    const { getLogsOpen, hasLogsOpenPreference } = useConversationLogsOpen()

    expect(getLogsOpen('conv-1')).toBe(false)
    expect(hasLogsOpenPreference('conv-1')).toBe(false)
  })

  it('persists an explicit preference to localStorage', async () => {
    const { useConversationLogsOpen } = await import('../app/composables/useConversationLogsOpen')
    const { setLogsOpen, getLogsOpen, hasLogsOpenPreference } = useConversationLogsOpen()

    setLogsOpen('conv-1', false)

    expect(getLogsOpen('conv-1')).toBe(false)
    expect(hasLogsOpenPreference('conv-1')).toBe(true)
    expect(localStorage.getItem('conversation-logs-open:conv-1')).toBe('0')
  })

  it('stores an open preference as "1"', async () => {
    const { useConversationLogsOpen } = await import('../app/composables/useConversationLogsOpen')
    const { setLogsOpen, getLogsOpen } = useConversationLogsOpen()

    setLogsOpen('conv-1', true)

    expect(getLogsOpen('conv-1')).toBe(true)
    expect(localStorage.getItem('conversation-logs-open:conv-1')).toBe('1')
  })

  it('restores a hidden preference from localStorage on load', async () => {
    localStorage.setItem('conversation-logs-open:conv-1', '0')

    const { useConversationLogsOpen } = await import('../app/composables/useConversationLogsOpen')
    const { getLogsOpen, hasLogsOpenPreference } = useConversationLogsOpen()

    expect(getLogsOpen('conv-1')).toBe(false)
    expect(hasLogsOpenPreference('conv-1')).toBe(true)
  })

  it('restores an open preference from localStorage on load', async () => {
    localStorage.setItem('conversation-logs-open:conv-1', '1')

    const { useConversationLogsOpen } = await import('../app/composables/useConversationLogsOpen')
    const { getLogsOpen, hasLogsOpenPreference } = useConversationLogsOpen()

    expect(getLogsOpen('conv-1')).toBe(true)
    expect(hasLogsOpenPreference('conv-1')).toBe(true)
  })

  it('clearLogsOpen removes the preference', async () => {
    const { useConversationLogsOpen } = await import('../app/composables/useConversationLogsOpen')
    const { setLogsOpen, clearLogsOpen, hasLogsOpenPreference } = useConversationLogsOpen()

    setLogsOpen('conv-1', false)
    clearLogsOpen('conv-1')

    expect(hasLogsOpenPreference('conv-1')).toBe(false)
    expect(localStorage.getItem('conversation-logs-open:conv-1')).toBeNull()
  })

  it('shares state across separate component instances', async () => {
    const { useConversationLogsOpen } = await import('../app/composables/useConversationLogsOpen')
    const first = useConversationLogsOpen()
    first.setLogsOpen('conv-1', false)

    vi.resetModules()
    const { useConversationLogsOpen: useConversationLogsOpen2 } = await import('../app/composables/useConversationLogsOpen')
    const second = useConversationLogsOpen2()

    expect(second.getLogsOpen('conv-1')).toBe(false)
    expect(second.hasLogsOpenPreference('conv-1')).toBe(true)
  })
})
