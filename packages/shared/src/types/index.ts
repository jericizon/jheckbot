// Placeholder types — expanded in later phases with full schema.

export interface Project {
  id: string
  name: string
  path: string
  createdAt: string
  updatedAt: string
}

export interface Conversation {
  id: string
  projectId: string
  title: string
  createdAt: string
  updatedAt: string
}

export type MessageRole = 'user' | 'assistant' | 'system'

export interface Message {
  id: string
  conversationId: string
  role: MessageRole
  content: string
  createdAt: string
}

export type AgentSessionStatus = 'idle' | 'running' | 'stopped' | 'error'

export interface AgentSession {
  id: string
  conversationId: string
  devinSessionId?: string
  status: AgentSessionStatus
  startedAt?: string
  endedAt?: string
}

export interface HealthStatus {
  status: 'ok' | 'degraded' | 'down'
  services: {
    database: 'connected' | 'disconnected' | 'unknown'
    tmux: 'available' | 'missing' | 'unknown'
    devin: 'available' | 'missing' | 'unknown'
  }
  timestamp: string
}

export type SkillTrigger = 'user' | 'model'

// Mirrors `devin skills list --json` output.
export interface Skill {
  name: string
  description: string
  triggers: SkillTrigger[]
  provider: string
  base_dir: string
  display_name: string
  warnings: string[]
  errors: string[]
}
