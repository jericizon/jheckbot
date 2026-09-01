import type { OfficeEvent, OfficeTask, OfficeTaskDependency, TaskPriority } from '@jheckbot/shared'
import type { OfficeTaskService } from '../OfficeTaskService.js'
import type { OfficeEventService } from '../OfficeEventService.js'
import type { OfficeAgentService } from '../OfficeAgentService.js'

export type RequestComplexity = 'simple' | 'medium' | 'complex'

export interface CEOPlan {
  request: string
  complexity: RequestComplexity
  tasks: OfficeTask[]
  dependencies: OfficeTaskDependency[]
}

export class CEOPlanningError extends Error {
  statusCode: number
  constructor(message: string, statusCode = 400) {
    super(message)
    this.name = 'CEOPlanningError'
    this.statusCode = statusCode
  }
}

type TaskRole = 'implement' | 'qa' | 'review' | 'research' | 'backend' | 'frontend'

interface TaskDefinition {
  role: TaskRole
  title: string
  description: string
  priority: TaskPriority
  workflowType: RequestComplexity
}

const SIMPLE_KEYWORDS = ['fix typo', 'typo', 'rename', 'color', 'css', 'small', 'minor', 'tweak', 'spelling'] as const
const MEDIUM_KEYWORDS = ['add endpoint', 'endpoint', 'feature', 'ui', 'component', 'modify'] as const
const COMPLEX_KEYWORDS = [
  'auth',
  'authentication',
  'authorize',
  'login',
  'oauth',
  'payment',
  'payments',
  'architecture',
  'major',
  'integration',
  'integrate',
  'security',
  'secure',
] as const
const UI_WORDS = ['ui', 'frontend', 'component', 'css', 'page', 'button', 'screen', 'interface'] as const

/**
 * Deterministic planner that turns a user request into a structured task plan.
 * No LLM calls — rules are keyword-based and intentionally simple.
 */
export class CEOPlanner {
  constructor(
    private taskService: OfficeTaskService,
    private eventService: OfficeEventService,
    private agentService: OfficeAgentService,
  ) {}

  async plan(request: string, officeId: string, projectId?: string): Promise<CEOPlan> {
    this.validateInput(request, officeId)

    const normalized = request.trim()
    const lower = normalized.toLowerCase()

    await this.emit(officeId, 'CEO_PLANNING', 'Planning started', {
      request: normalized,
      projectId: projectId ?? null,
      phase: 'start',
    })

    const complexity = this.detectComplexity(lower)
    const definitions = this.buildDefinitions(normalized, complexity, lower)
    const byRole = new Map<TaskRole, OfficeTask>()
    const tasks: OfficeTask[] = []

    for (const def of definitions) {
      const task = await this.taskService.create({
        officeId,
        projectId,
        title: def.title,
        description: def.description,
        priority: def.priority,
        workflowType: def.workflowType,
        metadata: { request: normalized, projectId: projectId ?? null, complexity },
      })

      byRole.set(def.role, task)
      tasks.push(task)
    }

    const dependencySpecs = this.buildDependencySpecs(byRole, complexity)
    const dependencies: OfficeTaskDependency[] = []

    for (const spec of dependencySpecs) {
      const created = await this.taskService.addDependency(spec.taskId, spec.dependsOnTaskId)
      if (created) {
        dependencies.push(created)
      }
    }

    await this.emit(officeId, 'CEO_PLANNING', 'Planning completed', {
      request: normalized,
      projectId: projectId ?? null,
      phase: 'complete',
      complexity,
      taskCount: tasks.length,
      dependencyCount: dependencies.length,
    })

    return {
      request: normalized,
      complexity,
      tasks,
      dependencies,
    }
  }

  async planSingleTask(request: string, officeId: string, projectId?: string): Promise<CEOPlan> {
    this.validateInput(request, officeId)

    const normalized = request.trim()

    await this.emit(officeId, 'CEO_PLANNING', 'Planning started', {
      request: normalized,
      projectId: projectId ?? null,
      phase: 'start',
      executionMode: 'single',
    })

    const task = await this.taskService.create({
      officeId,
      projectId,
      title: `Implement ${normalized}`,
      description: `Implement the requested change: ${normalized}`,
      priority: 'low',
      workflowType: 'simple',
      createdBy: 'ceo',
      metadata: {
        request: normalized,
        projectId: projectId ?? null,
        complexity: 'simple',
        executionMode: 'single',
      },
    })

    await this.emit(officeId, 'CEO_PLANNING', 'Planning completed', {
      request: normalized,
      projectId: projectId ?? null,
      phase: 'complete',
      complexity: 'simple',
      taskCount: 1,
      dependencyCount: 0,
      executionMode: 'single',
    })

    return {
      request: normalized,
      complexity: 'simple',
      tasks: [task],
      dependencies: [],
    }
  }

