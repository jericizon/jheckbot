import { describe, it, expect } from 'vitest'
import { buildLayout, NavigationGrid, WORLD_W, WORLD_H } from '../app/office'
import { DemoTimeline, demoAgents } from '../app/office/simulation/DemoTimeline'
import type { OfficeDirector } from '../app/office/simulation/OfficeDirector'
import type { AgentDescriptor, AgentVisualState, MessageKind, TaskDescriptor, Vec2 } from '../app/office/types'
import { drawCharacterOps, rasterizeSilhouette, AgentSprite, walkFrameCount } from '../app/office/agents/AgentSprite'
import { AgentMovement } from '../app/office/agents/AgentMovement'
import { CHARACTER_SHEET } from '../app/office/characters/CharacterSheet'

// Unit tests for the pure (PIXI-free) office logic: the navigation grid /
// A* pathfinding, the layout's walkability, and the deterministic demo
// timeline's sequencing against a fake director.

describe('buildLayout', () => {
  it('produces a grid of the configured world size', () => {
    const layout = buildLayout()
    expect(layout.width).toBe(WORLD_W)
    expect(layout.height).toBe(WORLD_H)
    expect(layout.tiles.length).toBe(WORLD_H)
    expect(layout.tiles[0]?.length).toBe(WORLD_W)
  })

  it('marks the outer border as non-walkable walls', () => {
    const layout = buildLayout()
    expect(layout.walkable[0]?.[0]).toBe(false)
    expect(layout.walkable[0]?.[WORLD_W - 1]).toBe(false)
    expect(layout.walkable[WORLD_H - 1]?.[0]).toBe(false)
    expect(layout.walkable[WORLD_H - 1]?.[WORLD_W - 1]).toBe(false)
  })

  it('keeps every workstation seat walkable and its desk blocked', () => {
    const layout = buildLayout()
    for (const ws of layout.workstations) {
      expect(layout.walkable[ws.seat.y]?.[ws.seat.x]).toBe(true)
      expect(layout.walkable[ws.desk.y]?.[ws.desk.x]).toBe(false)
    }
  })

  it('exposes a workstation for every role used in the demo', () => {
    const layout = buildLayout()
    for (const a of demoAgents()) {
      const ws = layout.workstations.find((w) => w.role === a.role)
      expect(ws, `workstation for role ${a.role}`).toBeDefined()
    }
  })

  it('provides meeting seats inside the collaboration room', () => {
    const layout = buildLayout()
    expect(layout.meetingSeats.length).toBeGreaterThanOrEqual(4)
    for (const seat of layout.meetingSeats) {
      expect(layout.walkable[seat.y]?.[seat.x]).toBe(true)
    }
  })
})

describe('NavigationGrid', () => {
  it('finds a straight-line path between two walkable tiles', () => {
    const layout = buildLayout()
    const nav = NavigationGrid.fromLayout(layout)
    const path = nav.findPath({ x: 12, y: 9 }, { x: 20, y: 9 })
    expect(path).not.toBeNull()
    expect(path?.[0]).toEqual({ x: 12, y: 9 })
    expect(path?.[path.length - 1]).toEqual({ x: 20, y: 9 })
  })

  it('returns null when the target is blocked', () => {
    const layout = buildLayout()
    const nav = NavigationGrid.fromLayout(layout)
    // (0,0) is the outer wall — not walkable.
    expect(nav.findPath({ x: 12, y: 9 }, { x: 0, y: 0 })).toBeNull()
  })

  it('returns a single-tile path when start === end', () => {
    const layout = buildLayout()
    const nav = NavigationGrid.fromLayout(layout)
    const path = nav.findPath({ x: 12, y: 9 }, { x: 12, y: 9 })
    expect(path).toEqual([{ x: 12, y: 9 }])
  })

  it('routes around walls via corridors to reach a room interior', () => {
    const layout = buildLayout()
    const nav = NavigationGrid.fromLayout(layout)
    // From the horizontal corridor to the CEO's chair tile.
    const path = nav.findPath({ x: 12, y: 9 }, { x: 6, y: 5 })
    expect(path).not.toBeNull()
    expect(path?.length).toBeGreaterThan(1)
    // Every step must be walkable.
    for (const step of path ?? []) {
      expect(nav.isWalkable(step.x, step.y)).toBe(true)
    }
  })

  it('finds the nearest walkable tile to a blocked target', () => {
    const layout = buildLayout()
    const nav = NavigationGrid.fromLayout(layout)
    const near = nav.nearestWalkable({ x: 0, y: 0 })
    expect(near).not.toBeNull()
    expect(nav.isWalkable(near!.x, near!.y)).toBe(true)
  })
})

