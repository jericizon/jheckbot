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

// Curated subset of Devin CLI model families.
// The full list is available via `devin models list` (40+ families).
// Each family exposes the thinking levels it actually supports, so the UI can
// offer a level selector without showing invalid combinations.
export type ThinkingLevel =
  'none' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh' | 'max' | 'default'

export interface ModelVariant {
  // Full model id passed to the Devin CLI.
  id: string
  level: ThinkingLevel
  // Per-token pricing summary; 'Free' when the variant is free.
  pricing: string
  free: boolean
}

export interface ModelFamily {
  id: string
  label: string
  context: string
  tier: 'free' | 'budget' | 'mid' | 'premium'
  variants: ModelVariant[]
}

// Display order for thinking levels (lowest effort -> highest).
export const THINKING_LEVEL_ORDER: ThinkingLevel[] = [
  'none',
  'minimal',
  'low',
  'medium',
  'high',
  'xhigh',
  'max',
  'default',
]

export const THINKING_LEVEL_LABELS: Record<ThinkingLevel, string> = {
  none: 'No Thinking',
  minimal: 'Minimal',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  xhigh: 'XHigh',
  max: 'Max',
  default: 'Standard',
}

export const DEVIN_MODEL_FAMILIES: ModelFamily[] = [
  // Free
  {
    id: 'glm-5.2',
    label: 'GLM-5.2',
    context: '200K',
    tier: 'free',
    variants: [
      { id: 'glm-5-2', level: 'high', pricing: 'Free', free: true },
      { id: 'glm-5-2-none', level: 'none', pricing: '$0.70/$2.20 per MTok', free: false },
      { id: 'glm-5-2-max', level: 'max', pricing: '$0.70/$2.20 per MTok', free: false },
    ],
  },
  {
    id: 'swe-1.7',
    label: 'SWE-1.7',
    context: '262K',
    tier: 'free',
    variants: [
      { id: 'swe-1-7', level: 'max', pricing: 'Free', free: true },
      { id: 'swe-1-7-medium', level: 'medium', pricing: 'Free', free: true },
    ],
  },

  // Budget
  {
    id: 'deepseek-v4-flash',
    label: 'DeepSeek V4 Flash',
    context: '1M',
    tier: 'budget',
    variants: [
      { id: 'deepseek-v4-flash-low', level: 'low', pricing: '$0.14/$0.28 per MTok', free: false },
      { id: 'deepseek-v4-flash-high', level: 'high', pricing: '$0.14/$0.28 per MTok', free: false },
      { id: 'deepseek-v4-flash-max', level: 'max', pricing: '$0.14/$0.28 per MTok', free: false },
    ],
  },
  {
    id: 'gpt-5.6-luna',
    label: 'GPT-5.6 Luna',
    context: '1M',
    tier: 'budget',
    variants: [
      { id: 'gpt-5-6-luna-none', level: 'none', pricing: '$0.20/$1.20 per MTok', free: false },
      { id: 'gpt-5-6-luna-low', level: 'low', pricing: '$0.20/$1.20 per MTok', free: false },
      { id: 'gpt-5-6-luna-medium', level: 'medium', pricing: '$0.20/$1.20 per MTok', free: false },
      { id: 'gpt-5-6-luna-high', level: 'high', pricing: '$0.20/$1.20 per MTok', free: false },
      { id: 'gpt-5-6-luna-xhigh', level: 'xhigh', pricing: '$0.20/$1.20 per MTok', free: false },
      { id: 'gpt-5-6-luna-max', level: 'max', pricing: '$0.20/$1.20 per MTok', free: false },
    ],
  },
  {
    id: 'swe-1.6',
    label: 'SWE-1.6',
    context: '200K',
    tier: 'budget',
    variants: [{ id: 'swe-1-6', level: 'default', pricing: '$0.50/$2.50 per MTok', free: false }],
  },
  {
    id: 'swe-1.6-fast',
    label: 'SWE-1.6 Fast',
    context: '200K',
    tier: 'budget',
    variants: [
      { id: 'swe-1-6-fast', level: 'default', pricing: '$0.50/$2.50 per MTok', free: false },
    ],
  },
  {
    id: 'nemotron-3-ultra',
    label: 'Nemotron 3 Ultra',
    context: '1M',
    tier: 'budget',
    variants: [
      { id: 'nemotron-3-ultra-none', level: 'none', pricing: '$0.60/$2.40 per MTok', free: false },
      {
        id: 'nemotron-3-ultra-medium',
        level: 'medium',
        pricing: '$0.60/$2.40 per MTok',
        free: false,
      },
      { id: 'nemotron-3-ultra-high', level: 'high', pricing: '$0.60/$2.40 per MTok', free: false },
    ],
  },
  {
    id: 'kimi-k2.7',
    label: 'Kimi K2.7',
    context: '262K',
    tier: 'budget',
    variants: [{ id: 'kimi-k2-7', level: 'default', pricing: '$0.95/$4.00 per MTok', free: false }],
  },

  // Mid-range
  {
    id: 'gemini-3.7-flash',
    label: 'Gemini 3.7 Flash',
    context: '1M',
    tier: 'mid',
    variants: [
      { id: 'gemini-3-7-flash-low', level: 'low', pricing: '$0.75/$3.75 per MTok', free: false },
      {
        id: 'gemini-3-7-flash-medium',
        level: 'medium',
        pricing: '$0.75/$3.75 per MTok',
        free: false,
      },
      { id: 'gemini-3-7-flash-high', level: 'high', pricing: '$0.75/$3.75 per MTok', free: false },
    ],
  },
  {
    id: 'gpt-5.4-mini',
    label: 'GPT-5.4 Mini',
    context: '400K',
    tier: 'mid',
    variants: [
      { id: 'gpt-5-4-mini-low', level: 'low', pricing: '$0.75/$4.50 per MTok', free: false },
      { id: 'gpt-5-4-mini-medium', level: 'medium', pricing: '$0.75/$4.50 per MTok', free: false },
      { id: 'gpt-5-4-mini-high', level: 'high', pricing: '$0.75/$4.50 per MTok', free: false },
      { id: 'gpt-5-4-mini-xhigh', level: 'xhigh', pricing: '$0.75/$4.50 per MTok', free: false },
    ],
  },
  {
    id: 'gemini-3-flash',
    label: 'Gemini 3 Flash',
    context: '1M',
    tier: 'mid',
    variants: [
      {
        id: 'MODEL_GOOGLE_GEMINI_3_0_FLASH_MINIMAL',
        level: 'minimal',
        pricing: '$0.50/$3.00 per MTok',
        free: false,
      },
      {
        id: 'MODEL_GOOGLE_GEMINI_3_0_FLASH_LOW',
        level: 'low',
        pricing: '$0.50/$3.00 per MTok',
        free: false,
      },
      {
        id: 'MODEL_GOOGLE_GEMINI_3_0_FLASH_MEDIUM',
        level: 'medium',
        pricing: '$0.50/$3.00 per MTok',
        free: false,
      },
      {
        id: 'MODEL_GOOGLE_GEMINI_3_0_FLASH_HIGH',
        level: 'high',
        pricing: '$0.50/$3.00 per MTok',
        free: false,
      },
    ],
  },
  {
    id: 'claude-sonnet-5',
    label: 'Claude Sonnet 5',
    context: '1M',
    tier: 'mid',
    variants: [
      { id: 'claude-sonnet-5-low', level: 'low', pricing: '$2.00/$10.00 per MTok', free: false },
      {
        id: 'claude-sonnet-5-medium',
        level: 'medium',
        pricing: '$2.00/$10.00 per MTok',
        free: false,
      },
      { id: 'claude-sonnet-5-high', level: 'high', pricing: '$2.00/$10.00 per MTok', free: false },
      {
        id: 'claude-sonnet-5-xhigh',
        level: 'xhigh',
        pricing: '$2.00/$10.00 per MTok',
        free: false,
      },
      { id: 'claude-sonnet-5-max', level: 'max', pricing: '$2.00/$10.00 per MTok', free: false },
    ],
  },
  {
    id: 'gpt-5.6-sol',
    label: 'GPT-5.6 Sol',
    context: '1M',
    tier: 'mid',
    variants: [
      { id: 'gpt-5-6-sol-none', level: 'none', pricing: '$1.20/$6.00 per MTok', free: false },
      { id: 'gpt-5-6-sol-low', level: 'low', pricing: '$1.20/$6.00 per MTok', free: false },
      { id: 'gpt-5-6-sol-medium', level: 'medium', pricing: '$1.20/$6.00 per MTok', free: false },
      { id: 'gpt-5-6-sol-high', level: 'high', pricing: '$1.20/$6.00 per MTok', free: false },
      { id: 'gpt-5-6-sol-xhigh', level: 'xhigh', pricing: '$1.20/$6.00 per MTok', free: false },
      { id: 'gpt-5-6-sol-max', level: 'max', pricing: '$1.20/$6.00 per MTok', free: false },
    ],
  },
  {
    id: 'gpt-5.3-codex',
    label: 'GPT-5.3-Codex',
    context: '400K',
    tier: 'mid',
    variants: [
      { id: 'gpt-5-3-codex-low', level: 'low', pricing: '$1.75/$14.00 per MTok', free: false },
      {
        id: 'gpt-5-3-codex-medium',
        level: 'medium',
        pricing: '$1.75/$14.00 per MTok',
        free: false,
      },
      { id: 'gpt-5-3-codex-high', level: 'high', pricing: '$1.75/$14.00 per MTok', free: false },
      { id: 'gpt-5-3-codex-xhigh', level: 'xhigh', pricing: '$1.75/$14.00 per MTok', free: false },
    ],
  },

  // Premium
  {
    id: 'claude-sonnet-4.6',
    label: 'Claude Sonnet 4.6',
    context: '200K',
    tier: 'premium',
    variants: [
      { id: 'claude-sonnet-4-6', level: 'default', pricing: '$3.00/$15.00 per MTok', free: false },
      {
        id: 'claude-sonnet-4-6-thinking',
        level: 'high',
        pricing: '$3.00/$15.00 per MTok',
        free: false,
      },
    ],
  },
  {
    id: 'claude-opus-5',
    label: 'Claude Opus 5',
    context: '1M',
    tier: 'premium',
    variants: [
      { id: 'claude-opus-5-low', level: 'low', pricing: '$5.00/$25.00 per MTok', free: false },
      {
        id: 'claude-opus-5-medium',
        level: 'medium',
        pricing: '$5.00/$25.00 per MTok',
        free: false,
      },
      { id: 'claude-opus-5-high', level: 'high', pricing: '$5.00/$25.00 per MTok', free: false },
      { id: 'claude-opus-5-xhigh', level: 'xhigh', pricing: '$5.00/$25.00 per MTok', free: false },
      { id: 'claude-opus-5-max', level: 'max', pricing: '$5.00/$25.00 per MTok', free: false },
    ],
  },
  {
    id: 'gpt-5.5',
    label: 'GPT-5.5',
    context: '272K',
    tier: 'premium',
    variants: [
      { id: 'gpt-5-5-none', level: 'none', pricing: '$5.00/$30.00 per MTok', free: false },
      { id: 'gpt-5-5-low', level: 'low', pricing: '$5.00/$30.00 per MTok', free: false },
      { id: 'gpt-5-5-medium', level: 'medium', pricing: '$5.00/$30.00 per MTok', free: false },
      { id: 'gpt-5-5-high', level: 'high', pricing: '$5.00/$30.00 per MTok', free: false },
      { id: 'gpt-5-5-xhigh', level: 'xhigh', pricing: '$5.00/$30.00 per MTok', free: false },
    ],
  },
  {
    id: 'grok-4.6',
    label: 'Grok 4.6',
    context: '500K',
    tier: 'premium',
    variants: [
      { id: 'grok-4-6-low', level: 'low', pricing: '$2.00/$6.00 per MTok', free: false },
      { id: 'grok-4-6-medium', level: 'medium', pricing: '$2.00/$6.00 per MTok', free: false },
      { id: 'grok-4-6-high', level: 'high', pricing: '$2.00/$6.00 per MTok', free: false },
      { id: 'grok-4-6-xhigh', level: 'xhigh', pricing: '$2.00/$6.00 per MTok', free: false },
    ],
  },
]

export const DEFAULT_DEVIN_MODEL = 'glm-5-2'