  private validateInput(request: string, officeId: string): void {
    if (!request?.trim()) {
      throw new CEOPlanningError('Request is required')
    }
    if (!officeId?.trim()) {
      throw new CEOPlanningError('Office ID is required')
    }
  }

  private emit(
    officeId: string,
    eventType: 'CEO_PLANNING' | 'TASK_CREATED',
    content: string,
    metadata: Record<string, unknown>,
  ): Promise<OfficeEvent> {
    return this.eventService.create({ officeId, eventType, content, metadata })
  }

  private detectComplexity(lower: string): RequestComplexity {
    if (COMPLEX_KEYWORDS.some((keyword) => lower.includes(keyword))) return 'complex'
    if (MEDIUM_KEYWORDS.some((keyword) => lower.includes(keyword))) return 'medium'
    if (SIMPLE_KEYWORDS.some((keyword) => lower.includes(keyword))) return 'simple'
    return 'medium'
  }

  private hasUiWords(lower: string): boolean {
    return UI_WORDS.some((word) => lower.includes(word))
  }

  private buildDefinitions(request: string, complexity: RequestComplexity, lower: string): TaskDefinition[] {
    switch (complexity) {
      case 'simple':
        return [
          {
            role: 'implement',
            title: `Implement ${request}`,
            description: `Implement the requested change: ${request}`,
            priority: 'low',
            workflowType: 'simple',
          },
        ]

      case 'medium':
        return [
          {
            role: 'implement',
            title: `Implement ${request}`,
            description: `Implement the requested change: ${request}`,
            priority: 'medium',
            workflowType: 'medium',
          },
          {
            role: 'qa',
            title: `QA: ${request}`,
            description: `QA for: ${request}`,
            priority: 'medium',
            workflowType: 'medium',
          },
          {
            role: 'review',
            title: `Review: ${request}`,
            description: `Review for: ${request}`,
            priority: 'medium',
            workflowType: 'medium',
          },
        ]

      case 'complex': {
        const definitions: TaskDefinition[] = [
          {
            role: 'research',
            title: `Research/Design: ${request}`,
            description: `Research and design for: ${request}`,
            priority: 'high',
            workflowType: 'complex',
          },
          {
            role: 'backend',
            title: `Implement Backend: ${request}`,
            description: `Implement backend for: ${request}`,
            priority: 'high',
            workflowType: 'complex',
          },
        ]

        if (this.hasUiWords(lower)) {
          definitions.push({
            role: 'frontend',
            title: `Implement Frontend: ${request}`,
            description: `Implement frontend for: ${request}`,
            priority: 'high',
            workflowType: 'complex',
          })
        }

        definitions.push(
          {
            role: 'qa',
            title: `QA: ${request}`,
            description: `QA for: ${request}`,
            priority: 'high',
            workflowType: 'complex',
          },
          {
            role: 'review',
            title: `Review: ${request}`,
            description: `Review for: ${request}`,
            priority: 'high',
            workflowType: 'complex',
          },
        )

        return definitions
      }

      default:
        return []
    }
  }

  private buildDependencySpecs(
    byRole: Map<TaskRole, OfficeTask>,
    complexity: RequestComplexity,
  ): { taskId: string; dependsOnTaskId: string }[] {
    const specs: { taskId: string; dependsOnTaskId: string }[] = []

    const add = (role: TaskRole, dependsOn: TaskRole) => {
      const task = byRole.get(role)
      const dependency = byRole.get(dependsOn)
      if (task && dependency) {
        specs.push({ taskId: task.id, dependsOnTaskId: dependency.id })
      }
    }

    if (complexity === 'medium') {
      add('qa', 'implement')
      add('review', 'qa')
      return specs
    }

    if (complexity === 'complex') {
      add('backend', 'research')
      add('frontend', 'research')

      if (byRole.has('frontend')) {
        add('qa', 'backend')
        add('qa', 'frontend')
      } else {
        add('qa', 'backend')
      }

      add('review', 'qa')
      return specs
    }

    return specs
  }
}
