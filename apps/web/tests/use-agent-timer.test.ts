import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useAgentTimer } from '../app/composables/useAgentTimer'

describe('useAgentTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts at 0s and increments each second', () => {
    const { elapsedSeconds, start } = useAgentTimer()
    start()
    expect(elapsedSeconds.value).toBe(0)
    vi.advanceTimersByTime(1000)
    expect(elapsedSeconds.value).toBe(1)
    vi.advanceTimersByTime(3000)
    expect(elapsedSeconds.value).toBe(4)
  })

  it('captures lastRunDuration on stop', () => {
    const { elapsedSeconds, lastRunDuration, start, stop } = useAgentTimer()
    start()
    vi.advanceTimersByTime(40000)
    stop()
    expect(lastRunDuration.value).toBe(40)
    expect(elapsedSeconds.value).toBe(40)
  })

  it('resets when starting a new run', () => {
    const { elapsedSeconds, lastRunDuration, start } = useAgentTimer()
    start()
    vi.advanceTimersByTime(5000)
    start()
    expect(lastRunDuration.value).toBeNull()
    expect(elapsedSeconds.value).toBe(0)
    vi.advanceTimersByTime(2000)
    expect(elapsedSeconds.value).toBe(2)
  })

  it('can start from a provided timestamp', () => {
    const { elapsedSeconds, start } = useAgentTimer()
    const startedAt = Date.now() - 25000
    start(startedAt)
    expect(elapsedSeconds.value).toBe(25)
    vi.advanceTimersByTime(5000)
    expect(elapsedSeconds.value).toBe(30)
  })

  it('clears the previous interval on restart', () => {
    const { elapsedSeconds, start } = useAgentTimer()
    start()
    vi.advanceTimersByTime(1000)
    start()
    vi.advanceTimersByTime(1000)
    expect(elapsedSeconds.value).toBe(1)
  })

  it('stops and preserves lastRunDuration on reset', () => {
    const { elapsedSeconds, lastRunDuration, start, reset } = useAgentTimer()
    start()
    vi.advanceTimersByTime(3000)
    reset()
    expect(lastRunDuration.value).toBeNull()
    expect(elapsedSeconds.value).toBe(0)
  })
})
