import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AuthService, AuthError } from '../src/services/AuthService.js'
import { UserRepository, type UserRecord } from '../src/repositories/UserRepository.js'
import bcrypt from 'bcrypt'

vi.mock('../db/pool.js', () => ({
  pool: { query: vi.fn(), on: vi.fn(), end: vi.fn() },
}))

describe('AuthService', () => {
  let userRepo: UserRepository
  let service: AuthService
  let mockUser: UserRecord

  beforeEach(() => {
    vi.clearAllMocks()
    const hash = bcrypt.hashSync('admin', 10)
    mockUser = {
      id: 'user-1',
      username: 'admin',
      password_hash: hash,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    userRepo = {
      findByUsername: vi.fn().mockResolvedValue(mockUser),
      findById: vi.fn().mockResolvedValue({ id: 'user-1', username: 'admin' }),
      create: vi.fn().mockResolvedValue(mockUser),
      count: vi.fn().mockResolvedValue(1),
    } as unknown as UserRepository

    service = new AuthService(userRepo)
  })

  it('logs in with valid credentials', async () => {
    const session = await service.login('admin', 'admin')
    expect(session.userId).toBe('user-1')
    expect(session.username).toBe('admin')
  })

  it('rejects login with wrong password', async () => {
    await expect(service.login('admin', 'wrong')).rejects.toMatchObject({
      statusCode: 401,
    })
  })

  it('rejects login with non-existent user', async () => {
    vi.mocked(userRepo.findByUsername).mockResolvedValueOnce(null)
    await expect(service.login('nonexistent', 'pass')).rejects.toMatchObject({
      statusCode: 401,
    })
  })

  it('rejects login with empty username', async () => {
    await expect(service.login('', 'pass')).rejects.toThrow(AuthError)
  })

  it('rejects login with empty password', async () => {
    await expect(service.login('admin', '')).rejects.toThrow(AuthError)
  })

  it('generates and verifies a session token', async () => {
    const session = { userId: 'user-1', username: 'admin' }
    const token = service.generateSessionToken(session)
    expect(token).toBeTruthy()
    const verified = service.verifySessionToken(token)
    expect(verified).toEqual(session)
  })

  it('rejects a tampered session token', () => {
    const token = service.generateSessionToken({ userId: 'user-1', username: 'admin' })
    const tampered = token.slice(0, -4) + 'XXXX'
    expect(service.verifySessionToken(tampered)).toBeNull()
  })

  it('seeds a default admin user when none exist', async () => {
    vi.mocked(userRepo.count).mockResolvedValueOnce(0)
    await service.ensureSeedUser()
    expect(userRepo.create).toHaveBeenCalledWith('admin', expect.any(String))
  })

  it('seeds with custom credentials from env', async () => {
    vi.mocked(userRepo.count).mockResolvedValueOnce(0)
    process.env.ADMIN_USERNAME = 'jeric'
    process.env.ADMIN_PASSWORD = 'password'
    // Re-import env to pick up new values
    vi.resetModules()
    const { AuthService: FreshAuthService } = await import('../src/services/AuthService.js')
    const freshService = new FreshAuthService(userRepo)
    await freshService.ensureSeedUser()
    expect(userRepo.create).toHaveBeenCalledWith('jeric', expect.any(String))
    delete process.env.ADMIN_USERNAME
    delete process.env.ADMIN_PASSWORD
  })

  it('does not seed when users already exist', async () => {
    vi.mocked(userRepo.count).mockResolvedValueOnce(1)
    await service.ensureSeedUser()
    expect(userRepo.create).not.toHaveBeenCalled()
  })
})
