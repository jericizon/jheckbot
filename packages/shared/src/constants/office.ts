export const AGENT_STATUSES = [
  'idle',
  'thinking',
  'working',
  'communicating',
  'reviewing',
  'testing',
  'blocked',
  'error',
  'completed',
] as const
export type AgentStatus = (typeof AGENT_STATUSES)[number]

export const TASK_STATUSES = [
  'backlog',
  'planning',
  'ready',
  'assigned',
  'working',
  'blocked',
  'review',
  'qa',
  'testing',
  'completed',
  'failed',
  'cancelled',
] as const
export type TaskStatus = (typeof TASK_STATUSES)[number]

export const TASK_PRIORITIES = ['low', 'medium', 'high', 'critical'] as const
export type TaskPriority = (typeof TASK_PRIORITIES)[number]

export const MESSAGE_TYPES = [
  'TASK_ASSIGNED',
  'TASK_STARTED',
  'QUESTION',
  'ANSWER',
  'PROGRESS',
  'HANDOFF',
  'REVIEW_REQUESTED',
  'REVIEW_RESULT',
  'QA_REQUESTED',
  'QA_RESULT',
  'FEEDBACK',
  'BLOCKED',
  'ESCALATION',
  'TASK_COMPLETED',
  'TASK_FAILED',
] as const
export type MessageType = (typeof MESSAGE_TYPES)[number]

export const EVENT_TYPES = [
  'OFFICE_CREATED',
  'CEO_THINKING',
  'CEO_PLANNING',
  'CEO_DELEGATING',
  'CEO_WAITING',
  'TASK_CREATED',
  'TASK_ASSIGNED',
  'TASK_DISPATCHED',
  'TASK_STARTED',
  'TASK_BLOCKED',
  'TASK_COMPLETED',
  'TASK_FAILED',
  'TASK_RETRY',
  'RECOVERY_STARTED',
  'AGENT_STARTED',
  'AGENT_PROGRESS',
  'AGENT_MESSAGE',
  'AGENT_COMPLETED',
  'AGENT_FAILED',
  'REVIEW_STARTED',
  'REVIEW_APPROVED',
  'REVIEW_REJECTED',
  'QA_STARTED',
  'QA_PASSED',
  'QA_FAILED',
  'TASK_QA_STARTED',
  'TASK_QA_APPROVED',
  'TASK_QA_REJECTED',
  'TASK_REVIEW_STARTED',
  'TASK_REVIEW_APPROVED',
  'TASK_REVIEW_REJECTED',
  'WORKFLOW_STARTED',
  'WORKFLOW_COMPLETED',
  'WORKFLOW_FAILED',
  'USER_ACTION_REQUIRED',
] as const
export type EventType = (typeof EVENT_TYPES)[number]

export const MEMORY_SCOPES = ['global', 'project', 'agent', 'task'] as const
export type MemoryScope = (typeof MEMORY_SCOPES)[number]

export const OFFICE_STATUSES = ['active', 'archived'] as const
export type OfficeStatus = (typeof OFFICE_STATUSES)[number]

export const WORKFLOW_TYPES = ['simple', 'medium', 'complex', 'custom'] as const
export type WorkflowType = (typeof WORKFLOW_TYPES)[number]

export const WORKFLOW_RUN_STATUSES = ['pending', 'running', 'completed', 'failed', 'cancelled'] as const
export type WorkflowRunStatus = (typeof WORKFLOW_RUN_STATUSES)[number]

export const WORKFLOW_STEP_STATUSES = ['pending', 'working', 'completed', 'failed', 'cancelled', 'blocked'] as const
export type WorkflowStepStatus = (typeof WORKFLOW_STEP_STATUSES)[number]

export const TASK_STATUS_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  backlog: ['planning', 'ready', 'cancelled'],
  planning: ['ready', 'backlog', 'cancelled'],
  ready: ['assigned', 'backlog', 'cancelled'],
  assigned: ['working', 'blocked', 'ready', 'cancelled'],
  working: ['review', 'qa', 'testing', 'blocked', 'failed', 'cancelled'],
  blocked: ['working', 'cancelled'],
  review: ['qa', 'working', 'blocked', 'cancelled'],
  qa: ['testing', 'completed', 'working', 'failed', 'cancelled'],
  testing: ['completed', 'working', 'failed', 'cancelled'],
  completed: [],
  failed: ['working', 'cancelled'],
  cancelled: [],
}
