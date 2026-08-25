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
  function ensureDefault(value: string) {
    if (hasLocalStorage() && localStorage.getItem('selectedModel')) return
    selectedModel.value = value
  }

  return {
    selectedModel,
    ensureDefault,
  }
}
