import { execFileSync } from 'node:child_process'
import type { Skill } from '@jheckbot/shared'

export interface SkillsResult {
  skills: Skill[]
  cached: boolean
  checkedAt: string
}

const CACHE_TTL_MS = 5 * 60 * 1000

/**
 * Lists Devin CLI skills via `devin skills list --json`.
 * Results are cached in memory for CACHE_TTL_MS; `refresh` bypasses the cache.
 */
export class SkillsService {
  private cachedSkills: Skill[] | null = null
  private cachedAt = 0

  constructor(
    private devinBin: string,
    private cwd: string = process.cwd(),
  ) {}

  async list(refresh = false): Promise<SkillsResult> {
    if (!refresh && this.cachedSkills && Date.now() - this.cachedAt < CACHE_TTL_MS) {
      return {
        skills: this.cachedSkills,
        cached: true,
        checkedAt: new Date(this.cachedAt).toISOString(),
      }
    }
    const skills = this.fetchSkills()
    this.cachedSkills = skills
    this.cachedAt = Date.now()
    return { skills, cached: false, checkedAt: new Date(this.cachedAt).toISOString() }
  }

  private fetchSkills(): Skill[] {
    try {
      const output = execFileSync(this.devinBin, ['skills', 'list', '--json'], {
        cwd: this.cwd,
        stdio: 'pipe',
        timeout: 10000,
        encoding: 'utf8',
      })
      const parsed = JSON.parse(output)
      if (!Array.isArray(parsed)) return []
      return parsed.filter(this.isSkill)
    } catch {
      // CLI missing, not authenticated, or malformed output — degrade to empty list
      return []
    }
  }

  private isSkill(value: unknown): value is Skill {
    if (!value || typeof value !== 'object') return false
    const v = value as Record<string, unknown>
    return typeof v.name === 'string' && typeof v.description === 'string'
  }
}
