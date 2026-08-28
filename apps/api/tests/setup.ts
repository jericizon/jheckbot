/**
 * Test-only environment fixtures.
 * These values are set BEFORE any test module imports the API configuration so
 * `loadEnv()` succeeds without a developer `.env`. They are intentionally
 * non-production and must never be copied into runtime defaults.
 */
process.env.NODE_ENV = 'test'
process.env.DATABASE_URL = 'postgresql://test:test@127.0.0.1:5432/test'
process.env.SESSION_SECRET = 'test-session-secret-at-least-32-chars-long'
process.env.ADMIN_USERNAME = 'admin'
process.env.ADMIN_PASSWORD = 'test-admin-password-12'
process.env.ALLOWED_ROOTS = '/tmp/jheckbot-test-roots'
process.env.DEVIN_BIN = 'devin'
process.env.TMUX_BIN = 'tmux'
