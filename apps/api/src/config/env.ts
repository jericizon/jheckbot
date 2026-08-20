import { PORTS } from '@jheckbot/shared'

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

function optional(name: string, fallback: string): string {
  return process.env[name] ?? fallback
}

export const env = {
  nodeEnv: optional('NODE_ENV', 'development'),
  apiPort: Number(optional('API_PORT', String(PORTS.API))),
  databaseUrl: required('DATABASE_URL', 'postgresql://jheckbot:change-me-locally@127.0.0.1:8802/jheckbot'),
  sessionSecret: required('SESSION_SECRET', 'dev-only-not-secret'),
  devinBin: optional('DEVIN_BIN', '/home/jeric/.local/bin/devin'),
  tmuxBin: optional('TMUX_BIN', '/usr/bin/tmux'),
  allowedRoots: optional('ALLOWED_ROOTS', '/home/jeric/Workspace'),
  agentMaxRuntimeMs: Number(optional('AGENT_MAX_RUNTIME_MS', '3600000')),
  cookieSecure: optional('COOKIE_SECURE', 'false') === 'true',
  cookieSameSite: optional('COOKIE_SAME_SITE', 'lax') as 'lax' | 'strict' | 'none',
  adminUsername: optional('ADMIN_USERNAME', 'admin'),
  adminPassword: optional('ADMIN_PASSWORD', 'admin'),
} as const

export type Env = typeof env
