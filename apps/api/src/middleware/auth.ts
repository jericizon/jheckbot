import type { Request, Response, NextFunction } from 'express'
import { AuthService, type AuthSession } from '../services/AuthService.js'

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      session?: AuthSession
    }
  }
}

const SESSION_COOKIE = 'jheckbot_session'
const MAX_AGE = 7 * 24 * 60 * 60 * 1000 // 7 days

export function createAuthMiddleware(authService: AuthService) {
  function requireAuth(req: Request, res: Response, next: NextFunction): void {
    const token = req.cookies?.[SESSION_COOKIE]
    if (!token) {
      res.status(401).json({ error: 'Authentication required' })
      return
    }
    const session = authService.verifySessionToken(token)
    if (!session) {
      res.clearCookie(SESSION_COOKIE)
      res.status(401).json({ error: 'Invalid or expired session' })
      return
    }
    req.session = session
    next()
  }

  function setSessionCookie(res: Response, token: string): void {
    res.cookie(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: env.cookieSecure,
      sameSite: env.cookieSameSite,
      maxAge: MAX_AGE,
      path: '/',
    })
  }

  function clearSessionCookie(res: Response): void {
    res.clearCookie(SESSION_COOKIE, { path: '/' })
  }

  return { requireAuth, setSessionCookie, clearSessionCookie, SESSION_COOKIE }
}

// Import here to avoid circular deps
import { env } from '../config/env.js'
