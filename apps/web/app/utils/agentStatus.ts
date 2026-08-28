import type { AgentStatus } from '@jheckbot/shared'

export interface AgentStatusStyle {
  dotClass: string
  label: string
  animate?: 'pulse' | 'bounce'
}

/**
 * Maps an agent status to a colored dot and accessible label.
 * Aligned with the status mapping in the office spec (lines 1145-1165).
 */
export function getAgentStatusStyle(status: AgentStatus): AgentStatusStyle {
  switch (status) {
    case 'idle':
      return { dotClass: 'bg-content-subtle', label: 'Idle' }
    case 'thinking':
      return { dotClass: 'bg-amber-500', label: 'Thinking', animate: 'pulse' }
    case 'working':
      return { dotClass: 'bg-sky-500', label: 'Working', animate: 'pulse' }
    case 'communicating':
      return { dotClass: 'bg-blue-500', label: 'Talking' }
    case 'reviewing':
      return { dotClass: 'bg-purple-500', label: 'Reviewing' }
    case 'testing':
      return { dotClass: 'bg-lime-500', label: 'Testing' }
    case 'blocked':
      return { dotClass: 'bg-amber-600', label: 'Blocked' }
    case 'error':
      return { dotClass: 'bg-red-500', label: 'Error', animate: 'bounce' }
    case 'completed':
      return { dotClass: 'bg-emerald-500', label: 'Done' }
    default:
      return { dotClass: 'bg-content-subtle', label: status }
  }
}
