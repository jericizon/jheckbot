import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { nextTick } from 'vue'
import type { OfficeAgent, AgentStatus, OfficeEvent } from '@jheckbot/shared'
import { getAgentStatusStyle } from '../app/utils/agentStatus'
import { getRoleEmoji } from '../app/utils/roleEmoji'

function createMockApi() {
  return {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  }
}

function createMockEventSource() {
  const allListeners = new Map<string, Array<(e: { data: string }) => void>>()
  const instances: MockEventSource[] = []

  return {
    instances,
    reset() {
      instances.length = 0
      allListeners.clear()
    },
    get MockEventSource() {
      return class MockEventSource {
        url: string
        onopen?: () => void
        onerror?: () => void
        private listeners = new Map<string, Array<(e: { data: string }) => void>>()
        closed = false

        constructor(url: string) {
          this.url = url
          instances.push(this as unknown as MockEventSource)
        }

        close() {
          this.closed = true
        }

        addEventListener(type: string, handler: (e: { data: string }) => void) {
          if (!this.listeners.has(type)) this.listeners.set(type, [])
          this.listeners.get(type)!.push(handler)
          if (!allListeners.has(type)) allListeners.set(type, [])
          allListeners.get(type)!.push(handler)
        }

        dispatch(type: string, data: string) {
          const handlers = this.listeners.get(type) ?? []
          for (const h of handlers) h({ data })
        }
      }
    },
    dispatch(type: string, data: string) {
      for (const instance of instances) {
        instance.dispatch(type, data)
      }
    },
    triggerOpen() {
      for (const instance of instances) {
        if (instance.onopen) instance.onopen()
      }
    },
  }
}

type MockEventSource = {
  url: string
  onopen?: () => void
  onerror?: () => void
  closed: boolean
  close: () => void
  addEventListener: (type: string, handler: (e: { data: string }) => void) => void
  dispatch: (type: string, data: string) => void
}

function baseAgent(
  id: string,
  name: string,
  role: string,
  status: AgentStatus,
  enabled = true,
  officeId = 'office-1',
): OfficeAgent {
  return {
    id,
    officeId,
    name,
    role,
    status,
    enabled,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  }
}

describe('useOffice', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    delete (globalThis as Record<string, unknown>).useApi
    vi.resetAllMocks()
  })

  it('uses the provided office id and loads agents', async () => {
    const mockApi = createMockApi()
    mockApi.get.mockResolvedValueOnce([
      baseAgent('a1', 'Alfred', 'Senior Backend Developer', 'working'),
      baseAgent('a2', 'CEO', 'CEO', 'idle'),
      baseAgent('a3', 'Alice', 'QA Engineer', 'testing'),
    ])
    ;(globalThis as Record<string, unknown>).useApi = vi.fn(() => mockApi)

    const { useOffice } = await import('../app/composables/useOffice')
    const office = useOffice('office-1')
    await office.load()

    expect(office.officeId.value).toBe('office-1')
    expect(mockApi.get).toHaveBeenCalledWith('/api/offices/office-1/agents')
    expect(office.agents.value).toHaveLength(3)
    expect(office.ceo.value?.name).toBe('CEO')
    expect(office.employees.value).toHaveLength(2)
  })

  it('shows the loading state and then clears it', async () => {
    const mockApi = createMockApi()
    mockApi.get.mockResolvedValueOnce([])
    ;(globalThis as Record<string, unknown>).useApi = vi.fn(() => mockApi)

    const { useOffice } = await import('../app/composables/useOffice')
    const office = useOffice('office-1')

    const promise = office.load()
    expect(office.loading.value).toBe(true)
    await promise
    expect(office.loading.value).toBe(false)
  })

  it('reflects an empty office state', async () => {
    const mockApi = createMockApi()
    mockApi.get.mockResolvedValueOnce([])
    ;(globalThis as Record<string, unknown>).useApi = vi.fn(() => mockApi)

    const { useOffice } = await import('../app/composables/useOffice')
    const office = useOffice('office-1')
    await office.load()

    expect(office.agents.value).toHaveLength(0)
    expect(office.ceo.value).toBeUndefined()
    expect(office.employees.value).toHaveLength(0)
    expect(office.error.value).toBe('')
  })

  it('captures load errors', async () => {
    const mockApi = createMockApi()
    mockApi.get.mockRejectedValueOnce(new Error('network'))
    ;(globalThis as Record<string, unknown>).useApi = vi.fn(() => mockApi)

    const { useOffice } = await import('../app/composables/useOffice')
    const office = useOffice('office-1')
    await office.load()

    expect(office.error.value).toBe('Failed to load office')
    expect(office.agents.value).toHaveLength(0)
    expect(office.loading.value).toBe(false)
  })

  it('selecting an agent opens the agent detail panel', async () => {
    const mockApi = createMockApi()
    mockApi.get.mockResolvedValueOnce([
      baseAgent('a1', 'Alfred', 'Senior Backend Developer', 'working'),
    ])
    ;(globalThis as Record<string, unknown>).useApi = vi.fn(() => mockApi)

    const { useOffice } = await import('../app/composables/useOffice')
    const office = useOffice('office-1')
    await office.load()

    const agent = office.agents.value[0]!
    office.selectAgent(agent)

    expect(office.selectedAgent.value).toBe(agent)
    expect(office.selectedMode.value).toBe('agent')
  })

  it('selecting the CEO sets the CEO chat mode', async () => {
    const mockApi = createMockApi()
    mockApi.get.mockResolvedValueOnce([
      baseAgent('a1', 'CEO', 'CEO', 'idle'),
      baseAgent('a2', 'Alfred', 'Senior Backend Developer', 'working'),
    ])
    ;(globalThis as Record<string, unknown>).useApi = vi.fn(() => mockApi)

    const { useOffice } = await import('../app/composables/useOffice')
    const office = useOffice('office-1')
    await office.load()

    office.selectCeo()

    expect(office.selectedAgent.value?.role).toBe('CEO')
    expect(office.selectedMode.value).toBe('ceo')
  })

  it('reacts to office id changes', async () => {
    const mockApi = createMockApi()
    mockApi.get.mockResolvedValueOnce([])
    ;(globalThis as Record<string, unknown>).useApi = vi.fn(() => mockApi)

    const { useOffice } = await import('../app/composables/useOffice')
    const office = useOffice('office-1')

    office.setOfficeId('office-2')
    await nextTick()

    expect(office.officeId.value).toBe('office-2')
    expect(mockApi.get).toHaveBeenCalledWith('/api/offices/office-2/agents')
  })
})

