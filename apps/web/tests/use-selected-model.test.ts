import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref, watch } from 'vue'

// Regression test for: model selection reverting to default after navigating
// from the projects page to the conversation page. The shared composable must
// persist the user's choice via localStorage and ensureDefault must not
// overwrite an explicit selection.

// Minimal localStorage mock (test environment is node, not jsdom)
function createLocalStorage() {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { store = {} },
  }
}

describe('useSelectedModel persistence', () => {
  beforeEach(() => {
    // Nuxt auto-imports: provide ref/watch as globals for the composable
    ;(globalThis as Record<string, unknown>).ref = ref
    ;(globalThis as Record<string, unknown>).watch = watch
    ;(globalThis as Record<string, unknown>).localStorage = createLocalStorage()
    vi.resetModules()
  })

  afterEach(() => {
    delete (globalThis as Record<string, unknown>).ref
    delete (globalThis as Record<string, unknown>).watch
    delete (globalThis as Record<string, unknown>).localStorage
    vi.resetModules()
  })

  it('ensureDefault sets the default when no user choice exists', async () => {
    const { useSelectedModel } = await import('../app/composables/useSelectedModel')
    const { selectedModel, ensureDefault } = useSelectedModel()

    ensureDefault('claude-sonnet-4')
    expect(selectedModel.value).toBe('claude-sonnet-4')
  })

  it('ensureDefault does NOT overwrite an explicit user choice', async () => {
    const { useSelectedModel } = await import('../app/composables/useSelectedModel')
    const { selectedModel, ensureDefault } = useSelectedModel()

    // User selects a model (simulating dropdown change via v-model)
    selectedModel.value = 'gpt-4o'
    expect(localStorage.getItem('selectedModel')).toBe('gpt-4o')

    // Page load() calls ensureDefault with the API default — must not clobber
    ensureDefault('glm-5-2')
    expect(selectedModel.value).toBe('gpt-4o')
  })

  it('persists selection across composable instances (page navigation)', async () => {
    // Simulate projects page
    const { useSelectedModel } = await import('../app/composables/useSelectedModel')
    const projectsPage = useSelectedModel()
    projectsPage.selectedModel.value = 'claude-opus-4'

    // Simulate navigation to conversation page (new module import cycle)
    vi.resetModules()
    const { useSelectedModel: useSelectedModel2 } = await import('../app/composables/useSelectedModel')
    const convPage = useSelectedModel2()

    // The conversation page's load() calls ensureDefault with API default
    convPage.ensureDefault('glm-5-2')

    expect(convPage.selectedModel.value).toBe('claude-opus-4')
  })

  it('starts with hardcoded default before any API or user input', async () => {
    const { useSelectedModel } = await import('../app/composables/useSelectedModel')
    const { selectedModel } = useSelectedModel()

    expect(selectedModel.value).toBe('glm-5-2')
  })
})
