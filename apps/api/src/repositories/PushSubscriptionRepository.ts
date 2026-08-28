import { pool, type DbExecutor } from '../db/pool.js'

export interface PushSubscriptionRecord {
  id: string
  user_id: string
  endpoint: string
  expiration_time: number | null
  p256dh_key: string
  auth_key: string
  created_at: string
}

export class PushSubscriptionRepository {
  async findAll(executor: DbExecutor = pool): Promise<PushSubscriptionRecord[]> {
    const { rows } = await executor.query<PushSubscriptionRecord>(
      'SELECT * FROM push_subscriptions ORDER BY created_at DESC',
    )
    return rows
  }

  async findByUserId(userId: string, executor: DbExecutor = pool): Promise<PushSubscriptionRecord[]> {
    const { rows } = await executor.query<PushSubscriptionRecord>(
      'SELECT * FROM push_subscriptions WHERE user_id = $1 ORDER BY created_at DESC',
      [userId],
    )
    return rows
  }

  async upsert(data: {
    id: string
    userId: string
    endpoint: string
    expirationTime?: number | null
    p256dhKey: string
    authKey: string
  }): Promise<PushSubscriptionRecord> {
    const { rows } = await pool.query<PushSubscriptionRecord>(
      `INSERT INTO push_subscriptions (id, user_id, endpoint, expiration_time, p256dh_key, auth_key)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (endpoint) DO UPDATE SET
         expiration_time = EXCLUDED.expiration_time,
         p256dh_key = EXCLUDED.p256dh_key,
         auth_key = EXCLUDED.auth_key
       RETURNING *`,
      [data.id, data.userId, data.endpoint, data.expirationTime ?? null, data.p256dhKey, data.authKey],
    )
    return rows[0]
  }

  async deleteByEndpoint(endpoint: string): Promise<void> {
    await pool.query('DELETE FROM push_subscriptions WHERE endpoint = $1', [endpoint])
  }

  async deleteByUserId(userId: string): Promise<void> {
    await pool.query('DELETE FROM push_subscriptions WHERE user_id = $1', [userId])
  }

  // Remove subscriptions whose endpoint has expired or is no longer valid.
  async deleteExpired(): Promise<void> {
    await pool.query(
      'DELETE FROM push_subscriptions WHERE expiration_time IS NOT NULL AND expiration_time < $1',
      [Date.now()],
    )
  }
}
