// Core type definitions for the JheckBot virtual office engine.
// The renderer consumes these via the EventBus; it never owns AI logic.

export type Vec2 = { x: number; y: number }

// Visual agent states (spec §12). Distinct from the backend AgentStatus,
// which is a subset mapped onto these by the Vue adapter.
export type AgentVisualState =
  | 'idle'
  | 'walking'
  | 'working'
  | 'thinking'
  | 'reading'
  | 'coding'
  | 'testing'
  | 'reviewing'
  | 'communicating'
  | 'meeting'
  | 'waiting'
  | 'blocked'
  | 'success'
  | 'error'
  | 'offline'

export type AgentRole = 'ceo' | 'backend' | 'frontend' | 'qa' | 'designer' | 'devops'

export type Direction = 'down' | 'up' | 'left' | 'right'

export type TaskVisualStatus =
  | 'queued'
  | 'planning'
  | 'assigned'
  | 'in_progress'
  | 'review'
  | 'blocked'
  | 'completed'
  | 'failed'

export interface AgentDescriptor {
  id: string
  name: string
  role: AgentRole
  provider?: string
  model?: string
}

export interface TaskDescriptor {
  id: string
  title: string
  description?: string
  status: TaskVisualStatus
  priority?: 'low' | 'medium' | 'high' | 'critical'
  assignedAgentId?: string
}

export type MessageKind =
  | 'normal'
  | 'task_assignment'
  | 'question'
  | 'response'
  | 'warning'
  | 'error'
  | 'success'
  | 'approval_request'
  | 'emergency'

// Event bus events (spec §27). The simulation/runtime emits these; the
// renderer subscribes and decides how to visualize each one.
export type OfficeEvent =
  | { type: 'agent.created'; agent: AgentDescriptor; tile: Vec2 }
  | { type: 'agent.offline'; agentId: string }
  | { type: 'agent.started'; agentId: string }
  | { type: 'agent.walking'; agentId: string; to: Vec2 }
  | { type: 'agent.arrived'; agentId: string; tile: Vec2 }
  | { type: 'agent.working'; agentId: string }
  | { type: 'agent.coding'; agentId: string }
  | { type: 'agent.thinking'; agentId: string }
  | { type: 'agent.testing'; agentId: string }
  | { type: 'agent.reviewing'; agentId: string }
  | { type: 'agent.reading'; agentId: string }
  | { type: 'agent.communicating'; agentId: string }
  | { type: 'agent.meeting'; agentId: string; tile: Vec2 }
  | { type: 'agent.waiting'; agentId: string }
  | { type: 'agent.blocked'; agentId: string }
  | { type: 'agent.success'; agentId: string }
  | { type: 'agent.error'; agentId: string }
  | { type: 'agent.idle'; agentId: string }
  | { type: 'agent.message.sent'; from: string; to: string; messageId: string; kind: MessageKind }
  | { type: 'agent.message.received'; messageId: string; to: string }
  | { type: 'agent.task.assigned'; agentId: string; task: TaskDescriptor }
  | { type: 'agent.task.completed'; agentId: string; taskId: string }
  | { type: 'agent.task.failed'; agentId: string; taskId: string }
  | { type: 'meeting.started'; participantIds: string[]; tile: Vec2 }
  | { type: 'meeting.ended'; participantIds: string[] }
  | { type: 'task.created'; task: TaskDescriptor }
  | { type: 'task.updated'; task: TaskDescriptor }

export type OfficeEventHandler = (event: OfficeEvent) => void

// --- Character design sheet types (spec §28, §10, §11, §9, §8, §16) ---

// Walk parameters describing per-role movement personality (spec §9).
export interface WalkParams {
  speedMultiplier: number
  stride: string
  bounce: string
}

// Silhouette parameters that make each role visually distinct even as a
// dark outline (spec §10, §11). heightScale uses the §11 scale values.
export interface SilhouetteParams {
  heightScale: number
  shoulderWidth: number
  headShape: 'round' | 'square' | 'oval' | 'wide'
  postureOffset: number
}

// Idle behavior step kinds — each role has a unique sequence (spec §8).
export type IdleBehavior =
  | 'check_task_board'
  | 'look_around'
  | 'walk'
  | 'observe'
  | 'type'
  | 'pause'
  | 'stretch'
  | 'stand'
  | 'inspect_board'
  | 'sit'
  | 'look_at_monitor'
  | 'inspect'
  | 'return'
  | 'check_monitor'
  | 'walk_to_server'
  | 'read'
  | 'write'
  | 'think'

// Workstation activity kinds — each role has a distinct working sequence
// (spec §16).
export type ActivityKind =
  | 'coding'
  | 'typing'
  | 'drawing'
  | 'testing'
  | 'monitoring'
  | 'reading'
  | 'writing'
  | 'thinking_pause'
  | 'board_check'
  | 'server_check'
  | 'task_board_read'
  | 'communicating'

// Interrupt priority for the agent state machine (spec §19).
export type InterruptPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

// Pure-data archetype describing one character's design (spec §28).
// Consumed by the renderer in later tasks; no rendering logic lives here.
export interface CharacterArchetype {
  silhouette: SilhouetteParams
  accessory: string
  walk: WalkParams
  idleSequence: IdleBehavior[]
  workingSequence: ActivityKind[]
  communicationStyle: string
  successReaction: string
  errorReaction: string
}

// Runtime state machine tracking current activity and the ability to resume
// a previous activity after an interrupt (spec §21, §19, §20).
export interface AgentRuntimeState {
  state: AgentVisualState
  activity: ActivityKind | null
  previousState: AgentVisualState | null
  previousActivity: ActivityKind | null
  interruptedBy: InterruptPriority | null
}
