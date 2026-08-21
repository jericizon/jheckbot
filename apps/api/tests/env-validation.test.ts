import { describe, it, expect, vi } from 'vitest'
import { delimiter } from 'node:path'
import { loadEnv, parseAllowedRoots, type RuntimeEnv } from '../src/config/env-validation.js'

/** A complete, valid source object that tests clone and mutate. */
function validSource(): NodeJS.ProcessEnv {
  return {
    NODE_ENV: 'test',
    DATABASE_URL: 'postgresql://test:test@127.0.0.1:5432/test',
    SESSION_SECRET: 'test-session-secret-at-least-32-chars-long',
    ADMIN_USERNAME: 'admin',
    ADMIN_PASSWORD: 'test-admin-password-12',
    ALLOWED_ROOTS: '/tmp/jheckbot-test-roots',
    DEVIN_BIN: 'devin',
    TMUX_BIN: 'tmux',
  }
}

describe('loadEnv — missing variables use fallbacks with warnings', () => {
  const requiredKeys = [
    'DATABASE_URL',
    'SESSION_SECRET',
    'ADMIN_USERNAME',
    'ADMIN_PASSWORD',
    'ALLOWED_ROOTS',
    'DEVIN_BIN',
    'TMUX_BIN',
  ] as const

  for (const key of requiredKeys) {
    it(`returns a fallback for ${key} when missing (does not throw)`, () => {
      const source = validSource()
      delete source[key]
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      expect(() => loadEnv(source)).not.toThrow()
      warnSpy.mockRestore()
    })

    it(`returns a fallback for ${key} when empty (does not throw)`, () => {
      const source = validSource()
      source[key] = ''
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      expect(() => loadEnv(source)).not.toThrow()
      warnSpy.mockRestore()
    })
  }
})

describe('loadEnv — placeholder detection warns', () => {
  it('warns about change-me-locally for DATABASE_URL', () => {
    const source = validSource()
    source.DATABASE_URL = 'postgresql://user:change-me-locally@host/db'
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const env = loadEnv(source)
    expect(env.databaseUrl).toContain('change-me-locally')
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('DATABASE_URL'))
    warnSpy.mockRestore()
  })

  it('warns about dev-only-not-secret for SESSION_SECRET', () => {
    const source = validSource()
    source.SESSION_SECRET = 'dev-only-not-secret'
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const env = loadEnv(source)
    expect(env.sessionSecret).toBe('dev-only-not-secret')
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('SESSION_SECRET'))
    warnSpy.mockRestore()
  })
})

describe('loadEnv — secret strength warns', () => {
  it('warns when session secret is shorter than 32 characters', () => {
    const source = validSource()
    source.SESSION_SECRET = 'too-short-secret-only-20-chars'
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const env = loadEnv(source)
    expect(env.sessionSecret).toBe('too-short-secret-only-20-chars')
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('SESSION_SECRET'))
    warnSpy.mockRestore()
  })

  it('does not warn when session secret is exactly 32 characters', () => {
    const source = validSource()
    source.SESSION_SECRET = 'x'.repeat(32)
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    loadEnv(source)
    const sessionWarnings = warnSpy.mock.calls
      .map((c) => String(c[0]))
      .filter((s) => s.includes('SESSION_SECRET'))
    expect(sessionWarnings).toHaveLength(0)
    warnSpy.mockRestore()
  })

  it('generates a random session secret when missing', () => {
    const source = validSource()
    delete source.SESSION_SECRET
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const env = loadEnv(source)
    expect(env.sessionSecret.length).toBeGreaterThanOrEqual(32)
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('SESSION_SECRET'))
    warnSpy.mockRestore()
  })
})

describe('loadEnv — admin password warns', () => {
  it('warns when password is shorter than 12 characters', () => {
    const source = validSource()
    source.ADMIN_PASSWORD = 'short-pass'
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const env = loadEnv(source)
    expect(env.adminPassword).toBe('short-pass')
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('ADMIN_PASSWORD'))
    warnSpy.mockRestore()
  })

  it('warns when password equals username', () => {
    const source = validSource()
    source.ADMIN_USERNAME = 'admin-user-12'
    source.ADMIN_PASSWORD = 'admin-user-12'
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    loadEnv(source)
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('ADMIN_PASSWORD'))
    warnSpy.mockRestore()
  })

  it('does not warn for a 12-char password different from username', () => {
    const source = validSource()
    source.ADMIN_PASSWORD = 'twelve-chars'
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    loadEnv(source)
    const pwWarnings = warnSpy.mock.calls
      .map((c) => String(c[0]))
      .filter((s) => s.includes('ADMIN_PASSWORD'))
    expect(pwWarnings).toHaveLength(0)
    warnSpy.mockRestore()
  })
})

