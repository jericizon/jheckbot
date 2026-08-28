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

export interface AgentStatusBar {
  barClass: string
  /** 0-100 fill representing activity/health for the tile-game status bar. */
  percent: number
  glow: boolean
}

/**
 * Maps an agent status to a cartoon "health"/activity bar used on office tiles.
 * Active states pulse; completed is full; idle is near-empty.
 */
export function getAgentStatusBar(status: AgentStatus): AgentStatusBar {
  switch (status) {
    case 'completed':
      return { barClass: 'bg-emerald-500', percent: 100, glow: false }
    case 'working':
      return { barClass: 'bg-sky-500', percent: 65, glow: true }
    case 'testing':
      return { barClass: 'bg-lime-500', percent: 60, glow: true }
    case 'reviewing':
      return { barClass: 'bg-purple-500', percent: 55, glow: true }
    case 'communicating':
      return { barClass: 'bg-blue-500', percent: 50, glow: true }
    case 'thinking':
      return { barClass: 'bg-amber-500', percent: 45, glow: true }
    case 'blocked':
      return { barClass: 'bg-amber-600', percent: 35, glow: false }
    case 'error':
      return { barClass: 'bg-red-500', percent: 20, glow: false }
    case 'idle':
    default:
      return { barClass: 'bg-content-subtle/50', percent: 8, glow: false }
  }
}

export interface CubicleStatusProp {
  emoji: string
  label: string
}

// Desk prop reflecting current activity, shown on the cubicle tile.
export function getCubicleStatusProp(status: AgentStatus): CubicleStatusProp {
  switch (status) {
    case 'working':
      return { emoji: '💻', label: 'At work' }
    case 'testing':
      return { emoji: '🧪', label: 'Testing' }
    case 'reviewing':
      return { emoji: '🔍', label: 'Reviewing' }
    case 'communicating':
      return { emoji: '💬', label: 'In a meeting' }
    case 'thinking':
      return { emoji: '☕', label: 'Thinking' }
    case 'blocked':
      return { emoji: '🚧', label: 'Blocked' }
    case 'error':
      return { emoji: '⚠️', label: 'Error' }
    case 'completed':
      return { emoji: '✅', label: 'Done' }
    case 'idle':
    default:
      return { emoji: '💤', label: 'Idle' }
  }
}
