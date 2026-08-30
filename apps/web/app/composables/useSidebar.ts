// Shared sidebar state across pages, persisted to localStorage
const sidebarOpen = ref(false)
const sidebarWidth = ref(256) // 16rem default
let initialized = false

const MIN_WIDTH = 200
const MAX_WIDTH = 480

function init() {
  if (initialized || !import.meta.client) return
  initialized = true
  const stored = localStorage.getItem('sidebarOpen')
  if (stored !== null) {
    sidebarOpen.value = stored === 'true'
  } else {
    sidebarOpen.value = window.innerWidth >= 768
  }
  const storedWidth = localStorage.getItem('sidebarWidth')
  if (storedWidth) {
    const w = parseInt(storedWidth, 10)
    if (!Number.isNaN(w) && w >= MIN_WIDTH && w <= MAX_WIDTH) {
      sidebarWidth.value = w
    }
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

  function setWidth(width: number) {
    const clamped = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, width))
    sidebarWidth.value = clamped
    if (import.meta.client) {
      localStorage.setItem('sidebarWidth', String(clamped))
    }
  }

  return {
    sidebarOpen: readonly(sidebarOpen),
    sidebarWidth: readonly(sidebarWidth),
    minSidebarWidth: MIN_WIDTH,
    maxSidebarWidth: MAX_WIDTH,
    toggle,
    close,
    setWidth,
  }
}
