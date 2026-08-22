import { delimiter, resolve } from 'node:path'
import { randomBytes } from 'node:crypto'
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
  vapidPublicKey?: string
  vapidPrivateKey?: string
  vapidSubject?: string
  screenshotsDir: string
}

const PLACEHOLDER_VALUES = new Set([
  'change-me-locally',
  'dev-only-not-secret',
  'generate-and-store-locally',
])

const VALID_NODE_ENVS = new Set(['development', 'test', 'production'])
const VALID_SAME_SITE = new Set(['lax', 'strict', 'none'])

const MIN_SESSION_SECRET_LENGTH = 32

const warnings: string[] = []

function warn(variable: string, message: string): void {
  warnings.push(`[config] ${variable}: ${message}`)
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

function optString(
  source: NodeJS.ProcessEnv,
  name: string,
  fallback: string,
): string {
  const value = getString(source, name)
  if (value === undefined || value.length === 0) {
    warn(name, `not set or empty — using default "${fallback}"`)
    return fallback
  }
  return value
}

function parsePositiveInt(source: NodeJS.ProcessEnv, name: string, fallback: number): number {
  const raw = source[name]
  if (raw === undefined || raw.trim().length === 0) return fallback
  const parsed = Number(raw)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    warn(name, `"${raw}" is not a positive integer — using default ${fallback}`)
    return fallback
  }
  return parsed
}

function parseNonNegativeInt(source: NodeJS.ProcessEnv, name: string, fallback: number): number {
  const raw = source[name]
  if (raw === undefined || raw.trim().length === 0) return fallback
  const parsed = Number(raw)
  if (!Number.isInteger(parsed) || parsed < 0) {
    warn(name, `"${raw}" is not a non-negative integer — using default ${fallback}`)
    return fallback
  }
  return parsed
}

/** Flush accumulated warnings to console.warn. Called once after loadEnv finishes. */
function flushWarnings(): void {
  if (warnings.length > 0) {
    console.warn('Configuration warnings:')
    for (const w of warnings) console.warn(`  ${w}`)
    warnings.length = 0
  }
}

