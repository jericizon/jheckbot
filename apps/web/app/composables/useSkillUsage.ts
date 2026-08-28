const STORAGE_KEY = 'jheckbot:skill-usage'

type UsageMap = Record<string, number>

function readUsage(): UsageMap {
  if (!import.meta.client) return {}
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as UsageMap) : {}
  } catch {
    return {}
  }
}

function writeUsage(map: UsageMap): void {
  if (!import.meta.client) return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
  } catch {
    // ignore quota errors
  }
}

export function useSkillUsage() {
  const usage = readUsage()

  function record(displayName: string): void {
    const map = readUsage()
    map[displayName] = (map[displayName] ?? 0) + 1
    writeUsage(map)
  }

  function getCount(displayName: string): number {
    return usage[displayName] ?? 0
  }

  return { record, getCount }
}