// A fake director that records every call so we can assert the demo timeline
// drives the office through the full acceptance-test workflow (spec §36)
// without needing a PIXI renderer.
function makeRecordingDirector(): OfficeDirector & {
  calls: string[]
  agents: Map<string, AgentDescriptor>
  tasks: TaskDescriptor[]
} {
  const calls: string[] = []
  const agents = new Map<string, AgentDescriptor>()
  const tasks: TaskDescriptor[] = []
  const seat = (role: AgentDescriptor['role']): Vec2 => ({ x: 1, y: 1 })

  const dir: OfficeDirector = {
    createAgent(agent, tile) {
      agents.set(agent.id, agent)
      calls.push(`create:${agent.role}`)
    },
    async walk(agentId, tile) {
      calls.push(`walk:${agentId}`)
    },
    async workAt(agentId, state) {
      calls.push(`work:${agentId}:${state ?? 'working'}`)
    },
    setState(agentId, state) {
      calls.push(`state:${agentId}:${state}`)
    },
    async message(from, to, kind) {
      calls.push(`msg:${from}->${to}:${kind}`)
    },
    think(agentId) {
      calls.push(`think:${agentId}`)
    },
    async review(agentId) {
      calls.push(`review:${agentId}`)
    },
    succeed(agentId) {
      calls.push(`succeed:${agentId}`)
    },
    fail(agentId) {
      calls.push(`fail:${agentId}`)
    },
    idle(agentId) {
      calls.push(`idle:${agentId}`)
    },
    createTask(task) {
      tasks.push(task)
      calls.push(`task:create:${task.id}:${task.status}`)
    },
    updateTask(task) {
      const i = tasks.findIndex((t) => t.id === task.id)
      if (i >= 0) tasks[i] = task
      calls.push(`task:update:${task.id}:${task.status}`)
    },
    agentIdForRole(role) {
      for (const a of agents.values()) if (a.role === role) return a.id
      return undefined
    },
    meetingSeat(index) {
      return { x: 23, y: 13 }
    },
    workstationSeat: seat,
  }
  return { ...dir, calls, agents, tasks }
}

