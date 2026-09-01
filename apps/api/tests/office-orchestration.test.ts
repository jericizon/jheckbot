import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { OfficeAgent, OfficeEvent, OfficeTask, OfficeTaskDependency } from '@jheckbot/shared'
import { OfficeEventRepository } from '../src/repositories/OfficeEventRepository.js'
import { OfficeTaskRepository } from '../src/repositories/OfficeTaskRepository.js'
import { OfficeAgentRepository } from '../src/repositories/OfficeAgentRepository.js'
import { WorkflowRunRepository } from '../src/repositories/WorkflowRunRepository.js'
import { OfficeEventService } from '../src/services/OfficeEventService.js'
import { OfficeTaskService } from '../src/services/OfficeTaskService.js'
import { OfficeAgentService } from '../src/services/OfficeAgentService.js'
import { CEOService } from '../src/services/orchestration/CEOService.js'
import { CEOPlanner } from '../src/services/orchestration/CEOPlanner.js'
import { TaskDispatcher } from '../src/services/orchestration/TaskDispatcher.js'
import { WorkflowEngine } from '../src/services/orchestration/WorkflowEngine.js'
import type { AgentSelector } from '../src/services/orchestration/AgentSelector.js'
import { OfficeTaskExecutionService } from '../src/services/orchestration/OfficeTaskExecutionService.js'
import { OfficeRepository } from '../src/repositories/OfficeRepository.js'
import { ProjectService } from '../src/services/ProjectService.js'
import type { ProjectRecord } from '../src/repositories/ProjectRepository.js'

let idCounter = 0
function nextId(prefix: string): string {
  idCounter += 1
  return `${prefix}-${idCounter}`
}

function now(): string {
  return new Date().toISOString()
}

class FakeOfficeRepository extends OfficeRepository {
  private offices: Map<string, Office> = new Map()

  override async findById(id: string): Promise<Office | null> {
    return this.offices.get(id) ?? null
  }

  override async findByProjectId(projectId: string): Promise<Office | null> {
    return Array.from(this.offices.values()).find((o) => o.projectId === projectId) ?? null
  }

  seed(office: Office): void {
    this.offices.set(office.id, office)
  }
}

class FakeProjectService {
  private projects: Map<string, ProjectRecord> = new Map()

  seed(project: ProjectRecord): void {
    this.projects.set(project.id, project)
  }

  async get(id: string): Promise<ProjectRecord | null> {
    return this.projects.get(id) ?? null
  }
}

class FakeOfficeTaskExecutionService {
  async start(
    taskId: string,
    options?: { model?: string },
  ): Promise<import('../src/services/orchestration/OfficeTaskExecutionService.js').OfficeTaskExecutionResult> {
    return {
      taskId,
      conversationId: nextId('conv'),
      agentId: nextId('agent'),
      status: 'started',
    }
  }
}

class FakeOfficeEventRepository extends OfficeEventRepository {
  private events: OfficeEvent[] = []

  override async create(data: {
    officeId: string
    eventType: string
    content?: string | null
    metadata?: Record<string, unknown> | null
  }): Promise<OfficeEvent> {
    const event: OfficeEvent = {
      id: nextId('event'),
      officeId: data.officeId,
      eventType: data.eventType as OfficeEvent['eventType'],
      content: data.content ?? undefined,
      metadata: data.metadata,
      createdAt: now(),
    }
    this.events.unshift(event)
    return event
  }

  override async getById(id: string): Promise<OfficeEvent | null> {
    return this.events.find((e) => e.id === id) ?? null
  }

  override async listByOffice(officeId: string): Promise<OfficeEvent[]> {
    return this.events.filter((e) => e.officeId === officeId)
  }

  override async listByOfficeAndTypes(officeId: string, eventTypes: string[]): Promise<OfficeEvent[]> {
    return this.events.filter((e) => e.officeId === officeId && eventTypes.includes(e.eventType))
  }

