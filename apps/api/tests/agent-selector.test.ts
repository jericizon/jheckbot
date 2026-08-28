import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { OfficeAgent, OfficeAgentCapability, OfficeTask } from '@jheckbot/shared'
import {
  AgentSelector,
  AgentSelectionError,
} from '../src/services/orchestration/AgentSelector.js'
import type { OfficeAgentService } from '../src/services/OfficeAgentService.js'

function makeTask(overrides: Partial<OfficeTask> = {}): OfficeTask {
  const now = new Date().toISOString()
  return {
    id: 'task-1',
    officeId: 'office-1',
    title: 'Implement Backend: test',
    status: 'backlog',
    priority: 'medium',
    workflowType: 'complex',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

function makeAgent(overrides: Partial<OfficeAgent> = {}): OfficeAgent {
  const now = new Date().toISOString()
  return {
    id: 'agent-1',
    officeId: 'office-1',
    name: 'Alfred',
    role: 'Senior Backend Developer',
    status: 'idle',
    enabled: true,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

function makeCapability(overrides: Partial<OfficeAgentCapability> = {}): OfficeAgentCapability {
  return {
    id: 'cap-1',
    agentId: 'agent-1',
    capability: 'backend',
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

describe('AgentSelector', () => {
  let selector: AgentSelector

  beforeEach(() => {
    selector = new AgentSelector()
  })

  describe('selectAgentForTask', () => {
    it('returns null when there are no agents', () => {
      const task = makeTask()
      const result = selector.selectAgentForTask(task, [], new Map())
      expect(result).toBeNull()
    })

    it('returns null when no agent matches the required capabilities', () => {
      const task = makeTask({ title: 'QA: verify login', workflowType: 'medium' })
      const agents = [
        makeAgent({ id: 'agent-1', name: 'Frontend Dev', status: 'idle' }),
      ]
      const capabilities = new Map<string, string[]>([['agent-1', ['frontend', 'ui']]])

      const result = selector.selectAgentForTask(task, agents, capabilities)
      expect(result).toBeNull()
    })

    it('selects the only agent that matches the required capabilities', () => {
      const task = makeTask({ title: 'Implement Backend: login', workflowType: 'complex' })
      const agents = [
        makeAgent({ id: 'agent-1', name: 'Frontend Dev' }),
        makeAgent({ id: 'agent-2', name: 'Backend Dev', status: 'idle' }),
      ]
      const capabilities = new Map<string, string[]>([
        ['agent-1', ['frontend', 'ui']],
        ['agent-2', ['backend', 'coding']],
      ])

      const result = selector.selectAgentForTask(task, agents, capabilities)
      expect(result).not.toBeNull()
      expect(result?.id).toBe('agent-2')
    })

    it('ranks agents by capability match score', () => {
      const task = makeTask({ title: 'Implement Backend: auth', workflowType: 'complex' })
      const agents = [
        makeAgent({ id: 'agent-1', name: 'Backend Dev' }),
        makeAgent({ id: 'agent-2', name: 'Fullstack Dev', status: 'idle' }),
      ]
      const capabilities = new Map<string, string[]>([
        ['agent-1', ['backend']],
        ['agent-2', ['backend', 'coding']],
      ])

      const result = selector.selectAgentForTask(task, agents, capabilities)
      expect(result?.id).toBe('agent-2')
    })

    it('filters by project access when the task has a projectId', () => {
      const task = makeTask({
        title: 'Implement Backend: auth',
        workflowType: 'complex',
        projectId: 'project-2',
      })
      const agents = [
        makeAgent({ id: 'agent-1', projectAccess: ['project-1'] }),
        makeAgent({ id: 'agent-2', projectAccess: ['project-2'] }),
      ]
      const capabilities = new Map<string, string[]>([
        ['agent-1', ['backend', 'coding']],
        ['agent-2', ['backend', 'coding']],
      ])

      const result = selector.selectAgentForTask(task, agents, capabilities)
      expect(result?.id).toBe('agent-2')
    })

    it('allows agents with unrestricted project access', () => {
      const task = makeTask({
        title: 'Implement Backend: auth',
        workflowType: 'complex',
        projectId: 'project-x',
      })
      const agents = [makeAgent({ id: 'agent-1', projectAccess: undefined })]
      const capabilities = new Map<string, string[]>([['agent-1', ['backend', 'coding']]])

      const result = selector.selectAgentForTask(task, agents, capabilities)
      expect(result?.id).toBe('agent-1')
    })

    it('ranks agents by status when capability matches are equal', () => {
      const task = makeTask({ title: 'Implement Backend: auth', workflowType: 'complex' })
      const agents = [
        makeAgent({ id: 'agent-1', status: 'working' }),
        makeAgent({ id: 'agent-2', status: 'idle' }),
      ]
      const capabilities = new Map<string, string[]>([
        ['agent-1', ['backend']],
        ['agent-2', ['backend']],
      ])

      const result = selector.selectAgentForTask(task, agents, capabilities)
      expect(result?.id).toBe('agent-2')
    })

    it('prefers idle over thinking over working over reviewing over testing over communicating', () => {
      const task = makeTask({ title: 'Implement: small fix', workflowType: 'simple' })
      const agents = [
        makeAgent({ id: 'agent-1', status: 'communicating' }),
        makeAgent({ id: 'agent-2', status: 'testing' }),
        makeAgent({ id: 'agent-3', status: 'reviewing' }),
        makeAgent({ id: 'agent-4', status: 'working' }),
        makeAgent({ id: 'agent-5', status: 'thinking' }),
        makeAgent({ id: 'agent-6', status: 'idle' }),
      ]
      const capabilities = new Map<string, string[]>(
        agents.map((agent) => [agent.id, ['coding']]),
      )

      const result = selector.selectAgentForTask(task, agents, capabilities)
      expect(result?.id).toBe('agent-6')
    })

    it('filters out disabled agents and unavailable statuses', () => {
      const task = makeTask({ title: 'Implement Backend: auth', workflowType: 'complex' })
      const agents = [
        makeAgent({ id: 'agent-1', enabled: false }),
        makeAgent({ id: 'agent-2', status: 'error' }),
        makeAgent({ id: 'agent-3', status: 'blocked' }),
        makeAgent({ id: 'agent-4', status: 'completed' }),
        makeAgent({ id: 'agent-5', status: 'idle' }),
      ]
      const capabilities = new Map<string, string[]>(
        agents.map((agent) => [agent.id, ['backend', 'coding']]),
      )

      const result = selector.selectAgentForTask(task, agents, capabilities)
      expect(result?.id).toBe('agent-5')
    })

    it('throws AgentSelectionError when task officeId is missing', () => {
      const task = makeTask({ officeId: '' })
      expect(() => selector.selectAgentForTask(task, [], new Map())).toThrow(
        AgentSelectionError,
      )
    })

    it('infers research and design capabilities from Research/Design tasks', () => {
      const task = makeTask({ title: 'Research/Design: auth flow', workflowType: 'complex' })
      const agents = [
        makeAgent({ id: 'agent-1', status: 'idle' }),
        makeAgent({ id: 'agent-2', status: 'idle' }),
      ]
      const capabilities = new Map<string, string[]>([
        ['agent-1', ['backend', 'coding']],
        ['agent-2', ['research', 'design']],
      ])

      const result = selector.selectAgentForTask(task, agents, capabilities)
      expect(result?.id).toBe('agent-2')
    })

    it('infers QA and testing capabilities from QA tasks', () => {
      const task = makeTask({ title: 'QA: verify login', workflowType: 'medium' })
      const agents = [
        makeAgent({ id: 'agent-1', status: 'idle' }),
        makeAgent({ id: 'agent-2', status: 'idle' }),
      ]
      const capabilities = new Map<string, string[]>([
        ['agent-1', ['backend', 'coding']],
        ['agent-2', ['qa', 'testing']],
      ])

      const result = selector.selectAgentForTask(task, agents, capabilities)
      expect(result?.id).toBe('agent-2')
    })
  })

  describe('select', () => {
    it('loads agents and capabilities from the service and selects the best match', async () => {
      const task = makeTask({ title: 'Implement Frontend: button', workflowType: 'complex' })
      const agents = [
        makeAgent({ id: 'agent-1', status: 'idle' }),
        makeAgent({ id: 'agent-2', status: 'idle' }),
      ]
      const agentService = {
        listByOffice: vi.fn().mockResolvedValue(agents),
        listCapabilities: vi.fn().mockImplementation((agentId: string) => {
          if (agentId === 'agent-1') return Promise.resolve([makeCapability({ capability: 'backend' })])
          return Promise.resolve([
            makeCapability({ agentId: 'agent-2', capability: 'frontend' }),
            makeCapability({ agentId: 'agent-2', capability: 'ui' }),
          ])
        }),
      } as unknown as OfficeAgentService

      const result = await selector.select({
        task,
        officeId: 'office-1',
        agentService,
      })

      expect(result?.id).toBe('agent-2')
      expect(agentService.listByOffice).toHaveBeenCalledWith('office-1')
      expect(agentService.listCapabilities).toHaveBeenCalledWith('agent-1')
      expect(agentService.listCapabilities).toHaveBeenCalledWith('agent-2')
    })

    it('throws AgentSelectionError when task officeId is missing', async () => {
      const task = makeTask({ officeId: '' })
      const agentService = {
        listByOffice: vi.fn(),
        listCapabilities: vi.fn(),
      } as unknown as OfficeAgentService

      await expect(
        selector.select({ task, officeId: 'office-1', agentService }),
      ).rejects.toThrow(AgentSelectionError)
      expect(agentService.listByOffice).not.toHaveBeenCalled()
    })
  })
})