describe('DemoTimeline', () => {
  it('seeds all demo agents and the initial task', async () => {
    const dir = makeRecordingDirector()
    const demo = new DemoTimeline(dir, { speed: 100 })
    await demo.run()
    for (const a of demoAgents()) {
      expect(dir.agents.has(a.id)).toBe(true)
    }
    expect(dir.tasks.length).toBeGreaterThanOrEqual(1)
    expect(dir.tasks[0]?.title).toMatch(/authentication/i)
  })

  it('runs the full CEO -> Developer -> QA acceptance workflow', async () => {
    const dir = makeRecordingDirector()
    const demo = new DemoTimeline(dir, { speed: 100 })
    await demo.run()

    const seq = dir.calls.join('\n')
    // CEO thinks first.
    expect(seq).toContain('think:demo-ceo')
    // CEO assigns the task to the backend developer via an envelope.
    expect(seq).toContain('msg:demo-ceo->demo-backend:task_assignment')
    // Developer codes and sends a QA request.
    expect(seq).toContain('work:demo-backend:coding')
    expect(seq).toContain('msg:demo-backend->demo-qa:approval_request')
    // QA reviews, finds an issue, warns the developer.
    expect(seq).toContain('work:demo-qa:reviewing')
    expect(seq).toContain('msg:demo-qa->demo-backend:warning')
    expect(seq).toContain('fail:demo-backend')
    // Developer fixes, re-requests review, QA approves, CEO succeeds.
    expect(seq).toContain('msg:demo-qa->demo-ceo:success')
    expect(seq).toContain('succeed:demo-ceo')
  })

  it('drives the task through queued -> ... -> completed', async () => {
    const dir = makeRecordingDirector()
    const demo = new DemoTimeline(dir, { speed: 100 })
    await demo.run()
    const statuses = dir.calls
      .filter((c) => c.startsWith('task:update:task-demo-1:'))
      .map((c) => c.split(':')[3])
    expect(statuses[0]).toBe('planning')
    expect(statuses[statuses.length - 1]).toBe('completed')
    expect(statuses).toContain('blocked')
    expect(statuses).toContain('review')
  })

  it('settles all workflow agents back to idle at the end', async () => {
    const dir = makeRecordingDirector()
    const demo = new DemoTimeline(dir, { speed: 100 })
    await demo.run()
    expect(dir.calls.filter((c) => c === 'idle:demo-ceo').length).toBeGreaterThanOrEqual(1)
    expect(dir.calls.filter((c) => c === 'idle:demo-backend').length).toBeGreaterThanOrEqual(1)
    expect(dir.calls.filter((c) => c === 'idle:demo-qa').length).toBeGreaterThanOrEqual(1)
  })
})

// Re-export types used only for assertions to keep the compiler aware of them.
export type { AgentVisualState, MessageKind }

// The visual states that AgentSprite builds a texture set for. Each must
// produce at least one frame for every role.
const VISUAL_STATES = ['idle', 'walk', 'seated', 'thinking', 'talking', 'success', 'error', 'offline'] as const
const ALL_ROLES: AgentDescriptor['role'][] = ['ceo', 'backend', 'frontend', 'qa', 'designer', 'devops']