  override async officeExists(officeId: string): Promise<boolean> {
    return true
  }

  all(): OfficeEvent[] {
    return [...this.events]
  }

  clear(): void {
    this.events = []
  }
}

class FakeOfficeTaskRepository extends OfficeTaskRepository {
  private tasks: OfficeTask[] = []
  private deps: OfficeTaskDependency[] = []

  override async create(data: {
    officeId: string
    projectId?: string | null
    parentTaskId?: string | null
    title: string
    description?: string | null
    acceptanceCriteria?: string | null
    status?: OfficeTask['status']
    priority?: OfficeTask['priority']
    assignedAgentId?: string | null
    createdBy?: string | null
    workflowType?: string | null
    metadata?: Record<string, unknown> | null
  }): Promise<OfficeTask> {
    const task: OfficeTask = {
      id: nextId('task'),
      officeId: data.officeId,
      projectId: data.projectId ?? undefined,
      parentTaskId: data.parentTaskId ?? undefined,
      title: data.title,
      description: data.description ?? undefined,
      acceptanceCriteria: data.acceptanceCriteria ?? undefined,
      status: data.status ?? 'backlog',
      priority: data.priority ?? 'medium',
      assignedAgentId: data.assignedAgentId ?? undefined,
      createdBy: data.createdBy ?? undefined,
      workflowType: data.workflowType ?? undefined,
      metadata: data.metadata,
      createdAt: now(),
      updatedAt: now(),
    }
    this.tasks.push(task)
    return task
  }

  override async getById(id: string): Promise<OfficeTask | null> {
    return this.tasks.find((t) => t.id === id) ?? null
  }

  override async listByOffice(officeId: string): Promise<OfficeTask[]> {
    return this.tasks.filter((t) => t.officeId === officeId)
  }

  override async update(id: string, data: Partial<OfficeTask>): Promise<OfficeTask | null> {
    const task = this.tasks.find((t) => t.id === id)
    if (!task) return null
    Object.assign(task, data, { updatedAt: now() })
    return task
  }

  override async setStatus(id: string, status: OfficeTask['status']): Promise<OfficeTask | null> {
    const task = this.tasks.find((t) => t.id === id)
    if (!task) return null
    task.status = status
    task.updatedAt = now()
    return task
  }

  override async listDependencies(taskId: string): Promise<OfficeTask[]> {
    return this.deps
      .filter((d) => d.taskId === taskId)
      .map((d) => this.tasks.find((t) => t.id === d.dependsOnTaskId))
      .filter((t): t is OfficeTask => t !== undefined)
  }

  override async findActiveCeoExecution(officeId: string): Promise<OfficeTask | null> {
    return (
      this.tasks
        .filter(
          (t) =>
            t.officeId === officeId &&
            t.createdBy === 'ceo' &&
            t.workflowType === 'simple' &&
            ['backlog', 'planning', 'ready', 'assigned', 'working'].includes(t.status),
        )
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] ?? null
    )
  }

  override async linkExecutionConversation(taskId: string): Promise<OfficeTask | null> {
    return this.getById(taskId)
  }

  override async addDependency(taskId: string, dependsOnTaskId: string): Promise<OfficeTaskDependency | null> {
    const dep: OfficeTaskDependency = {
      taskId,
      dependsOnTaskId,
      createdAt: now(),
    }
    this.deps.push(dep)
    return dep
  }

  clear(): void {
    this.tasks = []
    this.deps = []
  }
}

class FakeOfficeAgentRepository extends OfficeAgentRepository {
  private agents: OfficeAgent[] = []
  private capabilities: Map<string, string[]> = new Map()

  override async create(data: {
    officeId: string
    name: string
    role: string
    description?: string
    status?: OfficeAgent['status']
    enabled?: boolean
  }): Promise<OfficeAgent> {
    const agent: OfficeAgent = {
      id: nextId('agent'),
      officeId: data.officeId,
      name: data.name,
      role: data.role,
      description: data.description,
      status: data.status ?? 'idle',
      enabled: data.enabled ?? true,
      createdAt: now(),
      updatedAt: now(),
    }
    this.agents.push(agent)
    return agent
  }

