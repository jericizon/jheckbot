import { describe, it, expect } from 'vitest'
import { PORTS, DEFAULT_ALLOWED_ROOT, AGENT_LIMITS } from '../src/index.js'

describe('@jheckbot/shared', () => {
  it('exports reserved port constants', () => {
    expect(PORTS.WEB).toBe(8800)
    expect(PORTS.API).toBe(8801)
    expect(PORTS.POSTGRES_HOST).toBe(8802)
    expect(PORTS.POSTGRES_CONTAINER).toBe(5432)
  })

  it('exports the default allowed root', () => {
    expect(DEFAULT_ALLOWED_ROOT).toBe('/home/jeric/Workspace')
  })

  it('exports agent limits', () => {
    expect(AGENT_LIMITS.MAX_CONCURRENT_SESSIONS).toBe(3)
    expect(AGENT_LIMITS.MAX_RUNTIME_MS).toBe(3600000)
  })
})
