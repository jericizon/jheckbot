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

interface QueuedMessage { id: string; content: string }

describe('useConversationQueues', () => {
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

  it('returns an empty queue for a conversation with no saved queue', async () => {
    const { useConversationQueues } = await import('../app/composables/useConversationQueues')
    const { getQueue } = useConversationQueues()

    expect(getQueue('conv-1')).toEqual([])
  })

  it('stores a queue and persists it to localStorage as JSON', async () => {
    const { useConversationQueues } = await import('../app/composables/useConversationQueues')
    const { setQueue, getQueue } = useConversationQueues()

    const queue: QueuedMessage[] = [{ id: 'q-1', content: 'hello' }]
    setQueue('conv-1', queue)

    expect(getQueue('conv-1')).toEqual(queue)
    expect(localStorage.getItem('conversation-queue:conv-1')).toBe(JSON.stringify(queue))
  })

  it('removes the queue when set to an empty array', async () => {
    const { useConversationQueues } = await import('../app/composables/useConversationQueues')
    const { setQueue, getQueue } = useConversationQueues()

    setQueue('conv-1', [{ id: 'q-1', content: 'hello' }])
    setQueue('conv-1', [])

    expect(getQueue('conv-1')).toEqual([])
    expect(localStorage.getItem('conversation-queue:conv-1')).toBeNull()
  })

  it('clears a queue explicitly', async () => {
    const { useConversationQueues } = await import('../app/composables/useConversationQueues')
    const { setQueue, clearQueue, getQueue } = useConversationQueues()

    setQueue('conv-1', [{ id: 'q-1', content: 'hello' }])
    clearQueue('conv-1')

    expect(getQueue('conv-1')).toEqual([])
    expect(localStorage.getItem('conversation-queue:conv-1')).toBeNull()
  })

  it('shares state across separate component instances', async () => {
    const { useConversationQueues } = await import('../app/composables/useConversationQueues')
    const sidebar = useConversationQueues()
    const queue: QueuedMessage[] = [{ id: 'q-1', content: 'hello' }]
    sidebar.setQueue('conv-1', queue)

    vi.resetModules()
    const { useConversationQueues: useConversationQueues2 } = await import('../app/composables/useConversationQueues')
    const chat = useConversationQueues2()

    expect(chat.getQueue('conv-1')).toEqual(queue)
  })

  it('loads existing localStorage queues on first call', async () => {
    const queue: QueuedMessage[] = [{ id: 'q-1', content: 'from before' }]
    localStorage.setItem('conversation-queue:conv-1', JSON.stringify(queue))

    const { useConversationQueues } = await import('../app/composables/useConversationQueues')
    const { getQueue } = useConversationQueues()

    expect(getQueue('conv-1')).toEqual(queue)
  })

  it('isolation between conversations', async () => {
    const { useConversationQueues } = await import('../app/composables/useConversationQueues')
    const { setQueue, getQueue } = useConversationQueues()

    setQueue('conv-1', [{ id: 'q-1', content: 'one' }])
    setQueue('conv-2', [{ id: 'q-2', content: 'two' }])

    expect(getQueue('conv-1')).toEqual([{ id: 'q-1', content: 'one' }])
    expect(getQueue('conv-2')).toEqual([{ id: 'q-2', content: 'two' }])
  })
})
