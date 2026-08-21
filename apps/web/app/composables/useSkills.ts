interface Skill {
  name: string
  description: string
  triggers: string[]
  provider: string
  base_dir: string
  display_name: string
  warnings: string[]
  errors: string[]
}

interface SkillsResult {
  skills: Skill[]
  cached: boolean
  checkedAt: string
}

export function useSkills() {
  const api = useApi()

  return {
    list: (refresh = false) => api.get<SkillsResult>(`/api/skills${refresh ? '?refresh=1' : ''}`),
  }
}
