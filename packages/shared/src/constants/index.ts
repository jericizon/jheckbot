export const PORTS = {
  WEB: 8800,
  API: 8801,
  POSTGRES_HOST: 8802,
  POSTGRES_CONTAINER: 5432,
} as const

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

// Curated subset of Devin CLI models.
// The full list is available via `devin models list` (40+ families).
// This curated set covers the most useful families for development work.
export interface ModelOption {
  id: string
  label: string
  family: string
  context: string
  pricing: string
  free: boolean
}

export const DEVIN_MODELS: ModelOption[] = [
  // Free
  { id: 'glm-5-2', label: 'GLM-5.2 High', family: 'GLM-5.2', context: '200K', pricing: 'Free', free: true },

  // Budget
  { id: 'deepseek-v4-flash-low', label: 'DeepSeek V4 Flash Low', family: 'DeepSeek V4 Flash', context: '1M', pricing: '$0.14/$0.28 per MTok', free: false },
  { id: 'deepseek-v4-flash-high', label: 'DeepSeek V4 Flash High', family: 'DeepSeek V4 Flash', context: '1M', pricing: '$0.14/$0.28 per MTok', free: false },
  { id: 'gpt-5-6-luna-low', label: 'GPT-5.6 Luna Low', family: 'GPT-5.6 Luna', context: '1M', pricing: '$0.20/$1.20 per MTok', free: false },
  { id: 'gpt-5-6-luna-high', label: 'GPT-5.6 Luna High', family: 'GPT-5.6 Luna', context: '1M', pricing: '$0.20/$1.20 per MTok', free: false },
  { id: 'swe-1-6', label: 'SWE-1.6', family: 'SWE-1.6', context: '200K', pricing: '$0.50/$2.50 per MTok', free: false },
  { id: 'swe-1-6-fast', label: 'SWE-1.6 Fast', family: 'SWE-1.6 Fast', context: '200K', pricing: '$0.50/$2.50 per MTok', free: false },
  { id: 'swe-1-7', label: 'SWE-1.7 Max', family: 'SWE-1.7', context: '262K', pricing: 'Free', free: true },
  { id: 'swe-1-7-medium', label: 'SWE-1.7 Medium', family: 'SWE-1.7', context: '262K', pricing: 'Free', free: true },
  { id: 'nemotron-3-ultra-high', label: 'Nemotron 3 Ultra High', family: 'Nemotron 3 Ultra', context: '1M', pricing: '$0.60/$2.40 per MTok', free: false },
  { id: 'kimi-k2-7', label: 'Kimi K2.7', family: 'Kimi K2.7', context: '262K', pricing: '$0.95/$4.00 per MTok', free: false },

  // Mid-range
  { id: 'gemini-3-7-flash-high', label: 'Gemini 3.7 Flash High', family: 'Gemini 3.7 Flash', context: '1M', pricing: '$0.75/$3.75 per MTok', free: false },
  { id: 'gpt-5-4-mini-high', label: 'GPT-5.4 Mini High', family: 'GPT-5.4 Mini', context: '400K', pricing: '$0.75/$4.50 per MTok', free: false },
  { id: 'gemini-3-flash-high', label: 'Gemini 3 Flash High', family: 'Gemini 3 Flash', context: '1M', pricing: '$0.50/$3.00 per MTok', free: false },
  { id: 'claude-sonnet-5-high', label: 'Claude Sonnet 5 High', family: 'Claude Sonnet 5', context: '1M', pricing: '$2.00/$10.00 per MTok', free: false },
  { id: 'gpt-5-6-sol-high', label: 'GPT-5.6 Sol High', family: 'GPT-5.6 Sol', context: '1M', pricing: '$1.50/$9.00 per MTok', free: false },
  { id: 'gpt-5-3-codex-high', label: 'GPT-5.3-Codex High', family: 'GPT-5.3-Codex', context: '400K', pricing: '$1.75/$14.00 per MTok', free: false },

  // Premium
  { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6', family: 'Claude Sonnet 4.6', context: '200K', pricing: '$3.00/$15.00 per MTok', free: false },
  { id: 'claude-opus-5-high', label: 'Claude Opus 5 High', family: 'Claude Opus 5', context: '1M', pricing: '$5.00/$25.00 per MTok', free: false },
  { id: 'gpt-5-5-high', label: 'GPT-5.5 High', family: 'GPT-5.5', context: '272K', pricing: '$5.00/$30.00 per MTok', free: false },
  { id: 'grok-4-6-high', label: 'Grok 4.6 High', family: 'Grok 4.6', context: '500K', pricing: '$2.00/$6.00 per MTok', free: false },
]

export const DEFAULT_DEVIN_MODEL = 'glm-5-2'