describe('loadEnv — optional defaults and parsing', () => {
  it('defaults NODE_ENV to development when not set', () => {
    const source = validSource()
    delete source.NODE_ENV
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const env = loadEnv(source)
    expect(env.nodeEnv).toBe('development')
    warnSpy.mockRestore()
  })

  it('falls back to development for an invalid NODE_ENV', () => {
    const source = validSource()
    source.NODE_ENV = 'staging'
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const env = loadEnv(source)
    expect(env.nodeEnv).toBe('development')
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('NODE_ENV'))
    warnSpy.mockRestore()
  })

  it('defaults API_PORT to 8801', () => {
    const source = validSource()
    delete source.API_PORT
    const env = loadEnv(source)
    expect(env.apiPort).toBe(8801)
  })

  it('defaults WEB_PORT to 8800', () => {
    const source = validSource()
    delete source.WEB_PORT
    const env = loadEnv(source)
    expect(env.webPort).toBe(8800)
  })

  it('falls back for a non-positive API_PORT', () => {
    const source = validSource()
    source.API_PORT = '0'
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const env = loadEnv(source)
    expect(env.apiPort).toBe(8801)
    warnSpy.mockRestore()
  })

  it('falls back for a non-numeric API_PORT', () => {
    const source = validSource()
    source.API_PORT = 'abc'
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const env = loadEnv(source)
    expect(env.apiPort).toBe(8801)
    warnSpy.mockRestore()
  })

  it('parses COOKIE_SECURE from string true', () => {
    const source = validSource()
    source.COOKIE_SECURE = 'true'
    expect(loadEnv(source).cookieSecure).toBe(true)
  })

  it('defaults COOKIE_SECURE to false', () => {
    const source = validSource()
    delete source.COOKIE_SECURE
    expect(loadEnv(source).cookieSecure).toBe(false)
  })

  it('falls back for an invalid COOKIE_SAME_SITE', () => {
    const source = validSource()
    source.COOKIE_SAME_SITE = 'none-strict'
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const env = loadEnv(source)
    expect(env.cookieSameSite).toBe('lax')
    warnSpy.mockRestore()
  })

  it('defaults CORS_ORIGIN', () => {
    const source = validSource()
    delete source.CORS_ORIGIN
    expect(loadEnv(source).corsOrigin).toBe('http://localhost:8800')
  })

  it('defaults TRUST_PROXY to 1', () => {
    const source = validSource()
    delete source.TRUST_PROXY
    expect(loadEnv(source).trustProxy).toBe(1)
  })

  it('falls back for a negative TRUST_PROXY', () => {
    const source = validSource()
    source.TRUST_PROXY = '-1'
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const env = loadEnv(source)
    expect(env.trustProxy).toBe(1)
    warnSpy.mockRestore()
  })
})

describe('loadEnv — valid configuration', () => {
  it('returns typed values with correct types', () => {
    const source = validSource()
    source.API_PORT = '9000'
    source.WEB_PORT = '9001'
    source.COOKIE_SECURE = 'true'
    source.COOKIE_SAME_SITE = 'strict'
    source.CORS_ORIGIN = 'https://example.com'
    source.TRUST_PROXY = '2'

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const env: RuntimeEnv = loadEnv(source)
    warnSpy.mockRestore()

    expect(env.nodeEnv).toBe('test')
    expect(env.apiPort).toBe(9000)
    expect(typeof env.apiPort).toBe('number')
    expect(env.webPort).toBe(9001)
    expect(typeof env.webPort).toBe('number')
    expect(env.databaseUrl).toBe('postgresql://test:test@127.0.0.1:5432/test')
    expect(env.sessionSecret).toBe('test-session-secret-at-least-32-chars-long')
    expect(env.adminUsername).toBe('admin')
    expect(env.adminPassword).toBe('test-admin-password-12')
    expect(env.devinBin).toBe('devin')
    expect(env.tmuxBin).toBe('tmux')
    expect(Array.isArray(env.allowedRoots)).toBe(true)
    expect(env.allowedRoots).toEqual(['/tmp/jheckbot-test-roots'])
    expect(env.cookieSecure).toBe(true)
    expect(env.cookieSameSite).toBe('strict')
    expect(env.corsOrigin).toBe('https://example.com')
    expect(env.trustProxy).toBe(2)
  })

  it('never includes secret values in warning messages', () => {
    const source = validSource()
    source.SESSION_SECRET = 'super-secret-value-that-should-not-leak-123'
    delete source.DATABASE_URL
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    loadEnv(source)
    const allWarnText = warnSpy.mock.calls.map((c) => String(c)).join(' ')
    expect(allWarnText).not.toContain('super-secret-value')
    warnSpy.mockRestore()
  })
})

describe('parseAllowedRoots', () => {
  it('splits on the platform path delimiter', () => {
    const delim = delimiter
    const result = parseAllowedRoots(`/tmp/a${delim}/tmp/b${delim}/tmp/c`)
    expect(result).toEqual(['/tmp/a', '/tmp/b', '/tmp/c'])
  })

  it('trims whitespace from each entry', () => {
    const delim = delimiter
    const result = parseAllowedRoots(`  /tmp/a  ${delim}\t/tmp/b\t`)
    expect(result).toEqual(['/tmp/a', '/tmp/b'])
  })

  it('removes empty entries', () => {
    const delim = delimiter
    const result = parseAllowedRoots(`${delim}/tmp/a${delim}${delim}${delim}/tmp/b${delim}`)
    expect(result).toEqual(['/tmp/a', '/tmp/b'])
  })

  it('deduplicates entries while preserving order', () => {
    const delim = delimiter
    const result = parseAllowedRoots(`/tmp/a${delim}/tmp/b${delim}/tmp/a${delim}/tmp/c${delim}/tmp/b`)
    expect(result).toEqual(['/tmp/a', '/tmp/b', '/tmp/c'])
  })

  it('returns an empty array for an empty string', () => {
    expect(parseAllowedRoots('')).toEqual([])
  })
})
