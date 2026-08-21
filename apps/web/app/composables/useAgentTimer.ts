import { ref, computed } from 'vue'

export function useAgentTimer() {
  const runStartTime = ref<number | null>(null)
  const lastRunDuration = ref<number | null>(null)
  const elapsed = ref(0)
  let intervalId: ReturnType<typeof setInterval> | null = null

  function tick() {
    if (runStartTime.value === null) return
    elapsed.value = Math.floor((Date.now() - runStartTime.value) / 1000)
  }

  function start(startedAtMs?: number) {
    stop()
    const now = Date.now()
    const startTime = startedAtMs ?? now
    runStartTime.value = startTime
    lastRunDuration.value = null
    elapsed.value = Math.floor((now - startTime) / 1000)
    intervalId = setInterval(tick, 1000)
  }

  function stop() {
    if (runStartTime.value !== null) {
      lastRunDuration.value = Math.floor((Date.now() - runStartTime.value) / 1000)
    }
    if (intervalId) {
      clearInterval(intervalId)
      intervalId = null
    }
    runStartTime.value = null
  }

  function reset() {
    stop()
    lastRunDuration.value = null
    elapsed.value = 0
  }

  return {
    elapsedSeconds: elapsed,
    lastRunDuration,
    isRunning: computed(() => runStartTime.value !== null),
    start,
    stop,
    reset,
  }
}
