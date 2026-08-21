import { delimiter } from 'node:path'
import { PORTS } from '@jheckbot/shared'

export interface RuntimeEnv {
  nodeEnv: 'development' | 'test' | 'production'
  apiPort: number
  webPort: number
  databaseUrl: string
  sessionSecret: string
  devinBin: string
  tmuxBin: string
  allowedRoots: string[]
  cookieSecure: boolean
  cookieSameSite: 'lax' | 'strict' | 'none'
  corsOrigin: string
  trustProxy: number
  adminUsername: string
  adminPassword: string
}

const PLACEHOLDER_VALUES = new Set([
  'change-me-locally',
  'dev-only-not-secret',
  'generate-and-store-locally',
])

const VALID_NODE_ENVS = new Set(['development', 'test', 'production'])
const VALID_SAME_SITE = new Set(['lax', 'strict', 'none'])

const MIN_SESSION_SECRET_LENGTH = 32
const MIN_ADMIN_PASSWORD_LENGTH = 12

class EnvValidationError extends Error {
  constructor(variable: string, message: string) {
    super(`${variable}: ${message}`)
    this.name = 'EnvValidationError'
  }
}

/** Split a delimited roots string into a clean, deduplicated string array. */
export function parseAllowedRoots(value: string): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const raw of value.split(delimiter)) {
    const trimmed = raw.trim()
    if (trimmed.length === 0) continue
    if (seen.has(trimmed)) continue
    seen.add(trimmed)
    result.push(trimmed)
  }
  return result
}

function getString(source: NodeJS.ProcessEnv, name: string): string | undefined {
  const raw = source[name]
  if (raw === undefined) return undefined
  return raw.trim()
}

function requireString(source: NodeJS.ProcessEnv, name: string): string {
  const value = getString(source, name)
  if (value === undefined || value.length === 0) {
    throw new EnvValidationError(name, 'is required but was not set or is empty')
  }
  return value
}

function parsePositiveInt(source: NodeJS.ProcessEnv, name: string, fallback: number): number {
  const raw = source[name]
  if (raw === undefined || raw.trim().length === 0) return fallback
  const parsed = Number(raw)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new EnvValidationError(name, 'must be a positive integer')
  }
  return parsed
}

function parseNonNegativeInt(source: NodeJS.ProcessEnv, name: string, fallback: number): number {
  const raw = source[name]
  if (raw === undefined || raw.trim().length === 0) return fallback
  const parsed = Number(raw)
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new EnvValidationError(name, 'must be a non-negative integer')
  }
  return parsed
}

/**
 * Validate and parse runtime environment variables into an immutable typed
 * object. Throws actionable errors naming the offending variable without
 * echoing secret values.
 */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): RuntimeEnv {
  const databaseUrl = requireString(source, 'DATABASE_URL')
  if (databaseUrl.includes('change-me-locally')) {
    throw new EnvValidationError('DATABASE_URL', 'uses a known placeholder value; set a real connection string')
  }

  const sessionSecret = requireString(source, 'SESSION_SECRET')
  if (PLACEHOLDER_VALUES.has(sessionSecret)) {
    throw new EnvValidationError('SESSION_SECRET', 'uses a known placeholder value; generate a real secret')
  }
  if (sessionSecret.length < MIN_SESSION_SECRET_LENGTH) {
    throw new EnvValidationError('SESSION_SECRET', `must be at least ${MIN_SESSION_SECRET_LENGTH} characters long`)
  }

  const adminUsername = requireString(source, 'ADMIN_USERNAME')

  const adminPassword = requireString(source, 'ADMIN_PASSWORD')
  if (adminPassword.length < MIN_ADMIN_PASSWORD_LENGTH) {
    throw new EnvValidationError('ADMIN_PASSWORD', `must be at least ${MIN_ADMIN_PASSWORD_LENGTH} characters long`)
  }
  if (adminPassword === adminUsername) {
    throw new EnvValidationError('ADMIN_PASSWORD', 'must not equal the admin username')
  }

  const allowedRootsRaw = requireString(source, 'ALLOWED_ROOTS')
  const allowedRoots = parseAllowedRoots(allowedRootsRaw)
  if (allowedRoots.length === 0) {
    throw new EnvValidationError('ALLOWED_ROOTS', 'must contain at least one non-empty path')
  }

  const devinBin = requireString(source, 'DEVIN_BIN')
  const tmuxBin = requireString(source, 'TMUX_BIN')

  const nodeEnvRaw = getString(source, 'NODE_ENV') ?? 'development'
  if (!VALID_NODE_ENVS.has(nodeEnvRaw)) {
    throw new EnvValidationError('NODE_ENV', 'must be one of: development, test, production')
  }

  const apiPort = parsePositiveInt(source, 'API_PORT', PORTS.API)
  const webPort = parsePositiveInt(source, 'WEB_PORT', PORTS.WEB)

  const cookieSecureRaw = getString(source, 'COOKIE_SECURE') ?? 'false'
  if (cookieSecureRaw !== 'true' && cookieSecureRaw !== 'false') {
    throw new EnvValidationError('COOKIE_SECURE', 'must be "true" or "false"')
  }

  const cookieSameSiteRaw = getString(source, 'COOKIE_SAME_SITE') ?? 'lax'
  if (!VALID_SAME_SITE.has(cookieSameSiteRaw)) {
    throw new EnvValidationError('COOKIE_SAME_SITE', 'must be one of: lax, strict, none')
  }

  const corsOrigin = getString(source, 'CORS_ORIGIN') ?? 'http://localhost:8800'
  const trustProxy = parseNonNegativeInt(source, 'TRUST_PROXY', 1)

  return {
    nodeEnv: nodeEnvRaw as RuntimeEnv['nodeEnv'],
    apiPort,
    webPort,
    databaseUrl,
    sessionSecret,
    devinBin,
    tmuxBin,
    allowedRoots,
    cookieSecure: cookieSecureRaw === 'true',
    cookieSameSite: cookieSameSiteRaw as RuntimeEnv['cookieSameSite'],
    corsOrigin,
    trustProxy,
    adminUsername,
    adminPassword,
  }
}
