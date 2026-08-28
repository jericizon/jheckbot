import { beforeEach, describe, expect, it, vi } from 'vitest'
import { pool, withTransaction } from '../src/db/pool.js'

function fakeClient() {
  return {
    query: vi.fn().mockResolvedValue({ rows: [] }),
    release: vi.fn(),
  }
}

describe('withTransaction', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('commits a successful transaction and releases the client', async () => {
    const client = fakeClient()
    vi.spyOn(pool, 'connect').mockResolvedValue(client as never)

    await withTransaction(async (transaction) => {
      await transaction.query('SELECT 1')
    })

    expect(client.query).toHaveBeenNthCalledWith(1, 'BEGIN')
    expect(client.query).toHaveBeenLastCalledWith('COMMIT')
    expect(client.release).toHaveBeenCalledOnce()
  })

  it('rolls back and rethrows the original error', async () => {
    const client = fakeClient()
    vi.spyOn(pool, 'connect').mockResolvedValue(client as never)
    const error = new Error('database unavailable')

    await expect(
      withTransaction(async () => {
        throw error
      }),
    ).rejects.toBe(error)
    expect(client.query).toHaveBeenCalledWith('ROLLBACK')
    expect(client.release).toHaveBeenCalledOnce()
  })
})