describe('AgentSprite silhouettes', () => {
  it('produces a non-empty rect set for every role/state/frame', () => {
    for (const role of ALL_ROLES) {
      for (const state of VISUAL_STATES) {
        const dirs: ('down' | 'up' | 'left' | 'right')[] =
          state === 'walk' ? ['down', 'up', 'left', 'right'] : ['down']
        for (const dir of dirs) {
          const frames = state === 'walk' || state === 'idle' || state === 'talking' ? [0, 1] : [0]
          for (const frame of frames) {
            const ops = drawCharacterOps(role, state, dir, frame)
            expect(ops.length, `${role}/${state}/${dir}/${frame} produced no rects`).toBeGreaterThan(0)
          }
        }
      }
    }
  })

  it('applies the per-role heightScale from the character sheet', () => {
    // The scale is applied on the sprite container in AgentSprite's constructor;
    // here we verify the sheet values the constructor reads are distinct and
    // match the spec (§11): CEO tallest, Research shortest.
    const scales = ALL_ROLES.map((r) => CHARACTER_SHEET[r].silhouette.heightScale)
    expect(CHARACTER_SHEET.ceo.silhouette.heightScale).toBe(1.1)
    expect(CHARACTER_SHEET.designer.silhouette.heightScale).toBe(0.9)
    expect(new Set(scales).size).toBe(ALL_ROLES.length)
  })

  it('AgentSprite.scaleFor returns the heightScale applied to the sprite', () => {
    // scaleFor is the static method the constructor calls via
    // sprite.scale.set(scaleFor(role)); verifying it directly makes the
    // scale application testable without a PIXI renderer.
    expect(AgentSprite.scaleFor('ceo')).toBe(1.1)
    const scales = ALL_ROLES.map((r) => AgentSprite.scaleFor(r))
    expect(new Set(scales).size).toBe(ALL_ROLES.length)
  })

  it('draws frontend spiky hair within the texture frame (y=0 row)', () => {
    // Regression: frontend spikes were drawn at y=-1 (off-frame) and clipped
    // by the Rectangle(0,0,16,18) texture. They must now appear at y=0.
    const ops = drawCharacterOps('frontend', 'idle', 'down', 0)
    const grid = rasterizeSilhouette(ops).split('\n')
    const row0 = grid[0]!
    expect(row0).toContain('1')
  })

  it('gives each role a distinct down-state idle silhouette (rasterized hash)', () => {
    const hashes = new Map<AgentDescriptor['role'], string>()
    for (const role of ALL_ROLES) {
      const ops = drawCharacterOps(role, 'idle', 'down', 0)
      hashes.set(role, rasterizeSilhouette(ops))
    }
    // No two roles share the same silhouette bitmap.
    const unique = new Set(hashes.values())
    expect(unique.size).toBe(ALL_ROLES.length)
  })

  it('gives each role a distinct rect count for the down-state idle frame', () => {
    // Rect count is a coarser proxy for silhouette complexity; combined with
    // the bitmap hash above it guards against accidental regressions.
    const counts = new Map<AgentDescriptor['role'], number>()
    for (const role of ALL_ROLES) {
      counts.set(role, drawCharacterOps(role, 'idle', 'down', 0).length)
    }
    // At least the accessories/head shapes should make counts differ across
    // most roles; assert the set is non-trivial (more than one distinct value).
    expect(new Set(counts.values()).size).toBeGreaterThan(1)
  })

  it('varies torso width by shoulderWidth', () => {
    // CEO (shoulderWidth 1.1) must draw a wider torso than Research
    // (shoulderWidth 0.88).
    const ceoOps = drawCharacterOps('ceo', 'idle', 'down', 0)
    const resOps = drawCharacterOps('designer', 'idle', 'down', 0)
    const torsoWidth = (ops: typeof ceoOps) => {
      const torso = ops.filter((o) => o.y === 8 && o.h === 5)
      return torso.length ? torso[0]!.w : 0
    }
    expect(torsoWidth(ceoOps)).toBeGreaterThan(torsoWidth(resOps))
  })
})