/**
 * Load and parse runtime environment variables into an immutable typed object.
 * Missing or weak values produce warnings instead of throwing — the app
 * starts with sensible fallbacks so local development stays frictionless.
 */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): RuntimeEnv {
  // DATABASE_URL — no fallback; the pool will fail naturally if invalid.
  const databaseUrl = optString(source, 'DATABASE_URL', 'postgresql://jheckbot:jheckbot@127.0.0.1:8802/jheckbot')
  if (databaseUrl.includes('change-me-locally')) {
    warn('DATABASE_URL', 'uses a known placeholder value — set a real connection string')
  }

  // SESSION_SECRET — generate a random one if missing or too short.
  let sessionSecret = getString(source, 'SESSION_SECRET') ?? ''
  if (sessionSecret.length === 0) {
    sessionSecret = randomBytes(32).toString('hex')
    warn('SESSION_SECRET', `not set — generated a random secret for this process`)
  } else if (PLACEHOLDER_VALUES.has(sessionSecret)) {
    warn('SESSION_SECRET', 'uses a known placeholder value — generate a real secret with: openssl rand -hex 32')
  } else if (sessionSecret.length < MIN_SESSION_SECRET_LENGTH) {
    warn('SESSION_SECRET', `is only ${sessionSecret.length} characters — recommended minimum is ${MIN_SESSION_SECRET_LENGTH}`)
  }

  const adminUsername = optString(source, 'ADMIN_USERNAME', 'admin')

  const adminPassword = optString(source, 'ADMIN_PASSWORD', 'admin')
  if (adminPassword === adminUsername) {
    warn('ADMIN_PASSWORD', 'should not equal the admin username')
  }

  // ALLOWED_ROOTS — default to empty; project creation will fail with a clear error.
  const allowedRootsRaw = getString(source, 'ALLOWED_ROOTS') ?? ''
  const allowedRoots = parseAllowedRoots(allowedRootsRaw)
  if (allowedRoots.length === 0) {
    warn('ALLOWED_ROOTS', 'not set or empty — project creation will fail until at least one root is configured')
  }

  const devinBin = optString(source, 'DEVIN_BIN', 'devin')
  const tmuxBin = optString(source, 'TMUX_BIN', 'tmux')

  const nodeEnvRaw = getString(source, 'NODE_ENV') ?? 'development'
  if (!VALID_NODE_ENVS.has(nodeEnvRaw)) {
    warn('NODE_ENV', `"${nodeEnvRaw}" is not one of: development, test, production — using "development"`)
  }
  const nodeEnv = (VALID_NODE_ENVS.has(nodeEnvRaw) ? nodeEnvRaw : 'development') as RuntimeEnv['nodeEnv']

  const apiPort = parsePositiveInt(source, 'API_PORT', PORTS.API)
  const webPort = parsePositiveInt(source, 'WEB_PORT', PORTS.WEB)

  const cookieSecureRaw = getString(source, 'COOKIE_SECURE') ?? 'false'
  if (cookieSecureRaw !== 'true' && cookieSecureRaw !== 'false') {
    warn('COOKIE_SECURE', `"${cookieSecureRaw}" is not "true" or "false" — using "false"`)
  }
  const cookieSecure = cookieSecureRaw === 'true'

  const cookieSameSiteRaw = getString(source, 'COOKIE_SAME_SITE') ?? 'lax'
  if (!VALID_SAME_SITE.has(cookieSameSiteRaw)) {
    warn('COOKIE_SAME_SITE', `"${cookieSameSiteRaw}" is not one of: lax, strict, none — using "lax"`)
  }
  const cookieSameSite = (VALID_SAME_SITE.has(cookieSameSiteRaw) ? cookieSameSiteRaw : 'lax') as RuntimeEnv['cookieSameSite']

  const corsOrigin = getString(source, 'CORS_ORIGIN') ?? 'http://localhost:8800'
  const trustProxy = parseNonNegativeInt(source, 'TRUST_PROXY', 1)

  // VAPID keys for Web Push — optional. Push notifications are disabled
  // when not set. Generate with: npx web-push generate-vapid-keys
  const vapidPublicKey = getString(source, 'VAPID_PUBLIC_KEY')
  const vapidPrivateKey = getString(source, 'VAPID_PRIVATE_KEY')
  const vapidSubject = getString(source, 'VAPID_SUBJECT') ?? `mailto:admin@localhost`
  if ((vapidPublicKey && !vapidPrivateKey) || (!vapidPublicKey && vapidPrivateKey)) {
    warn('VAPID_KEYS', 'only one of VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY is set — both are required for push notifications')
  }
  if (!vapidPublicKey && !vapidPrivateKey) {
    warn('VAPID_KEYS', 'not set — push notifications disabled. Generate with: npx web-push generate-vapid-keys')
  }

  // SCREENSHOTS_DIR — where agent screenshots are stored, served back to the chat.
  // Defaults to <repo-root>/data/screenshots so previews work without configuration.
  const screenshotsDir = resolve(
    optString(source, 'SCREENSHOTS_DIR', resolve(process.cwd(), 'data/screenshots')),
  )

  flushWarnings()

  return {
    nodeEnv,
    apiPort,
    webPort,
    databaseUrl,
    sessionSecret,
    devinBin,
    tmuxBin,
    allowedRoots,
    cookieSecure,
    cookieSameSite,
    corsOrigin,
    trustProxy,
    adminUsername,
    adminPassword,
    vapidPublicKey: vapidPublicKey && vapidPrivateKey ? vapidPublicKey : undefined,
    vapidPrivateKey: vapidPublicKey && vapidPrivateKey ? vapidPrivateKey : undefined,
    vapidSubject,
    screenshotsDir,
  }
}