describe('useTasks', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    delete (globalThis as Record<string, unknown>).useApi
    vi.resetAllMocks()
  })

  it('wraps the task list and get endpoints', async () => {
    const mockApi = createMockApi()
    mockApi.get
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce({ id: 'task-1' })
    ;(globalThis as Record<string, unknown>).useApi = vi.fn(() => mockApi)

    const { useTasks } = await import('../app/composables/useTasks')
    const tasks = useTasks()

    await tasks.listByOffice('office-1')
    expect(mockApi.get).toHaveBeenCalledWith('/api/offices/office-1/tasks')

    const task = await tasks.get('task-1')
    expect(mockApi.get).toHaveBeenCalledWith('/api/tasks/task-1')
    expect(task).toEqual({ id: 'task-1' })
  })
})

describe('useOfficeEvents', () => {
  const eventSourceMock = createMockEventSource()

  beforeEach(() => {
    vi.resetModules()
    eventSourceMock.reset()
    vi.stubGlobal('EventSource', eventSourceMock.MockEventSource)
  })

  afterEach(() => {
    delete (globalThis as Record<string, unknown>).useApi
    vi.unstubAllGlobals()
    vi.resetAllMocks()
  })

  it('wraps the event list and get endpoints', async () => {
    const mockApi = createMockApi()
    mockApi.get
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce({ id: 'event-1' })
    ;(globalThis as Record<string, unknown>).useApi = vi.fn(() => mockApi)

    const { useOfficeEvents } = await import('../app/composables/useOfficeEvents')
    const events = useOfficeEvents()

    await events.listByOffice('office-1')
    expect(mockApi.get).toHaveBeenCalledWith('/api/offices/office-1/events')

    const event = await events.get('event-1')
    expect(mockApi.get).toHaveBeenCalledWith('/api/events/event-1')
    expect(event).toEqual({ id: 'event-1' })
  })

  it('subscribes to an office SSE stream and parses incoming events', async () => {
    const mockApi = createMockApi()
    mockApi.get.mockResolvedValueOnce([])
    ;(globalThis as Record<string, unknown>).useApi = vi.fn(() => mockApi)

    const { useOfficeEvents } = await import('../app/composables/useOfficeEvents')
    const events = useOfficeEvents()

    const received: OfficeEvent[] = []
    const onOpen = vi.fn()
    const unsubscribe = events.subscribeToOffice('office-1', (event) => {
      received.push(event)
    }, onOpen)

    expect(eventSourceMock.instances.length).toBe(1)
    expect(eventSourceMock.instances[0].url).toBe('/api/offices/office-1/events/stream')

    eventSourceMock.triggerOpen()
    expect(onOpen).toHaveBeenCalled()

    const liveEvent: OfficeEvent = {
      id: 'event-2',
      officeId: 'office-1',
      eventType: 'TASK_UPDATED',
      content: 'Task updated',
      createdAt: '2026-01-01T00:00:00Z',
    }
    eventSourceMock.dispatch('office', JSON.stringify(liveEvent))

    expect(received).toEqual([liveEvent])

    unsubscribe()
  })

  it('closes an existing connection when subscribing to a new office', async () => {
    const mockApi = createMockApi()
    mockApi.get.mockResolvedValueOnce([])
    ;(globalThis as Record<string, unknown>).useApi = vi.fn(() => mockApi)

    const { useOfficeEvents } = await import('../app/composables/useOfficeEvents')
    const events = useOfficeEvents()

    events.subscribeToOffice('office-1', () => {})
    const firstInstance = eventSourceMock.instances[0]

    events.subscribeToOffice('office-2', () => {})

    expect(firstInstance.closed).toBe(true)
    expect(eventSourceMock.instances.length).toBe(2)
    expect(eventSourceMock.instances[1].url).toBe('/api/offices/office-2/events/stream')
  })
})

