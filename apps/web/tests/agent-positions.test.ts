import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearAgentTile,
  getSavedAgentTile,
  saveAgentTile,
} from '../app/utils/agentPositions'

// Minimal in-memory localStorage stub. The vitest environment is node, so the
// utility's `typeof localStorage !== 'undefined'` guard would otherwise short
// circuit to null. We install a Storage-shaped object on the global before
// each test and remove it after.
class MemoryStorage {
  private store = new Map<string, string>()
  getItem(k: string): string | null {
    return this.store.has(k) ? (this.store.get(k) as string) : null
  }
  setItem(k: string, v: string): void {
    this.store.set(k, v)
  }
  removeItem(k: string): void {
    this.store.delete(k)
  }
  clear(): void {
    this.store.clear()
  }
}

function installLocalStorage(): MemoryStorage {
  const s = new MemoryStorage()
  Object.defineProperty(globalThis, 'localStorage', {
    value: s,
    configurable: true,
    writable: true,
  })
  return s
}

describe('agentPositions', () => {
  let storage: MemoryStorage

  beforeEach(() => {
    storage = installLocalStorage()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    // @ts-expect-error removing the stub for isolation
    delete (globalThis as { localStorage?: unknown }).localStorage
  })

  it('returns null when no position is saved', () => {
    expect(getSavedAgentTile('agent-1')).toBeNull()
  })

  it('round-trips a tile through save and get', () => {
    saveAgentTile('agent-1', { x: 6, y: 5 })
    expect(getSavedAgentTile('agent-1')).toEqual({ x: 6, y: 5 })
  })

  it('stores each agent independently', () => {
    saveAgentTile('agent-1', { x: 1, y: 2 })
    saveAgentTile('agent-2', { x: 3, y: 4 })
    expect(getSavedAgentTile('agent-1')).toEqual({ x: 1, y: 2 })
    expect(getSavedAgentTile('agent-2')).toEqual({ x: 3, y: 4 })
  })

  it('clear removes a saved tile', () => {
    saveAgentTile('agent-1', { x: 6, y: 5 })
    clearAgentTile('agent-1')
    expect(getSavedAgentTile('agent-1')).toBeNull()
  })

  it('drops a corrupt entry and returns null', () => {
    storage.setItem('jheckbot:office:agent-pos:agent-1', '{not json')
    expect(getSavedAgentTile('agent-1')).toBeNull()
    // The corrupt entry is removed so it never blocks the default intro.
    expect(storage.getItem('jheckbot:office:agent-pos:agent-1')).toBeNull()
  })

  it('rejects non-numeric coordinates', () => {
    storage.setItem(
      'jheckbot:office:agent-pos:agent-1',
      JSON.stringify({ x: 'a', y: 5 }),
    )
    expect(getSavedAgentTile('agent-1')).toBeNull()
  })

  it('rejects non-finite coordinates', () => {
    storage.setItem(
      'jheckbot:office:agent-pos:agent-1',
      JSON.stringify({ x: Number.POSITIVE_INFINITY, y: 5 }),
    )
    expect(getSavedAgentTile('agent-1')).toBeNull()
  })

  it('fails soft when localStorage throws on read', () => {
    vi.spyOn(storage, 'getItem').mockImplementation(() => {
      throw new Error('denied')
    })
    expect(getSavedAgentTile('agent-1')).toBeNull()
  })

  it('fails soft when localStorage throws on write', () => {
    vi.spyOn(storage, 'setItem').mockImplementation(() => {
      throw new Error('quota')
    })
    expect(() => saveAgentTile('agent-1', { x: 1, y: 1 })).not.toThrow()
  })
})
