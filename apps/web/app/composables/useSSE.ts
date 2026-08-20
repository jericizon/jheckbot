export function useSSE() {
  const config = useRuntimeConfig()
  const baseURL = config.public.apiBase as string

  function connect(
    conversationId: string,
    onEvent: (event: { type: string; data: string }) => void,
    onOpen?: () => void,
  ): EventSource {
    const url = `${baseURL}/api/conversations/${conversationId}/events`
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