describe('per-role walk animations (spec §9)', () => {
  const EXPECTED_FRAMES: Record<AgentDescriptor['role'], number> = {
    ceo: 2,
    backend: 3,
    frontend: 3,
    qa: 3,
    designer: 2,
    devops: 2,
  }

  it('walkFrameCount returns the spec-mandated frame count per role', () => {
    for (const role of ALL_ROLES) {
      expect(walkFrameCount(role), `${role} frame count`).toBe(EXPECTED_FRAMES[role])
    }
  })

  it('produces a non-empty rect set for every walk frame of every role', () => {
    for (const role of ALL_ROLES) {
      const count = walkFrameCount(role)
      for (const dir of ['down', 'up', 'left', 'right'] as const) {
        for (let f = 0; f < count; f++) {
          const ops = drawCharacterOps(role, 'walk', dir, f)
          expect(ops.length, `${role}/walk/${dir}/${f} produced no rects`).toBeGreaterThan(0)
        }
      }
    }
  })

  it('walk textures differ from idle textures for each role (rect comparison)', () => {
    for (const role of ALL_ROLES) {
      const idleOps = drawCharacterOps(role, 'idle', 'down', 0)
      const walkOps = drawCharacterOps(role, 'walk', 'down', 0)
      const idleHash = rasterizeSilhouette(idleOps)
      const walkHash = rasterizeSilhouette(walkOps)
      expect(walkHash, `${role} walk silhouette should differ from idle`).not.toBe(idleHash)
    }
  })

  it('gives frontend a wider stride than ceo on stride frames', () => {
    // Frontend stride = 2px, CEO stride = 1px. Compare leg x-spread on the
    // first stride frame (frame 0 for both).
    const ceoLegs = drawCharacterOps('ceo', 'walk', 'down', 0)
      .filter((o) => o.y === 13 && o.h === 4)
      .map((o) => o.x)
    const feLegs = drawCharacterOps('frontend', 'walk', 'down', 0)
      .filter((o) => o.y === 13 && o.h === 4)
      .map((o) => o.x)
    const ceoSpread = ceoLegs.length === 2 ? Math.abs(ceoLegs[0]! - ceoLegs[1]!) : 0
    const feSpread = feLegs.length === 2 ? Math.abs(feLegs[0]! - feLegs[1]!) : 0
    expect(feSpread).toBeGreaterThan(ceoSpread)
  })

  it('QA frame 2 is a pause frame with legs together (no stride spread)', () => {
    const pauseOps = drawCharacterOps('qa', 'walk', 'down', 2)
    const pauseLegs = pauseOps.filter((o) => o.y === 13 && o.h === 4).map((o) => o.x)
    const strideOps = drawCharacterOps('qa', 'walk', 'down', 0)
    const strideLegs = strideOps.filter((o) => o.y === 13 && o.h === 4).map((o) => o.x)
    expect(pauseLegs.length).toBe(2)
    expect(strideLegs.length).toBe(2)
    if (pauseLegs.length === 2 && strideLegs.length === 2) {
      const pauseSpread = Math.abs(pauseLegs[0]! - pauseLegs[1]!)
      const strideSpread = Math.abs(strideLegs[0]! - strideLegs[1]!)
      // Pause frame has no stride spread; stride frame spreads wider.
      expect(strideSpread).toBeGreaterThan(pauseSpread)
    }
  })
})

describe('AgentMovement per-role speed and QA micro-stops (spec §9, §5)', () => {
  it('uses speedMultiplier * BASE_SPEED for movement speed', () => {
    const BASE_SPEED = 3.0
    for (const role of ALL_ROLES) {
      const speed = CHARACTER_SHEET[role].walk.speedMultiplier * BASE_SPEED
      const mv = new AgentMovement(speed)
      // A 1-tile straight path should complete in ~1/speed seconds.
      const px = { x: 0, y: 0 }
      const target = { x: 1, y: 0 }
      mv.setPath([target], px)
      expect(mv.isMoving()).toBe(true)
      // Step by small dt increments until arrived or timeout.
      let arrived = false
      for (let i = 0; i < 1000 && !arrived; i++) {
        arrived = mv.update(0.016)
      }
      expect(arrived, `${role} should arrive at target tile`).toBe(true)
    }
  })

  it('QA micro-stop: AgentMovement with QA params has a non-zero microStopInterval', () => {
    const mv = new AgentMovement(2.7, { enabled: true, interval: 2.0, duration: 0.3 })
    expect(mv.microStopInterval).toBeGreaterThan(0)
  })

  it('non-QA roles have a zero microStopInterval by default', () => {
    const mv = new AgentMovement(3.0)
    expect(mv.microStopInterval).toBe(0)
  })

  it('QA micro-stop pauses movement then resumes', () => {
    const mv = new AgentMovement(3.0, { enabled: true, interval: 0.1, duration: 0.3 })
    mv.setPath([{ x: 10, y: 0 }], { x: 0, y: 0 })
    expect(mv.isMoving()).toBe(true)
    // Walk until the micro-stop triggers (~0.1s).
    let stopped = false
    for (let i = 0; i < 20; i++) {
      mv.update(0.01)
      if (!mv.isMoving()) {
        stopped = true
        break
      }
    }
    expect(stopped, 'QA should enter a micro-stop').toBe(true)
    // After the stop duration, movement resumes.
    for (let i = 0; i < 40; i++) {
      mv.update(0.01)
      if (mv.isMoving()) break
    }
    expect(mv.isMoving(), 'QA should resume walking after micro-stop').toBe(true)
  })
})