describe('useCEOChat', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    delete (globalThis as Record<string, unknown>).useApi
    vi.resetAllMocks()
  })

  it('wraps the CEO chat endpoints', async () => {
    const mockApi = createMockApi()
    mockApi.get.mockResolvedValueOnce([
      { id: 'event-1', eventType: 'CEO_MESSAGE', content: 'Hello', createdAt: '2026-01-01T00:00:00Z' },
    ])
    mockApi.post.mockResolvedValueOnce({
      userMessage: { id: 'event-2', eventType: 'CEO_MESSAGE' },
      ceoResponse: { id: 'event-3', eventType: 'CEO_RESPONSE' },
      plan: { request: 'Add login', complexity: 'medium', tasks: [], dependencies: [] },
    })
    ;(globalThis as Record<string, unknown>).useApi = vi.fn(() => mockApi)

    const { useCEOChat } = await import('../app/composables/useCEOChat')
    const chat = useCEOChat()

    const events = await chat.listEvents('office-1')
    expect(mockApi.get).toHaveBeenCalledWith('/api/offices/office-1/ceo/events')
    expect(events).toHaveLength(1)

    const result = await chat.sendMessage('office-1', 'Add login')
    expect(mockApi.post).toHaveBeenCalledWith('/api/offices/office-1/ceo/messages', {
      request: 'Add login',
      projectId: undefined,
    })
    expect(result.plan.complexity).toBe('medium')
  })
})

describe('agent status mapping', () => {
  it('maps working to a pulsing sky dot', () => {
    const style = getAgentStatusStyle('working')
    expect(style.dotClass).toBe('bg-sky-500')
    expect(style.label).toBe('Working')
    expect(style.animate).toBe('pulse')
  })

  it('maps error to a bouncing red dot', () => {
    const style = getAgentStatusStyle('error')
    expect(style.dotClass).toBe('bg-red-500')
    expect(style.label).toBe('Error')
    expect(style.animate).toBe('bounce')
  })

  it('maps idle to a neutral dot', () => {
    const style = getAgentStatusStyle('idle')
    expect(style.dotClass).toBe('bg-content-subtle')
    expect(style.label).toBe('Idle')
    expect(style.animate).toBeUndefined()
  })

  it('maps completed to a green dot', () => {
    const style = getAgentStatusStyle('completed')
    expect(style.dotClass).toBe('bg-emerald-500')
    expect(style.label).toBe('Done')
  })
})

describe('role emoji mapping', () => {
  it('uses a CEO emoji for the CEO role', () => {
    expect(getRoleEmoji('CEO')).toBe('👔')
  })

  it('uses a QA emoji for QA roles', () => {
    expect(getRoleEmoji('QA Engineer')).toBe('🧪')
  })

  it('uses a reviewer emoji for review roles', () => {
    expect(getRoleEmoji('Code Reviewer')).toBe('🔍')
  })

  it('falls back to a generic developer emoji', () => {
    expect(getRoleEmoji('Senior Backend Developer')).toBe('⚙️')
  })
})
