import type {
  AgentStatus,
  EventType,
  MemoryScope,
  MessageType,
  OfficeStatus,
  TaskPriority,
  TaskStatus,
  WorkflowRunStatus,
  WorkflowStepStatus,
} from '../constants/office.js'

export interface Office {
  id: string
  name: string
  projectId?: string
  userId?: string
  status: OfficeStatus
  config?: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export interface OfficeAgent {
  id: string
  officeId: string
  name: string
  role: string
  description?: string
  avatar?: string
  personality?: string
  instructions?: string
  responsibilities?: string
  provider?: string
  model?: string
  skills?: string[]
  tools?: string[]
  permissions?: Record<string, unknown>
  projectAccess?: string[]
  status: AgentStatus
  enabled: boolean
  createdAt: string
  updatedAt: string
}

export interface OfficeAgentCapability {
  id: string
  agentId: string
  capability: string
  createdAt: string
}

export interface OfficeAgentMemory {
  id: string
  agentId?: string
  projectId?: string
  scope: MemoryScope
  memoryType?: string
  content: string
  importance: number
  createdAt: string
  updatedAt: string
}

export interface OfficeTask {
  id: string
  officeId: string
  projectId?: string
  parentTaskId?: string
  title: string
  description?: string
  acceptanceCriteria?: string
  status: TaskStatus
  priority: TaskPriority
  assignedAgentId?: string
  createdBy?: string
  workflowType?: string
  metadata?: Record<string, unknown>
  startedAt?: string
  completedAt?: string
  createdAt: string
  updatedAt: string
}

export interface OfficeTaskDependency {
  taskId: string
  dependsOnTaskId: string
  createdAt: string
}

export interface OfficeAgentMessage {
  id: string
  officeId: string
  taskId?: string
  fromAgentId?: string
  toAgentId?: string
  type: MessageType
  content: string
  metadata?: Record<string, unknown>
  createdAt: string
}

export interface OfficeWorkflowRun {
  id: string
  officeId: string
  rootTaskId?: string
  status: WorkflowRunStatus
  startedAt?: string
  completedAt?: string
  metadata?: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export interface OfficeWorkflowStep {
  id: string
  workflowRunId: string
  taskId?: string
  stepType: string
  status: WorkflowStepStatus
  sequence: number
  metadata?: Record<string, unknown>
  startedAt?: string
  completedAt?: string
  createdAt: string
  updatedAt: string
}

export interface OfficeEvent {
  id: string
  officeId: string
  eventType: EventType
  content?: string
  metadata?: Record<string, unknown>
  createdAt: string
}
