export function useSSE() {
  function connect(
    conversationId: string,
    onEvent: (event: { type: string; data: string }) => void,
    onOpen?: () => void,
  ): EventSource {
    // Relative URL — same origin, proxied by Nuxt in dev
    const url = `/api/conversations/${conversationId}/events`
    const es = new EventSource(url, { withCredentials: true })

    es.onopen = () => onOpen?.()

    es.addEventListener('status', (e) => {
      onEvent({ type: 'status', data: (e as MessageEvent).data })
    })

    es.addEventListener('output', (e) => {
      onEvent({ type: 'output', data: (e as MessageEvent).data })
    })

    es.onerror = () => {
      // Browser will auto-reconnect
    }

    return es
  }

  return { connect }
}
