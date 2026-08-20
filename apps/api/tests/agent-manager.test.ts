import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AgentManager, AgentManagerError } from '../src/agent/AgentManager.js'
import { DevinAdapter } from '../src/agent/DevinAdapter.js'
import { TmuxManager } from '../src/agent/TmuxManager.js'
import { ProjectRepository, type ProjectRecord } from '../src/repositories/ProjectRepository.js'
import { PathValidator, type AllowedRoot } from '../src/services/PathValidator.js'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'

vi.mock('../db/pool.js', () => ({
  pool: {
    query: vi.fn(),
    on: vi.fn(),
    end: vi.fn(),
  },
}))

const TMP = join(tmpdir(), 'jheckbot-agent-test')

describe('AgentManager', () => {
  let tmux: TmuxManager
  let devin: DevinAdapter
  let repo: ProjectRepository
  let manager: AgentManager
  let mockProject: ProjectRecord

  beforeEach(() => {
    mkdirSync(join(TMP, 'test-project'), { recursive: true })
    writeFileSync(join(TMP, 'test-project', 'package.json'), '{}')

    mockProject = {
      id: 'proj-1',
      name: 'Test Project',
      slug: 'test-project',
      path: join(TMP, 'test-project'),
      description: null,
      enabled: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    repo = {
      findById: vi.fn().mockResolvedValue(mockProject),
      findAllowedRoots: vi.fn().mockResolvedValue<AllowedRoot[]>([
        { id: 'root-1', name: 'TestRoot', path: TMP, enabled: true },
      ]),
    } as unknown as ProjectRepository

    tmux = new TmuxManager('/usr/bin/tmux')
    devin = new DevinAdapter('/home/jeric/.local/bin/devin', tmux)

    vi.spyOn(devin, 'isAvailable').mockReturnValue(true)
    vi.spyOn(tmux, 'isAvailable').mockReturnValue(true)
    vi.spyOn(devin, 'start').mockReturnValue({
      sessionName: 'jheckbot-test-project-conv-1',
      status: 'starting',
      startedAt: new Date().toISOString(),
    })

    const factory = (roots: AllowedRoot[]) => new PathValidator(roots)
    manager = new AgentManager(devin, tmux, repo, factory)
  })

  afterEach(() => {
    rmSync(TMP, { recursive: true, force: true })
  })

  it('starts an agent run for a valid project', async () => {
    const run = await manager.start({
      conversationId: 'conv-1',
      projectId: 'proj-1',
      prompt: 'Fix the tests',
    })
    expect(run.status).toBe('running')
    expect(run.sessionName).toBe('jheckbot-test-project-conv-1')
    expect(manager.isConversationActive('conv-1')).toBe(true)
  })

  it('rejects a second prompt for the same conversation (409)', async () => {
    await manager.start({ conversationId: 'conv-1', projectId: 'proj-1', prompt: 'first' })
    await expect(
      manager.start({ conversationId: 'conv-1', projectId: 'proj-1', prompt: 'second' }),
    ).rejects.toMatchObject({ statusCode: 409 })
  })

  it('rejects when project is not found (404)', async () => {
    vi.mocked(repo.findById).mockResolvedValueOnce(null)
    await expect(
      manager.start({ conversationId: 'conv-2', projectId: 'nonexistent', prompt: 'test' }),
    ).rejects.toMatchObject({ statusCode: 404 })
  })

  it('rejects when project is disabled (400)', async () => {
    vi.mocked(repo.findById).mockResolvedValueOnce({ ...mockProject, enabled: false })
    await expect(
      manager.start({ conversationId: 'conv-3', projectId: 'proj-1', prompt: 'test' }),
    ).rejects.toMatchObject({ statusCode: 400 })
  })

  it('rejects when project path is invalid', async () => {
    vi.mocked(repo.findById).mockResolvedValueOnce({ ...mockProject, path: '/etc' })
    await expect(
      manager.start({ conversationId: 'conv-4', projectId: 'proj-1', prompt: 'test' }),
    ).rejects.toMatchObject({ statusCode: 400 })
  })

  it('stops an active run', async () => {
    await manager.start({ conversationId: 'conv-1', projectId: 'proj-1', prompt: 'test' })
    const stopSpy = vi.spyOn(devin, 'stop').mockImplementation(() => {})
    const run = await manager.stop('conv-1')
    expect(run?.status).toBe('stopped')
    expect(manager.isConversationActive('conv-1')).toBe(false)
    expect(stopSpy).toHaveBeenCalled()
  })

  it('returns null when stopping a non-existent run', async () => {
    const run = await manager.stop('nonexistent')
    expect(run).toBeNull()
  })

  it('lists active runs', async () => {
    await manager.start({ conversationId: 'conv-1', projectId: 'proj-1', prompt: 'test' })
    const active = manager.listActiveRuns()
    expect(active).toHaveLength(1)
    expect(active[0].conversationId).toBe('conv-1')
  })

  it('returns status for a conversation', async () => {
    await manager.start({ conversationId: 'conv-1', projectId: 'proj-1', prompt: 'test' })
    const status = manager.getStatus('conv-1')
    expect(status?.conversationId).toBe('conv-1')
    expect(status?.status).toBe('running')
  })

  it('returns null status for unknown conversation', () => {
    expect(manager.getStatus('nonexistent')).toBeNull()
  })

  it('extracts conversation ID from session name', async () => {
    // The session name format is jheckbot-{slug}-{conversationId}
    await manager.start({ conversationId: 'conv-1', projectId: 'proj-1', prompt: 'test' })
    const run = manager.getStatus('conv-1')
    expect(run?.sessionName).toContain('conv-1')
  })
})
