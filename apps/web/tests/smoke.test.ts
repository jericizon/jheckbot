import { describe, it, expect } from 'vitest'
import { PORTS } from '@jheckbot/shared'

describe('@jheckbot/web', () => {
  it('uses the reserved web port', () => {
    expect(PORTS.WEB).toBe(8800)
  })

  it('uses the reserved API port for the API base', () => {
    expect(PORTS.API).toBe(8801)
  })
})
