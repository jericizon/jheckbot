import {
  AGENT_STATUSES,
  type AgentStatus,
  EVENT_TYPES,
  type EventType,
  MEMORY_SCOPES,
  type MemoryScope,
  MESSAGE_TYPES,
  type MessageType,
  OFFICE_STATUSES,
  type OfficeStatus,
  TASK_PRIORITIES,
  type TaskPriority,
  TASK_STATUSES,
  TASK_STATUS_TRANSITIONS,
  type TaskStatus,
  WORKFLOW_RUN_STATUSES,
  type WorkflowRunStatus,
  WORKFLOW_STEP_STATUSES,
  type WorkflowStepStatus,
  WORKFLOW_TYPES,
  type WorkflowType,
} from '../constants/office.js'

const AGENT_STATUS_SET = new Set(AGENT_STATUSES)
const TASK_STATUS_SET = new Set(TASK_STATUSES)
const TASK_PRIORITY_SET = new Set(TASK_PRIORITIES)
const MESSAGE_TYPE_SET = new Set(MESSAGE_TYPES)
const EVENT_TYPE_SET = new Set(EVENT_TYPES)
const MEMORY_SCOPE_SET = new Set(MEMORY_SCOPES)
const OFFICE_STATUS_SET = new Set(OFFICE_STATUSES)
const WORKFLOW_TYPE_SET = new Set(WORKFLOW_TYPES)
const WORKFLOW_RUN_STATUS_SET = new Set(WORKFLOW_RUN_STATUSES)
const WORKFLOW_STEP_STATUS_SET = new Set(WORKFLOW_STEP_STATUSES)

export function isValidAgentStatus(value: unknown): value is AgentStatus {
  return typeof value === 'string' && AGENT_STATUS_SET.has(value as AgentStatus)
}

export function isValidTaskStatus(value: unknown): value is TaskStatus {
  return typeof value === 'string' && TASK_STATUS_SET.has(value as TaskStatus)
}

export function isValidTaskPriority(value: unknown): value is TaskPriority {
  return typeof value === 'string' && TASK_PRIORITY_SET.has(value as TaskPriority)
}

export function isValidMessageType(value: unknown): value is MessageType {
  return typeof value === 'string' && MESSAGE_TYPE_SET.has(value as MessageType)
}

export function isValidEventType(value: unknown): value is EventType {
  return typeof value === 'string' && EVENT_TYPE_SET.has(value as EventType)
}

export function isValidMemoryScope(value: unknown): value is MemoryScope {
  return typeof value === 'string' && MEMORY_SCOPE_SET.has(value as MemoryScope)
}

export function isValidOfficeStatus(value: unknown): value is OfficeStatus {
  return typeof value === 'string' && OFFICE_STATUS_SET.has(value as OfficeStatus)
}

export function isValidWorkflowType(value: unknown): value is WorkflowType {
  return typeof value === 'string' && WORKFLOW_TYPE_SET.has(value as WorkflowType)
}

export function isValidWorkflowRunStatus(value: unknown): value is WorkflowRunStatus {
  return typeof value === 'string' && WORKFLOW_RUN_STATUS_SET.has(value as WorkflowRunStatus)
}

export function isValidWorkflowStepStatus(value: unknown): value is WorkflowStepStatus {
  return typeof value === 'string' && WORKFLOW_STEP_STATUS_SET.has(value as WorkflowStepStatus)
}

export function isValidTaskStatusTransition(from: TaskStatus, to: TaskStatus): boolean {
  if (from === to) return true
  const allowed = TASK_STATUS_TRANSITIONS[from]
  return Array.isArray(allowed) && allowed.includes(to)
}
