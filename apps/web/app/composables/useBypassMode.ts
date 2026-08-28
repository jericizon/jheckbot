// Shared bypass-mode toggle across pages, persisted to localStorage.
// Defaults to ON so Devin auto-approves tools unless the user explicitly turns it off.
const bypassMode = ref(true)
let initialized = false

function init() {
  if (initialized || !import.meta.client) return
  initialized = true
  const stored = localStorage.getItem('bypassMode')
  if (stored !== null) {
    bypassMode.value = stored === 'true'
  }
}

export function useBypassMode() {
  if (import.meta.client) init()

  function toggle() {
    bypassMode.value = !bypassMode.value
    if (import.meta.client) {
      localStorage.setItem('bypassMode', String(bypassMode.value))
    }
  }

  function set(value: boolean) {
    bypassMode.value = value
    if (import.meta.client) {
      localStorage.setItem('bypassMode', String(value))
    }
  }

  return {
    bypassMode: readonly(bypassMode),
    toggle,
    set,
  }
}
