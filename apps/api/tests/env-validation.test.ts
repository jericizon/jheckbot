import { describe, it, expect } from 'vitest'
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

describe('loadEnv — required variables', () => {
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
    it(`throws naming ${key} when missing`, () => {
      const source = validSource()
      delete source[key]
      expect(() => loadEnv(source)).toThrow(key)
    })

    it(`throws naming ${key} when empty`, () => {
      const source = validSource()
      source[key] = ''
      expect(() => loadEnv(source)).toThrow(key)
    })

    it(`throws naming ${key} when whitespace-only`, () => {
      const source = validSource()
      source[key] = '   '
      expect(() => loadEnv(source)).toThrow(key)
    })
  }
})

describe('loadEnv — placeholder rejection', () => {
  it('rejects change-me-locally for DATABASE_URL', () => {
    const source = validSource()
    source.DATABASE_URL = 'postgresql://user:change-me-locally@host/db'
    expect(() => loadEnv(source)).toThrow('DATABASE_URL')
  })

  it('rejects dev-only-not-secret for SESSION_SECRET', () => {
    const source = validSource()
    source.SESSION_SECRET = 'dev-only-not-secret'
    expect(() => loadEnv(source)).toThrow('SESSION_SECRET')
  })

  it('rejects generate-and-store-locally for SESSION_SECRET', () => {
    const source = validSource()
    source.SESSION_SECRET = 'generate-and-store-locally'
    expect(() => loadEnv(source)).toThrow('SESSION_SECRET')
  })
})

describe('loadEnv — secret strength', () => {
  it('rejects a session secret shorter than 32 characters', () => {
    const source = validSource()
    source.SESSION_SECRET = 'too-short-secret-only-20-chars'
    expect(() => loadEnv(source)).toThrow('SESSION_SECRET')
  })

  it('accepts a session secret of exactly 32 characters', () => {
    const source = validSource()
    source.SESSION_SECRET = 'x'.repeat(32)
    expect(() => loadEnv(source)).not.toThrow()
  })
})

describe('loadEnv — admin password', () => {
  it('rejects a password shorter than 12 characters', () => {
    const source = validSource()
    source.ADMIN_PASSWORD = 'short-pass'
    expect(() => loadEnv(source)).toThrow('ADMIN_PASSWORD')
  })

  it('rejects a password equal to the username', () => {
    const source = validSource()
    source.ADMIN_USERNAME = 'admin-user-12'
    source.ADMIN_PASSWORD = 'admin-user-12'
    expect(() => loadEnv(source)).toThrow('ADMIN_PASSWORD')
  })

  it('accepts a 12-character password different from the username', () => {
    const source = validSource()
    source.ADMIN_PASSWORD = 'twelve-chars'
    expect(() => loadEnv(source)).not.toThrow()
  })
})

describe('loadEnv — optional defaults and parsing', () => {
  it('defaults NODE_ENV to development when not set', () => {
    const source = validSource()
    delete source.NODE_ENV
    const env = loadEnv(source)
    expect(env.nodeEnv).toBe('development')
  })

  it('rejects an invalid NODE_ENV', () => {
    const source = validSource()
    source.NODE_ENV = 'staging'
    expect(() => loadEnv(source)).toThrow('NODE_ENV')
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

  it('rejects a non-positive API_PORT', () => {
    const source = validSource()
    source.API_PORT = '0'
    expect(() => loadEnv(source)).toThrow('API_PORT')
  })

  it('rejects a non-numeric API_PORT', () => {
    const source = validSource()
    source.API_PORT = 'abc'
    expect(() => loadEnv(source)).toThrow('API_PORT')
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

  it('rejects an invalid COOKIE_SAME_SITE', () => {
    const source = validSource()
    source.COOKIE_SAME_SITE = 'none-strict'
    expect(() => loadEnv(source)).toThrow('COOKIE_SAME_SITE')
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

  it('rejects a negative TRUST_PROXY', () => {
    const source = validSource()
    source.TRUST_PROXY = '-1'
    expect(() => loadEnv(source)).toThrow('TRUST_PROXY')
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

    const env: RuntimeEnv = loadEnv(source)

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

  it('never includes secret values in error messages', () => {
    const source = validSource()
    source.SESSION_SECRET = 'super-secret-value-that-should-not-leak-123'
    delete source.DATABASE_URL
    expect(() => loadEnv(source)).toThrow('DATABASE_URL')
    try {
      loadEnv(source)
    } catch (err) {
      expect(String(err)).not.toContain('super-secret-value')
    }
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
