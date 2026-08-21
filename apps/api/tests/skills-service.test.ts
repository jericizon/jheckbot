import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SkillsService } from '../src/services/SkillsService.js'

const mockExecFileSync = vi.hoisted(() => vi.fn())

vi.mock('node:child_process', () => ({
  execFileSync: mockExecFileSync,
}))

const SAMPLE_SKILLS = [
  {
    name: 'interview-me',
    description: 'Extracts what the user actually wants.',
    triggers: ['user', 'model'],
    provider: 'Devin',
    base_dir: '/home/jeric/.claude/skills/interview-me',
    display_name: 'interview-me',
    warnings: [],
    errors: [],
  },
  {
    name: 'windsurf:cloudflare',
    description: 'Comprehensive Cloudflare platform skill.',
    triggers: ['user', 'model'],
    provider: 'Devin',
    base_dir: '/home/jeric/.codeium/windsurf/skills/cloudflare',
    display_name: 'cloudflare',
    warnings: [],
    errors: [],
  },
]

describe('SkillsService', () => {
  let service: SkillsService

  beforeEach(() => {
    vi.clearAllMocks()
    mockExecFileSync.mockReset()
    mockExecFileSync.mockImplementation(() => Buffer.from(JSON.stringify(SAMPLE_SKILLS)))
    service = new SkillsService('devin')
  })

  it('lists skills from the Devin CLI', async () => {
    const result = await service.list()
    expect(result.skills).toHaveLength(2)
    expect(result.skills[0].name).toBe('interview-me')
    expect(result.cached).toBe(false)
  })

  it('invokes `devin skills list --json`', async () => {
    await service.list()
    expect(mockExecFileSync).toHaveBeenCalledWith(
      'devin',
      ['skills', 'list', '--json'],
      expect.objectContaining({ stdio: 'pipe', encoding: 'utf8' }),
    )
  })

  it('serves subsequent calls from cache', async () => {
    await service.list()
    const second = await service.list()
    expect(second.cached).toBe(true)
    // execFileSync should only have been called once (the initial fetch)
    expect(mockExecFileSync).toHaveBeenCalledTimes(1)
  })

  it('bypasses the cache when refresh=true', async () => {
    await service.list()
    await service.list(true)
    expect(mockExecFileSync).toHaveBeenCalledTimes(2)
  })

  it('returns an empty list when the CLI fails', async () => {
    mockExecFileSync.mockImplementation(() => {
      throw new Error('devin not found')
    })
    const result = await service.list()
    expect(result.skills).toEqual([])
    expect(result.cached).toBe(false)
  })

  it('returns an empty list when output is not a JSON array', async () => {
    mockExecFileSync.mockImplementation(() => Buffer.from(JSON.stringify({ not: 'an array' })))
    const result = await service.list()
    expect(result.skills).toEqual([])
  })

  it('filters out entries missing required string fields', async () => {
    mockExecFileSync.mockImplementation(() =>
      Buffer.from(
        JSON.stringify([
          { name: 'ok', description: 'good' },
          { name: 123, description: 'bad name type' },
          { name: 'no-desc' },
        ]),
      ),
    )
    const result = await service.list()
    expect(result.skills).toHaveLength(1)
    expect(result.skills[0].name).toBe('ok')
  })
})