  override async getById(id: string): Promise<OfficeAgent | null> {
    return this.agents.find((a) => a.id === id) ?? null
  }

  override async listByOffice(officeId: string): Promise<OfficeAgent[]> {
    return this.agents.filter((a) => a.officeId === officeId)
  }

  override async update(id: string, data: Partial<OfficeAgent>): Promise<OfficeAgent | null> {
    const agent = this.agents.find((a) => a.id === id)
    if (!agent) return null
    // Mirror the real repository: keep existing values for fields not provided.
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        ;(agent as Record<string, unknown>)[key] = value
      }
    }
    agent.updatedAt = now()
    return agent
  }

  override async listCapabilities(agentId: string): Promise<{ id: string; agentId: string; capability: string; createdAt: string }[]> {
    return (this.capabilities.get(agentId) ?? []).map((cap) => ({
      id: nextId('cap'),
      agentId,
      capability: cap,
      createdAt: now(),
    }))
  }

  override async addCapability(agentId: string, capability: string): Promise<{ id: string; agentId: string; capability: string; createdAt: string } | null> {
    const list = this.capabilities.get(agentId) ?? []
    if (!list.includes(capability)) list.push(capability)
    this.capabilities.set(agentId, list)
    return { id: nextId('cap'), agentId, capability, createdAt: now() }
  }

  clear(): void {
    this.agents = []
    this.capabilities.clear()
  }
}

class FakeWorkflowRunRepository extends WorkflowRunRepository {
  private runs: import('@jheckbot/shared').OfficeWorkflowRun[] = []
  private steps: import('@jheckbot/shared').OfficeWorkflowStep[] = []

  override async create(data: {
    officeId: string
    rootTaskId?: string | null
    status?: import('@jheckbot/shared').WorkflowRunStatus
    startedAt?: string | null
    metadata?: Record<string, unknown> | null
  }): Promise<import('@jheckbot/shared').OfficeWorkflowRun> {
    const run = {
      id: nextId('run'),
      officeId: data.officeId,
      rootTaskId: data.rootTaskId ?? undefined,
      status: data.status ?? 'pending',
      startedAt: data.startedAt ?? undefined,
      metadata: data.metadata,
      createdAt: now(),
      updatedAt: now(),
    } as import('@jheckbot/shared').OfficeWorkflowRun
    this.runs.push(run)
    return run
  }

  override async getById(id: string): Promise<import('@jheckbot/shared').OfficeWorkflowRun | null> {
    return this.runs.find((r) => r.id === id) ?? null
  }

  override async listSteps(workflowRunId: string): Promise<import('@jheckbot/shared').OfficeWorkflowStep[]> {
    return this.steps.filter((s) => s.workflowRunId === workflowRunId)
  }

  override async createStep(data: {
    workflowRunId: string
    taskId?: string | null
    stepType: string
    status?: import('@jheckbot/shared').WorkflowStepStatus
    sequence: number
    metadata?: Record<string, unknown> | null
  }): Promise<import('@jheckbot/shared').OfficeWorkflowStep> {
    const step = {
      id: nextId('step'),
      workflowRunId: data.workflowRunId,
      taskId: data.taskId ?? undefined,
      stepType: data.stepType,
      status: data.status ?? 'pending',
      sequence: data.sequence,
      metadata: data.metadata,
      createdAt: now(),
      updatedAt: now(),
    } as import('@jheckbot/shared').OfficeWorkflowStep
    this.steps.push(step)
    return step
  }

  override async updateStepStatus(id: string, status: import('@jheckbot/shared').WorkflowStepStatus): Promise<import('@jheckbot/shared').OfficeWorkflowStep | null> {
    const step = this.steps.find((s) => s.id === id)
    if (!step) return null
    step.status = status
    step.updatedAt = now()
    return step
  }

