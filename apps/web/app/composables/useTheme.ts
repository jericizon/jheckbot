type Theme = 'light' | 'dark'

const theme = ref<Theme>('light')
let initialized = false

function applyTheme(t: Theme) {
  if (import.meta.client) {
    document.documentElement.classList.toggle('dark', t === 'dark')
  }
}

function initTheme() {
  if (initialized || !import.meta.client) return
  initialized = true

  const stored = localStorage.getItem('theme') as Theme | null
  if (stored) {
    theme.value = stored
  } else {
    theme.value = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  applyTheme(theme.value)
}

export function useTheme() {
  if (import.meta.client) initTheme()

  function toggle() {
    theme.value = theme.value === 'dark' ? 'light' : 'dark'
    applyTheme(theme.value)
    if (import.meta.client) {
      localStorage.setItem('theme', theme.value)
    }
  }

  return {
    theme: readonly(theme),
    toggle,
    setTheme: (t: Theme) => {
      theme.value = t
      applyTheme(t)
      if (import.meta.client) localStorage.setItem('theme', t)
    },
  }
}
