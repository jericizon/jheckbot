// Placeholder validators — full path security validation is implemented in Phase 2.

export * from './office.js'

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

export function isValidPort(port: unknown): port is number {
  return typeof port === 'number' && port > 0 && port < 65536
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isValidUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value)
}

// Git refname rules (git check-ref-format): no spaces or ~^:?*[\\ control chars,
// no leading . or -, no trailing . or /, no consecutive dots, no @{, no .lock suffix.
const GIT_BRANCH_RE = /^(?!\.)(?!-)(?!.*\.\.)(?!.*@{)(?!.*\.lock$)(?!.*\/$)[A-Za-z0-9][A-Za-z0-9/._-]*[^./\\]$/

export function isValidGitBranchName(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const name = value.trim()
  if (name.length === 0 || name.length > 200) return false
  // Reject any character git forbids in refnames.
  if (/[~^:?*\[\]\\]/.test(name)) return false
  if (/\s/.test(name)) return false
  if (name.includes('..')) return false
  if (name.startsWith('.') || name.startsWith('-')) return false
  if (name.endsWith('.') || name.endsWith('/')) return false
  if (name.endsWith('.lock')) return false
  if (name.includes('@{')) return false
  return GIT_BRANCH_RE.test(name)
}
