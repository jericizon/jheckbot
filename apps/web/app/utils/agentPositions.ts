import type { Vec2 } from '~/office/types'

// Persists per-agent office tiles in localStorage so a browser refresh
// restores agents where they were instead of replaying the entrance intro.
// Keyed per agent id so positions survive independent of office identity.

const PREFIX = 'jheckbot:office:agent-pos:'

function key(agentId: string): string {
  return `${PREFIX}${agentId}`
}

// localStorage may be unavailable (private mode, SSR, disabled). Fail soft.
function storage(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null
  } catch {
    return null
  }
}

export function getSavedAgentTile(agentId: string): Vec2 | null {
  const s = storage()
  if (!s) return null
  let raw: string | null
  try {
    raw = s.getItem(key(agentId))
  } catch {
    return null
  }
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<Vec2>
    if (
      typeof parsed.x === 'number' &&
      Number.isFinite(parsed.x) &&
      typeof parsed.y === 'number' &&
      Number.isFinite(parsed.y)
    ) {
      return { x: parsed.x, y: parsed.y }
    }
  } catch {
    // Corrupt entry — drop it so a bad value never blocks the default intro.
    try {
      s.removeItem(key(agentId))
    } catch {
      // ignore
    }
  }
  return null
}

export function saveAgentTile(agentId: string, tile: Vec2): void {
  const s = storage()
  if (!s) return
  try {
    s.setItem(key(agentId), JSON.stringify({ x: tile.x, y: tile.y }))
  } catch {
    // Quota exceeded or disabled — persistence is best-effort.
  }
}

export function clearAgentTile(agentId: string): void {
  const s = storage()
  if (!s) return
  try {
    s.removeItem(key(agentId))
  } catch {
    // ignore
  }
}