  override async updateStatus(id: string, status: import('@jheckbot/shared').WorkflowRunStatus): Promise<import('@jheckbot/shared').OfficeWorkflowRun | null> {
    const run = this.runs.find((r) => r.id === id)
    if (!run) return null
    run.status = status
    run.updatedAt = now()
    if (status === 'completed' || status === 'failed') run.completedAt = now()
    return run
  }

  override async getStepByTaskId(taskId: string): Promise<import('@jheckbot/shared').OfficeWorkflowStep | null> {
    return this.steps.find((s) => s.taskId === taskId && this.runs.find((r) => r.id === s.workflowRunId)?.status === 'running') ?? null
  }

  clear(): void {
    this.runs = []
    this.steps = []
  }
}

function createOrchestrationFixture() {
  const eventRepo = new FakeOfficeEventRepository()
  const eventService = new OfficeEventService(eventRepo)

  const taskRepo = new FakeOfficeTaskRepository()
  const taskService = new OfficeTaskService(taskRepo, eventService)

  const agentRepo = new FakeOfficeAgentRepository()
  const agentService = new OfficeAgentService(agentRepo, eventService)

  const officeRepo = new FakeOfficeRepository()
  const projectService = new FakeProjectService()
  const executionService = new FakeOfficeTaskExecutionService()

  const planner = new CEOPlanner(taskService, eventService, agentService)
  const ceoService = new CEOService({
    planner,
    eventService,
    executionService: executionService as unknown as OfficeTaskExecutionService,
    taskService,
    officeRepo,
    projectService: projectService as unknown as ProjectService,
  })

  const fakeSelector: Pick<AgentSelector, 'select'> = {
    select: async ({ task, officeId, agentService: svc }) => {
      const agents = await svc.listByOffice(officeId)
      return agents.find((a) => a.status !== 'error' && a.enabled) ?? null
    },
  }

  const taskDispatcher = new TaskDispatcher(taskService, agentService, eventService, fakeSelector)
  const runRepo = new FakeWorkflowRunRepository()
  const workflowEngine = new WorkflowEngine(runRepo, taskService, eventService, taskDispatcher)

  return {
    eventRepo,
    eventService,
    taskRepo,
    taskService,
    agentRepo,
    agentService,
    officeRepo,
    projectService,
    executionService,
    ceoService,
    workflowEngine,
    taskDispatcher,
  }
}

