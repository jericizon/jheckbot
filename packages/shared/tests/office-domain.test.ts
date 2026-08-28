import { describe, expect, it } from 'vitest'
import {
  AGENT_STATUSES,
  EVENT_TYPES,
  MEMORY_SCOPES,
  MESSAGE_TYPES,
  OFFICE_STATUSES,
  TASK_PRIORITIES,
  TASK_STATUSES,
  WORKFLOW_RUN_STATUSES,
  WORKFLOW_STEP_STATUSES,
  WORKFLOW_TYPES,
} from '../src/constants/office.js'
import {
  isValidAgentStatus,
  isValidEventType,
  isValidMemoryScope,
  isValidMessageType,
  isValidOfficeStatus,
  isValidTaskPriority,
  isValidTaskStatus,
  isValidTaskStatusTransition,
  isValidWorkflowRunStatus,
  isValidWorkflowStepStatus,
  isValidWorkflowType,
} from '../src/validation/office.js'

describe('Office domain constants', () => {
  it('contains the agent visual statuses from the spec', () => {
    expect(AGENT_STATUSES).toEqual([
      'idle',
      'thinking',
      'working',
      'communicating',
      'reviewing',
      'testing',
      'blocked',
      'error',
      'completed',
    ])
  })

  it('contains the task statuses from the spec', () => {
    expect(TASK_STATUSES).toContain('backlog')
    expect(TASK_STATUSES).toContain('working')
    expect(TASK_STATUSES).toContain('completed')
    expect(TASK_STATUSES).toContain('cancelled')
    expect(TASK_STATUSES).toHaveLength(12)
  })

  it('contains the message types from the spec', () => {
    expect(MESSAGE_TYPES).toContain('TASK_ASSIGNED')
    expect(MESSAGE_TYPES).toContain('QUESTION')
    expect(MESSAGE_TYPES).toContain('ESCALATION')
    expect(MESSAGE_TYPES).toContain('TASK_COMPLETED')
  })

  it('contains the event types from the spec', () => {
    expect(EVENT_TYPES).toContain('OFFICE_CREATED')
    expect(EVENT_TYPES).toContain('CEO_PLANNING')
    expect(EVENT_TYPES).toContain('TASK_BLOCKED')
    expect(EVENT_TYPES).toContain('USER_ACTION_REQUIRED')
  })

  it('contains the memory scopes from the spec', () => {
    expect(MEMORY_SCOPES).toEqual(['global', 'project', 'agent', 'task'])
  })

  it('contains workflow types', () => {
    expect(WORKFLOW_TYPES).toEqual(['simple', 'medium', 'complex', 'custom'])
  })

  it('contains workflow run and step statuses', () => {
    expect(WORKFLOW_RUN_STATUSES).toEqual(['pending', 'running', 'completed', 'failed', 'cancelled'])
    expect(WORKFLOW_STEP_STATUSES).toEqual(['pending', 'working', 'completed', 'failed', 'cancelled', 'blocked'])
  })

  it('contains office statuses', () => {
    expect(OFFICE_STATUSES).toEqual(['active', 'archived'])
  })

  it('contains task priorities', () => {
    expect(TASK_PRIORITIES).toEqual(['low', 'medium', 'high', 'critical'])
  })
})

describe('Office domain validation', () => {
  it('validates agent statuses', () => {
    expect(isValidAgentStatus('working')).toBe(true)
    expect(isValidAgentStatus('sleeping')).toBe(false)
    expect(isValidAgentStatus(123)).toBe(false)
  })

  it('validates task statuses', () => {
    expect(isValidTaskStatus('qa')).toBe(true)
    expect(isValidTaskStatus('done')).toBe(false)
  })

  it('validates task priorities', () => {
    expect(isValidTaskPriority('critical')).toBe(true)
    expect(isValidTaskPriority('urgent')).toBe(false)
  })

  it('validates message types', () => {
    expect(isValidMessageType('HANDOFF')).toBe(true)
    expect(isValidMessageType('HELLO')).toBe(false)
  })

  it('validates event types', () => {
    expect(isValidEventType('AGENT_COMPLETED')).toBe(true)
    expect(isValidEventType('UNKNOWN')).toBe(false)
  })

  it('validates memory scopes', () => {
    expect(isValidMemoryScope('project')).toBe(true)
    expect(isValidMemoryScope('user')).toBe(false)
  })

  it('validates office statuses', () => {
    expect(isValidOfficeStatus('active')).toBe(true)
    expect(isValidOfficeStatus('deleted')).toBe(false)
  })

  it('validates workflow types', () => {
    expect(isValidWorkflowType('simple')).toBe(true)
    expect(isValidWorkflowType('huge')).toBe(false)
  })

  it('validates workflow run and step statuses', () => {
    expect(isValidWorkflowRunStatus('running')).toBe(true)
    expect(isValidWorkflowStepStatus('blocked')).toBe(true)
    expect(isValidWorkflowRunStatus('blocked')).toBe(false)
  })
})

describe('Task status transitions', () => {
  it('allows the standard happy path', () => {
    expect(isValidTaskStatusTransition('backlog', 'planning')).toBe(true)
    expect(isValidTaskStatusTransition('planning', 'ready')).toBe(true)
    expect(isValidTaskStatusTransition('ready', 'assigned')).toBe(true)
    expect(isValidTaskStatusTransition('assigned', 'working')).toBe(true)
    expect(isValidTaskStatusTransition('working', 'review')).toBe(true)
    expect(isValidTaskStatusTransition('review', 'qa')).toBe(true)
    expect(isValidTaskStatusTransition('qa', 'testing')).toBe(true)
    expect(isValidTaskStatusTransition('testing', 'completed')).toBe(true)
  })

  it('allows rejection/rework loops', () => {
    expect(isValidTaskStatusTransition('review', 'working')).toBe(true)
    expect(isValidTaskStatusTransition('qa', 'working')).toBe(true)
    expect(isValidTaskStatusTransition('testing', 'working')).toBe(true)
    expect(isValidTaskStatusTransition('failed', 'working')).toBe(true)
  })

  it('allows direct completion from qa for simple workflows', () => {
    expect(isValidTaskStatusTransition('qa', 'completed')).toBe(true)
  })

  it('blocks transitions to non-existent statuses', () => {
    expect(isValidTaskStatusTransition('working', 'archived')).toBe(false)
    expect(isValidTaskStatusTransition('backlog', 'completed')).toBe(false)
  })

  it('blocks terminal statuses from changing', () => {
    expect(isValidTaskStatusTransition('completed', 'working')).toBe(false)
    expect(isValidTaskStatusTransition('cancelled', 'backlog')).toBe(false)
  })

  it('allows idempotent same-status transitions', () => {
    for (const status of TASK_STATUSES) {
      expect(isValidTaskStatusTransition(status, status)).toBe(true)
    }
  })
})
