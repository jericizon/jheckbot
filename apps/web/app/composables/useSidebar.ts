// Shared sidebar state across pages, persisted to localStorage
const sidebarOpen = ref(false)
let initialized = false

function init() {
  if (initialized || !import.meta.client) return
  initialized = true
  const stored = localStorage.getItem('sidebarOpen')
  if (stored !== null) {
    sidebarOpen.value = stored === 'true'
  } else {
    sidebarOpen.value = window.innerWidth >= 768
  }
}

export function useSidebar() {
  if (import.meta.client) init()

  function toggle() {
    sidebarOpen.value = !sidebarOpen.value
    if (import.meta.client) {
      localStorage.setItem('sidebarOpen', String(sidebarOpen.value))
    }
  }

  function close() {
    sidebarOpen.value = false
    if (import.meta.client) {
      localStorage.setItem('sidebarOpen', 'false')
    }
  }

  return {
    sidebarOpen: readonly(sidebarOpen),
    toggle,
    close,
  }
}
