import type { Office, OfficeAgent } from '@jheckbot/shared'
import { OfficeRepository } from '../repositories/OfficeRepository.js'
import { OfficeAgentRepository } from '../repositories/OfficeAgentRepository.js'
import { ProjectRepository } from '../repositories/ProjectRepository.js'

export class OfficeServiceError extends Error {
  statusCode: number
  constructor(message: string, statusCode = 400) {
    super(message)
    this.name = 'OfficeServiceError'
    this.statusCode = statusCode
  }
}

interface FindOrCreateResult {
  office: Office
  agents: OfficeAgent[]
  created: boolean
}

const DEFAULT_AGENTS = [
  { name: 'CEO', role: 'CEO', description: 'Chief Executive Officer', capabilities: [] as string[] },
  { name: 'Default', role: 'Default', description: 'General-purpose developer', capabilities: [] as string[] },
  { name: 'QA', role: 'QA', description: 'Quality assurance, testing, and code review', capabilities: ['qa', 'testing', 'review', 'code-review'] },
  { name: 'Support', role: 'Support', description: 'Implementation, debugging, and technical support', capabilities: ['coding', 'implementation', 'backend', 'frontend', 'research', 'design', 'support', 'debugging', 'triage'] },
]

export class OfficeService {
  constructor(
    private officeRepo: OfficeRepository,
    private agentRepo: OfficeAgentRepository,
    private projectRepo: ProjectRepository,
  ) {}

  async findOrCreateByProjectId(projectId: string): Promise<FindOrCreateResult> {
    const project = await this.projectRepo.findById(projectId)
    if (!project) {
      throw new OfficeServiceError('Project not found', 404)
    }

    const existing = await this.officeRepo.findByProjectId(projectId)
    if (existing) {
      const agents = await this.agentRepo.listByOffice(existing.id)
      return { office: existing, agents, created: false }
    }

    const office = await this.officeRepo.create({
      name: `${project.name} Office`,
      projectId,
    })

    const agents: OfficeAgent[] = []
    for (const def of DEFAULT_AGENTS) {
      const agent = await this.agentRepo.create({
        officeId: office.id,
        name: def.name,
        role: def.role,
        description: def.description,
      })
      // Seed capabilities so the AgentSelector can match tasks to agents.
      for (const cap of def.capabilities) {
        await this.agentRepo.addCapability(agent.id, cap)
      }
      agents.push(agent)
    }

    return { office, agents, created: true }
  }

  async findByProjectId(projectId: string): Promise<FindOrCreateResult | null> {
    const office = await this.officeRepo.findByProjectId(projectId)
    if (!office) return null
    const agents = await this.agentRepo.listByOffice(office.id)
    return { office, agents, created: false }
  }
}
