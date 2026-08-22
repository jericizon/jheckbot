import type { Skill } from '@jheckbot/shared'
import type { ModelOption } from '@jheckbot/shared'
import type { TmuxSession } from './TmuxManager.js'

export type AgentSessionStatus = 'starting' | 'running' | 'stopped' | 'failed'

export interface AgentSessionInfo {
  sessionName: string
  sessionId?: string
  status: AgentSessionStatus
  startedAt: string
}

export interface StartAgentOptions {
  sessionName: string
  cwd: string
  prompt: string
  resumeSessionId?: string
  model?: string
  env?: Record<string, string>
  bypass?: boolean
  providerConfig?: Record<string, unknown>
}

export class AgentAdapterError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AgentAdapterError'
  }
}

export interface AgentAdapter {
  readonly providerId: string
  readonly displayName: string

  isAvailable(): boolean
  defaultModel(): string
  supportedModels(): ModelOption[]
  hasSkills(): boolean
  listSkills?(): Skill[] | Promise<Skill[]>

  start(opts: StartAgentOptions): AgentSessionInfo
  sendPrompt(sessionName: string, prompt: string): void
  stop(sessionName: string): void
  forceKill(sessionName: string): void
  captureOutput(sessionName: string, startLine?: number | '-'): string[]
  isRunning(sessionName: string): boolean
  listSessions(): TmuxSession[]
  getExitCode(sessionName: string): number | null

  captureSessionId?(sessionName: string): string | undefined
  discoverSessionId?(cwd: string, sinceMs?: number): string | undefined
  normalizeOutput?(lines: string[]): string[]
}
