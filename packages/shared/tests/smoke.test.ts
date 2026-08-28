import { describe, it, expect } from 'vitest'
import { PORTS, AGENT_LIMITS, isValidUuid } from '../src/index.js'

describe('@jheckbot/shared', () => {
  it('exports reserved port constants', () => {
    expect(PORTS.WEB).toBe(8800)
    expect(PORTS.API).toBe(8801)
    expect(PORTS.POSTGRES_HOST).toBe(8802)
    expect(PORTS.POSTGRES_CONTAINER).toBe(5432)
  })

  it('exports agent limits', () => {
    expect(AGENT_LIMITS.MAX_CONCURRENT_SESSIONS).toBe(3)
    expect(AGENT_LIMITS.MAX_RUNTIME_MS).toBe(3600000)
  })
})

describe('isValidUuid', () => {
  it('accepts a valid UUID v4', () => {
    expect(isValidUuid('996c3a36-9ded-44c8-a47e-d87d8f6d006a')).toBe(true)
  })

  it('accepts uppercase UUIDs', () => {
    expect(isValidUuid('996C3A36-9DED-44C8-A47E-D87D8F6D006A')).toBe(true)
  })

  // Real-user defect: a user typed "nonexistent-id" as the project ID in the URL,
  // PostgreSQL threw "invalid input syntax for type uuid", and the API returned 500.
  // The tests missed this because they mocked the DB pool and never sent a raw
  // non-UUID string to a real UUID column.
  it('rejects a non-UUID string (real-user defect: caused 500 instead of 400)', () => {
    expect(isValidUuid('nonexistent-id')).toBe(false)
  })

  it('rejects empty string', () => {
    expect(isValidUuid('')).toBe(false)
  })

  it('rejects a truncated UUID', () => {
    expect(isValidUuid('996c3a36-9ded-44c8-a47e')).toBe(false)
  })

  it('rejects non-string types', () => {
    expect(isValidUuid(null)).toBe(false)
    expect(isValidUuid(undefined)).toBe(false)
    expect(isValidUuid(123)).toBe(false)
  })
})
