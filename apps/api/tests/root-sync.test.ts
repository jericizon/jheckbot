import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ProjectRepository } from '../src/repositories/ProjectRepository.js'
import { pool } from '../src/db/pool.js'
import type { PoolClient } from 'pg'

function fakeClient() {
  return {
    query: vi.fn().mockResolvedValue({ rows: [] }),
    release: vi.fn(),
  } as unknown as PoolClient
}

describe('ProjectRepository.syncAllowedRoots', () => {
  let client: PoolClient

  beforeEach(() => {
    client = fakeClient()
    vi.spyOn(pool, 'connect').mockResolvedValue(client)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('enables configured roots with parameterized INSERT ... ON CONFLICT', async () => {
    const repo = new ProjectRepository()
    await repo.syncAllowedRoots(['/tmp/jheckbot-test-roots', '/tmp/jheckbot-test-other'])

    const calls = vi.mocked(client.query).mock.calls
    const insertCalls = calls.filter(
      ([sql]) => typeof sql === 'string' && sql.includes('INSERT INTO allowed_roots'),
    )
    expect(insertCalls).toHaveLength(2)
    for (const [, params] of insertCalls) {
      expect(params).toEqual([expect.any(String), expect.any(String)])
    }
    expect(insertCalls[0][1]).toEqual(['jheckbot-test-roots', '/tmp/jheckbot-test-roots'])
    expect(insertCalls[1][1]).toEqual(['jheckbot-test-other', '/tmp/jheckbot-test-other'])
  })

  it('disables unconfigured roots with parameterized UPDATE ... WHERE path <> ALL($1)', async () => {
    const repo = new ProjectRepository()
    await repo.syncAllowedRoots(['/tmp/jheckbot-test-roots'])

    const calls = vi.mocked(client.query).mock.calls
    const disableCall = calls.find(
      ([sql]) => typeof sql === 'string' && sql.includes('UPDATE allowed_roots') && sql.includes('enabled = FALSE'),
    )
    expect(disableCall).toBeDefined()
    expect(disableCall![0]).toContain('path <> ALL($1::text[])')
    expect(disableCall![1]).toEqual([['/tmp/jheckbot-test-roots']])
  })

  it('does NOT issue any DELETE statements', async () => {
    const repo = new ProjectRepository()
    await repo.syncAllowedRoots(['/tmp/jheckbot-test-roots'])

    const calls = vi.mocked(client.query).mock.calls
    const deleteCalls = calls.filter(
      ([sql]) => typeof sql === 'string' && sql.toUpperCase().includes('DELETE'),
    )
    expect(deleteCalls).toHaveLength(0)
  })

  it('deduplicates paths before persistence', async () => {
    const repo = new ProjectRepository()
    await repo.syncAllowedRoots(['/tmp/jheckbot-test-roots', '/tmp/jheckbot-test-roots'])

    const calls = vi.mocked(client.query).mock.calls
    const insertCalls = calls.filter(
      ([sql]) => typeof sql === 'string' && sql.includes('INSERT INTO allowed_roots'),
    )
    expect(insertCalls).toHaveLength(1)
  })

  it('wraps all writes in a transaction (BEGIN/COMMIT)', async () => {
    const repo = new ProjectRepository()
    await repo.syncAllowedRoots(['/tmp/jheckbot-test-roots'])

    const sqls = vi.mocked(client.query).mock.calls.map(([sql]) => sql)
    expect(sqls).toContain('BEGIN')
    expect(sqls).toContain('COMMIT')
  })

  it('rolls back the transaction on error', async () => {
    vi.mocked(client.query).mockImplementation(async (sql: string) => {
      if (sql.includes('INSERT INTO allowed_roots')) {
        throw new Error('db error')
      }
      return { rows: [] }
    })

    const repo = new ProjectRepository()
    await expect(repo.syncAllowedRoots(['/tmp/jheckbot-test-roots'])).rejects.toThrow('db error')

    const sqls = vi.mocked(client.query).mock.calls.map(([sql]) => sql)
    expect(sqls).toContain('BEGIN')
    expect(sqls).toContain('ROLLBACK')
  })
})
