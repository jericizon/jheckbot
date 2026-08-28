import type { OfficeAgent, OfficeAgentCapability, OfficeTask } from '@jheckbot/shared'
import type { OfficeAgentService } from '../OfficeAgentService.js'

const UNAVAILABLE_STATUSES = new Set(['error', 'blocked', 'completed'])

const STATUS_SCORE: Record<string, number> = {
  idle: 7,
  thinking: 6,
  working: 5,
  reviewing: 4,
  testing: 3,
  communicating: 2,
}

function scoreForStatus(status: string): number {
  return STATUS_SCORE[status] ?? 1
}

export class AgentSelectionError extends Error {
  statusCode: number
  constructor(message: string, statusCode = 400) {
    super(message)
    this.name = 'AgentSelectionError'
    this.statusCode = statusCode
  }
}

interface Candidate {
  agent: OfficeAgent
  matches: number
  statusScore: number
  index: number
}

/**
 * Selects the best available agent for a task based on inferred capabilities,
 * project access, availability, and current status.
 */
export class AgentSelector {
  /**
   * Pure synchronous selection using pre-loaded agent and capability data.
   */
  selectAgentForTask(
    task: OfficeTask,
    agents: OfficeAgent[],
    capabilitiesByAgent: Map<string, string[]>,
  ): OfficeAgent | null {
    if (!task.officeId?.trim()) {
      throw new AgentSelectionError('Task office ID is required')
    }

    const required = this.inferRequiredCapabilities(task)
    const candidates: Candidate[] = []

    for (let i = 0; i < agents.length; i++) {
      const agent = agents[i]

      if (!agent.enabled) continue
      if (UNAVAILABLE_STATUSES.has(agent.status)) continue
      if (task.projectId && agent.projectAccess && agent.projectAccess.length > 0) {
        if (!agent.projectAccess.includes(task.projectId)) continue
      }

      const caps = capabilitiesByAgent.get(agent.id) ?? []
      const agentCapSet = new Set(caps.map((cap) => cap.toLowerCase()))
      const matches = required.reduce(
        (acc, cap) => (agentCapSet.has(cap.toLowerCase()) ? acc + 1 : acc),
        0,
      )

      // Avoid assigning tasks to agents with none of the required capabilities.
      if (required.length > 0 && matches === 0) continue

      candidates.push({
        agent,
        matches,
        statusScore: scoreForStatus(agent.status),
        index: i,
      })
    }

    candidates.sort((a, b) => {
      if (b.matches !== a.matches) return b.matches - a.matches
      if (b.statusScore !== a.statusScore) return b.statusScore - a.statusScore
      return a.index - b.index
    })

    return candidates[0]?.agent ?? null
  }

  /**
   * High-level async selection that loads agents and capabilities from the service.
   */
  async select({
    task,
    officeId,
    agentService,
  }: {
    task: OfficeTask
    officeId: string
    agentService: OfficeAgentService
  }): Promise<OfficeAgent | null> {
    if (!task.officeId?.trim()) {
      throw new AgentSelectionError('Task office ID is required')
    }

    const effectiveOfficeId = officeId?.trim() || task.officeId
    if (!effectiveOfficeId) {
      throw new AgentSelectionError('Office ID is required')
    }

    const agents = await agentService.listByOffice(effectiveOfficeId)
    const capabilitiesByAgent = new Map<string, string[]>()

    const capLists = await Promise.all(
      agents.map((agent) => agentService.listCapabilities(agent.id)),
    )

    for (let i = 0; i < agents.length; i++) {
      capabilitiesByAgent.set(
        agents[i].id,
        capLists[i].map((cap: OfficeAgentCapability) => cap.capability),
      )
    }

    return this.selectAgentForTask(task, agents, capabilitiesByAgent)
  }

  private inferRequiredCapabilities(task: OfficeTask): string[] {
    const title = task.title.toLowerCase()
    const workflow = task.workflowType?.toLowerCase() ?? ''

    if (
      title.includes('research/design') ||
      (workflow === 'complex' && title.includes('research'))
    ) {
      return ['research', 'design']
    }

    if (title.includes('implement backend') || title.includes('backend')) {
      return ['backend', 'coding']
    }

    if (title.includes('implement frontend') || title.includes('frontend')) {
      return ['frontend', 'ui', 'coding']
    }

    if (title.includes('qa')) {
      return ['qa', 'testing']
    }

    if (title.includes('review')) {
      return ['review', 'code-review']
    }

    if (title.includes('implement') && (workflow === 'simple' || workflow === 'medium')) {
      return ['coding', 'implementation']
    }

    return []
  }
}
