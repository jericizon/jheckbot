// Placeholder validators — full path security validation is implemented in Phase 2.

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

export function isValidPort(port: unknown): port is number {
  return typeof port === 'number' && port > 0 && port < 65536
}