describe('Office orchestration E2E', () => {
  const officeId = '00000000-0000-0000-0000-000000000001'
  const projectId = '11111111-1111-1111-1111-111111111111'

  function seedOffice(fixture: ReturnType<typeof createOrchestrationFixture>) {
    fixture.officeRepo.seed({
      id: officeId,
      name: 'Test Office',
      projectId,
      status: 'active',
      createdAt: now(),
      updatedAt: now(),
    })
    fixture.projectService.seed({
      id: projectId,
      name: 'Test Project',
      slug: 'test',
      path: '/tmp/test',
      description: null,
      enabled: true,
      default_provider_id: null,
      default_provider_config: null,
      created_at: now(),
      updated_at: now(),
    })
  }

  beforeEach(() => {
    idCounter = 0
  })

  it('CEO single-task request creates one task and starts an execution', async () => {
    const fixture = createOrchestrationFixture()
    const { ceoService, eventRepo, taskRepo, agentService } = fixture
    seedOffice(fixture)

    await agentService.create({ officeId, name: 'CEO', role: 'CEO' })
    await agentService.create({ officeId, name: 'Support', role: 'Support' })

    const result = await ceoService.sendMessage({ officeId, request: 'add endpoint for users' })

    expect(result.userMessage.eventType).toBe('CEO_MESSAGE')
    expect(result.ceoResponse.eventType).toBe('CEO_RESPONSE')
    expect(result.plan.complexity).toBe('simple')
    expect(result.plan.tasks).toHaveLength(1)
    expect(result.execution.status).toBe('started')

    const tasks = await taskRepo.listByOffice(officeId)
    expect(tasks).toHaveLength(1)
    expect(tasks[0].title).toBe('Implement add endpoint for users')
    expect(tasks[0].createdBy).toBe('ceo')
    expect(tasks[0].workflowType).toBe('simple')

    const events = eventRepo.all()
    expect(events.some((e) => e.eventType === 'CEO_MESSAGE')).toBe(true)
    expect(events.some((e) => e.eventType === 'CEO_RESPONSE')).toBe(true)
    expect(events.some((e) => e.eventType === 'CEO_PLANNING')).toBe(true)
    expect(events.filter((e) => e.eventType === 'TASK_CREATED')).toHaveLength(1)
  })

  it('rejects a second CEO request while an execution is active', async () => {
    const fixture = createOrchestrationFixture()
    seedOffice(fixture)

    await fixture.agentService.create({ officeId, name: 'CEO', role: 'CEO' })
    await fixture.agentService.create({ officeId, name: 'Support', role: 'Support' })

    await fixture.ceoService.sendMessage({ officeId, request: 'add login' })

    await expect(
      fixture.ceoService.sendMessage({ officeId, request: 'add another endpoint' }),
    ).rejects.toMatchObject({
      message: 'An active CEO execution is already in progress',
      statusCode: 409,
    })
  })

  it('surfaces a failed execution without leaking internal errors', async () => {
    const fixture = createOrchestrationFixture()
    seedOffice(fixture)

    fixture.executionService.start = vi.fn().mockResolvedValue({
      taskId: 'task-1',
      conversationId: 'conv-1',
      agentId: 'agent-1',
      status: 'failed',
      error: 'devin_start_failed',
    })

    await fixture.agentService.create({ officeId, name: 'CEO', role: 'CEO' })
    await fixture.agentService.create({ officeId, name: 'Support', role: 'Support' })

    const result = await fixture.ceoService.sendMessage({ officeId, request: 'add login' })

    expect(result.execution.status).toBe('failed')
    expect(result.execution.error).toBe('devin_start_failed')
  })

  it('WorkflowEngine dispatches a single task and completes the run', async () => {
    const fixture = createOrchestrationFixture()
    const { ceoService, workflowEngine, taskService, eventRepo, agentService } = fixture
    seedOffice(fixture)

    await agentService.create({ officeId, name: 'Dev', role: 'Senior Backend Developer' })

    const { plan } = await ceoService.sendMessage({ officeId, request: 'fix typo in README' })

    expect(plan.tasks).toHaveLength(1)
    const rootTask = plan.tasks[0]

    const { run, steps } = await workflowEngine.startWorkflow(officeId, rootTask.id, plan.tasks)

    expect(run.status).toBe('running')
    expect(steps).toHaveLength(1)
    expect(steps[0].status).toBe('working')

    const afterDispatch = await taskService.getById(rootTask.id)
    expect(afterDispatch?.status).toBe('assigned')

    await taskService.setStatus(rootTask.id, 'working')
    await workflowEngine.onTaskStatusChanged(rootTask.id, 'working')
    await taskService.setStatus(rootTask.id, 'qa')
    await workflowEngine.onTaskStatusChanged(rootTask.id, 'qa')
    await taskService.setStatus(rootTask.id, 'completed')
    await workflowEngine.onTaskStatusChanged(rootTask.id, 'completed')

    const finalRun = run.id ? await workflowEngine['runRepo'].getById(run.id) : null
    expect(finalRun?.status).toBe('completed')

    const events = eventRepo.all()
    expect(events.some((e) => e.eventType === 'WORKFLOW_STARTED')).toBe(true)
    expect(events.some((e) => e.eventType === 'TASK_DISPATCHED')).toBe(true)
    expect(events.some((e) => e.eventType === 'WORKFLOW_COMPLETED')).toBe(true)
  })
})
