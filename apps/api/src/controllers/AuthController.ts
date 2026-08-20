import type { Request, Response } from 'express'
import { AuthService, AuthError } from '../services/AuthService.js'

export class AuthController {
  constructor(
    private authService: AuthService,
    private authMiddleware: {
      setSessionCookie: (res: Response, token: string) => void
      clearSessionCookie: (res: Response) => void
    },
  ) {}

  async login(req: Request, res: Response): Promise<void> {
    try {
      const session = await this.authService.login(req.body.username, req.body.password)
      const token = this.authService.generateSessionToken(session)
      this.authMiddleware.setSessionCookie(res, token)
      res.json({ userId: session.userId, username: session.username })
    } catch (err) {
      if (err instanceof AuthError) {
        res.status(err.statusCode).json({ error: err.message })
        return
      }
      throw err
    }
  }

  async logout(_req: Request, res: Response): Promise<void> {
    this.authMiddleware.clearSessionCookie(res)
    res.json({ ok: true })
  }

  async me(req: Request, res: Response): Promise<void> {
    if (!req.session) {
      res.status(401).json({ error: 'Not authenticated' })
      return
    }
    const user = await this.authService.getUserById(req.session.userId)
    if (!user) {
      res.status(401).json({ error: 'User not found' })
      return
    }
    res.json(user)
  }
}
