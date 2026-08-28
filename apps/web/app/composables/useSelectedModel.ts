// Shared selected-model state across pages, persisted to localStorage.
// The API default is used until the user explicitly picks a model; after
// that the user's choice survives navigation between projects and conversations.
const selectedModel = ref('glm-5-2')
let initialized = false

const hasLocalStorage = () => typeof localStorage !== 'undefined'

function init() {
  if (initialized || !hasLocalStorage()) return
  initialized = true
  const stored = localStorage.getItem('selectedModel')
  if (stored) {
    selectedModel.value = stored
  }
  watch(selectedModel, (val) => {
    localStorage.setItem('selectedModel', val)
  }, { flush: 'sync' })
}

export function useSelectedModel() {
  if (hasLocalStorage()) init()

  // Set the default only if the user hasn't explicitly chosen a model.
  // Also persist to localStorage so the guard works on subsequent calls even
  // when the value equals the initial ref — the watcher only fires on value
  // changes, so without this explicit write the key may never be set (e.g.
  // when the API default is also 'glm-5-2', the initial ref value).
  function ensureDefault(value: string) {
    if (hasLocalStorage() && localStorage.getItem('selectedModel')) return
    selectedModel.value = value
    if (hasLocalStorage()) localStorage.setItem('selectedModel', value)
  }

  return {
    selectedModel,
    ensureDefault,
  }
}
