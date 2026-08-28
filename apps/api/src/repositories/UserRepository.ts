import { pool } from '../db/pool.js'

export interface UserRecord {
  id: string
  username: string
  password_hash: string
  created_at: string
  updated_at: string
}

export class UserRepository {
  async findByUsername(username: string): Promise<UserRecord | null> {
    const { rows } = await pool.query<UserRecord>(
      'SELECT * FROM users WHERE username = $1',
      [username],
    )
    return rows[0] ?? null
  }

  async findById(id: string): Promise<Omit<UserRecord, 'password_hash'> | null> {
    const { rows } = await pool.query(
      'SELECT id, username, created_at, updated_at FROM users WHERE id = $1',
      [id],
    )
    return rows[0] ?? null
  }

  async create(username: string, passwordHash: string): Promise<UserRecord> {
    const { rows } = await pool.query<UserRecord>(
      `INSERT INTO users (username, password_hash)
       VALUES ($1, $2)
       RETURNING *`,
      [username, passwordHash],
    )
    return rows[0]
  }

  async count(): Promise<number> {
    const { rows } = await pool.query<{ count: string }>('SELECT COUNT(*) as count FROM users')
    return Number(rows[0].count)
  }
}
