import { Pool, type PoolClient } from 'pg'
import { env } from '../config/env.js'

export const pool = new Pool({
  connectionString: env.databaseUrl,
})

export type DbExecutor = Pick<Pool, 'query'>

pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client', err)
})

export async function query<T extends Record<string, unknown> = Record<string, unknown>>(
  text: string,
  params?: unknown[],
): Promise<T[]> {
  const result = await pool.query<T>(text, params)
  return result.rows
}

export async function withTransaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await work(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    try {
      await client.query('ROLLBACK')
    } catch {
      // Preserve the original transaction error if rollback also fails.
    }
    throw error
  } finally {
    client.release()
  }
}

export async function closePool(): Promise<void> {
  await pool.end()
}
