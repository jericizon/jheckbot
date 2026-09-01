import type { AgentDescriptor, AgentRole, MessageKind, TaskDescriptor } from '../types'
import type { OfficeDirector } from './OfficeDirector'

// Deterministic demo workflow (spec §29/§36).
//
// Runs a scripted CEO -> Backend -> QA cycle that demonstrates the full
// acceptance test: CEO receives a task, walks to the developer, assigns it,
// the developer codes, sends a QA request, QA reviews, finds an issue, the
// developer fixes it, QA approves, and the CEO reports success. The whole
// flow is understandable by watching the office — no log reading required.

const DEMO_AGENTS: AgentDescriptor[] = [
  { id: 'demo-ceo', name: 'Pat', role: 'ceo', provider: 'JheckBot', model: 'orchestrator' },
  { id: 'demo-backend', name: 'Sam', role: 'backend', provider: 'Claude', model: 'sonnet' },
  { id: 'demo-qa', name: 'Riley', role: 'qa', provider: 'Claude', model: 'haiku' },
  { id: 'demo-designer', name: 'Mika', role: 'designer', provider: 'GPT', model: 'gpt-4o' },
  { id: 'demo-frontend', name: 'Jules', role: 'frontend', provider: 'Claude', model: 'sonnet' },
]

const DEMO_TASK: TaskDescriptor = {
  id: 'task-demo-1',
  title: 'Add authentication to the application',
  description: 'Implement login + session handling',
  status: 'queued',
  priority: 'high',
}

export interface DemoTimelineOptions {
  // Slow-mo factor for the demo (1 = normal). Useful for QA observation.
  speed?: number
}

export class DemoTimeline {
  private running = false
  private cancelled = false
  private speed = 1

  constructor(private director: OfficeDirector, options: DemoTimelineOptions = {}) {
    this.speed = options.speed ?? 1
  }

  get isRunning(): boolean {
    return this.running
  }

  cancel(): void {
    this.cancelled = true
  }

  // Seed the office with demo agents and the initial task, then run the
  // scripted workflow to completion.
  async run(): Promise<void> {
    if (this.running) return
    this.running = true
    this.cancelled = false
    try {
      await this.seed()
      await this.workflow()
    } finally {
      this.running = false
    }
  }

  private async seed(): Promise<void> {
    for (const agent of DEMO_AGENTS) {
      this.director.createAgent(agent)
      await this.delay(120)
    }
    this.director.createTask(DEMO_TASK)
    await this.delay(400)
  }

  private async workflow(): Promise<void> {
    const d = this.director
    const ceo = 'demo-ceo'
    const backend = 'demo-backend'
    const qa = 'demo-qa'

    // 1. CEO receives the task and thinks.
    d.think(ceo)
    d.updateTask({ ...DEMO_TASK, status: 'planning', assignedAgentId: ceo })
    await this.delay(900)

    // 2. CEO walks to the backend developer and assigns the task.
    const devSeat = d.workstationSeat('backend')
    if (devSeat) await d.walk(ceo, devSeat)
    d.setState(ceo, 'communicating')
    await this.delay(300)
    await d.message(ceo, backend, 'task_assignment')
    d.updateTask({ ...DEMO_TASK, status: 'assigned', assignedAgentId: backend })
    await this.delay(500)

    // 3. CEO returns to their office; developer walks to their workstation.
    const ceoSeat = d.workstationSeat('ceo')
    if (ceoSeat) await d.walk(ceo, ceoSeat)
    d.setState(ceo, 'waiting')
    await d.workAt(backend, 'coding')
    d.updateTask({ ...DEMO_TASK, status: 'in_progress', assignedAgentId: backend })
    await this.delay(1400)

    // 4. Developer sends a QA request.
    d.setState(backend, 'communicating')
    await this.delay(200)
    await d.message(backend, qa, 'approval_request')
    await this.delay(400)

    // 5. QA walks to their workstation and reviews.
    await d.workAt(qa, 'reviewing')
    d.updateTask({ ...DEMO_TASK, status: 'review' })
    await this.delay(1200)

    // 6. QA finds an issue and sends a warning back to the developer.
    d.setState(qa, 'communicating')
    await this.delay(200)
    await d.message(qa, backend, 'warning')
    d.fail(backend)
    d.updateTask({ ...DEMO_TASK, status: 'blocked' })
    await this.delay(700)

    // 7. Developer fixes the issue and re-requests review.
    await d.workAt(backend, 'coding')
    d.updateTask({ ...DEMO_TASK, status: 'in_progress' })
    await this.delay(1100)
    d.setState(backend, 'communicating')
    await this.delay(150)
    await d.message(backend, qa, 'approval_request')
    await this.delay(400)

    // 8. QA re-reviews and approves.
    await d.workAt(qa, 'reviewing')
    d.updateTask({ ...DEMO_TASK, status: 'review' })
    await this.delay(900)
    d.succeed(qa)
    await d.message(qa, ceo, 'success')
    d.updateTask({ ...DEMO_TASK, status: 'completed' })
    await this.delay(500)

    // 9. CEO reports success and everyone settles.
    d.succeed(ceo)
    await this.delay(700)
    d.idle(ceo)
    d.idle(backend)
    d.idle(qa)
  }

  private async delay(ms: number): Promise<void> {
    if (this.cancelled) return
    await new Promise((r) => setTimeout(r, ms / this.speed))
    if (this.cancelled) return
  }
}

export function demoAgents(): AgentDescriptor[] {
  return DEMO_AGENTS.map((a) => ({ ...a }))
}

export function roleToDemoId(role: AgentRole): string | undefined {
  return DEMO_AGENTS.find((a) => a.role === role)?.id
}

export const DEMO_MESSAGE_KINDS: MessageKind[] = [
  'task_assignment',
  'approval_request',
  'warning',
  'success',
]
