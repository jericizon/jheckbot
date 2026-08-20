export const PORTS = {
  WEB: 8800,
  API: 8801,
  POSTGRES_HOST: 8802,
  POSTGRES_CONTAINER: 5432,
} as const

export const DEFAULT_ALLOWED_ROOT = '/home/jeric/Workspace'

export const AGENT_LIMITS = {
  MAX_RUNTIME_MS: 3600000,
  MAX_CONCURRENT_SESSIONS: 3,
  MAX_PROMPTS_PER_CONVERSATION: 1,
} as const

export const API_ROUTES = {
  AUTH: '/api/auth',
  PROJECTS: '/api/projects',
  CONVERSATIONS: '/api/conversations',
  MESSAGES: '/api/messages',
  AGENT: '/api/agent',
  HEALTH: '/health',
} as const
