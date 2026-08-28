import bcrypt from 'bcrypt'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { UserRepository } from '../repositories/UserRepository.js'
import { env } from '../config/env.js'

export interface AuthSession {
  userId: string
  username: string
}

export class AuthService {
  constructor(private userRepo: UserRepository) {}

  async login(username: string, password: string): Promise<AuthSession> {
    if (!username?.trim() || !password) {
      throw new AuthError('Username and password are required', 400)
    }

    const user = await this.userRepo.findByUsername(username.trim())
    if (!user) {
      throw new AuthError('Invalid credentials', 401)
    }

    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid) {
      throw new AuthError('Invalid credentials', 401)
    }

    return { userId: user.id, username: user.username }
  }

  async getUserById(userId: string): Promise<{ id: string; username: string } | null> {
    const user = await this.userRepo.findById(userId)
    if (!user) return null
    return { id: user.id, username: user.username }
  }

  /** Seed a default admin user if no users exist. */
  async ensureSeedUser(): Promise<void> {
    const count = await this.userRepo.count()
    if (count > 0) return
    const hash = await bcrypt.hash(env.adminPassword, 10)
    await this.userRepo.create(env.adminUsername, hash)
    console.log(`Seed user created: ${env.adminUsername} (change password after first login)`)
  }

  generateSessionToken(session: AuthSession): string {
    const payload = Buffer.from(JSON.stringify(session)).toString('base64url')
    const sig = createHmac('sha256', env.sessionSecret).update(payload).digest('base64url')
    return `${payload}.${sig}`
  }

  verifySessionToken(token: string): AuthSession | null {
    try {
      const [payload, sig] = token.split('.')
      if (!payload || !sig) return null
      const expectedSig = createHmac('sha256', env.sessionSecret).update(payload).digest('base64url')
      const a = Buffer.from(sig)
      const b = Buffer.from(expectedSig)
      if (a.length !== b.length || !timingSafeEqual(a, b)) return null
      return JSON.parse(Buffer.from(payload, 'base64url').toString()) as AuthSession
    } catch {
      return null
    }
  }
}

export class AuthError extends Error {
  statusCode: number
  constructor(message: string, statusCode = 400) {
    super(message)
    this.name = 'AuthError'
    this.statusCode = statusCode
  }
}
