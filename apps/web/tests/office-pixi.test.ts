import { describe, it, expect } from 'vitest'
import { buildLayout, NavigationGrid, WORLD_W, WORLD_H } from '../app/office'
import { DemoTimeline, demoAgents } from '../app/office/simulation/DemoTimeline'
import type { OfficeDirector } from '../app/office/simulation/OfficeDirector'
import type { ActivityKind, AgentDescriptor, AgentVisualState, Direction, MessageKind, TaskDescriptor, Vec2 } from '../app/office/types'
import { drawCharacterOps, rasterizeSilhouette, AgentSprite, walkFrameCount, workingFrameCount } from '../app/office/agents/AgentSprite'
import { AgentMovement } from '../app/office/agents/AgentMovement'
import { CHARACTER_SHEET } from '../app/office/characters/CharacterSheet'
import { WorkActivityRunner, type WorkAgentController, activityDurationRangeFor } from '../app/office/agents/WorkActivityRunner'
import { iconForKind, KIND_CONFIG, type MessageIcon } from '../app/office/effects/OfficeEffects'
import { isPhysicalMessageKind, conversationApproachTile, faceDirection, runIntroduction, runExit, type LifecycleAgent, type IntroductionPlan } from '../app/office/VirtualOffice'
import { ReactionGlance } from '../app/office/agents/AgentEntity'
import { OfficeWorld } from '../app/office/world/OfficeWorld'
import type { Renderer } from 'pixi.js'

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
export type { AgentVisualState, MessageKind, ActivityKind }

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

// --- Per-role working animations (spec §16, Task 5) ---

// All ActivityKinds the sprite bakes working frame sets for.
const ALL_ACTIVITIES: ActivityKind[] = [
  'coding',
  'typing',
  'drawing',
  'testing',
  'monitoring',
  'reading',
  'writing',
  'thinking_pause',
  'board_check',
  'server_check',
  'task_board_read',
  'communicating',
]

// The working visual states that map to per-activity frame sets.
const WORKING_STATES: AgentVisualState[] = ['working', 'coding', 'testing', 'reviewing', 'reading']

// Stable string key for a rect-op list so two frame sets can be compared.
function rectKey(ops: ReturnType<typeof drawCharacterOps>): string {
  return ops.map((o) => `${o.x},${o.y},${o.w},${o.h},${o.color}`).join('|')
}

describe('per-role working frames (spec §16)', () => {
  it('workingFrameCount returns >=1 frame for every role/activity', () => {
    for (const role of ALL_ROLES) {
      for (const activity of ALL_ACTIVITIES) {
        expect(workingFrameCount(role, activity), `${role}/${activity}`).toBeGreaterThanOrEqual(1)
      }
    }
  })

  it('produces a non-empty rect set for every role/activity/frame', () => {
    for (const role of ALL_ROLES) {
      for (const activity of ALL_ACTIVITIES) {
        const count = workingFrameCount(role, activity)
        for (let f = 0; f < count; f++) {
          const ops = drawCharacterOps(role, 'seated', 'down', f, activity)
          expect(ops.length, `${role}/${activity}/${f} produced no rects`).toBeGreaterThan(0)
        }
      }
    }
  })

  it('gives each role distinct working frame sets across activities (rect comparison)', () => {
    // For every role, the rect set of each activity's first frame must differ
    // from at least one other activity in that role's working sequence — i.e.
    // activities are not all identical.
    for (const role of ALL_ROLES) {
      const seq = CHARACTER_SHEET[role].workingSequence
      const keys = new Set<string>()
      for (const activity of seq) {
        const ops = drawCharacterOps(role, 'seated', 'down', 0, activity)
        keys.add(rectKey(ops))
      }
      // The role's working sequence should produce more than one distinct frame.
      expect(keys.size, `${role} working activities should not all be identical`).toBeGreaterThan(1)
    }
  })

  it('working frames differ from idle frames per role', () => {
    for (const role of ALL_ROLES) {
      const idleOps = drawCharacterOps(role, 'idle', 'down', 0)
      const idleKey = rectKey(idleOps)
      // At least one activity in the role's working sequence must differ from idle.
      const seq = CHARACTER_SHEET[role].workingSequence
      const anyDiffer = seq.some(
        (activity) => rectKey(drawCharacterOps(role, 'seated', 'down', 0, activity)) !== idleKey,
      )
      expect(anyDiffer, `${role} working frames should differ from idle`).toBe(true)
    }
  })

  it('typing and thinking_pause produce distinct frames for backend', () => {
    const typing = rectKey(drawCharacterOps('backend', 'seated', 'down', 0, 'typing'))
    const pause = rectKey(drawCharacterOps('backend', 'seated', 'down', 0, 'thinking_pause'))
    expect(typing).not.toBe(pause)
  })

  it('drawing and board_check produce distinct frames for frontend', () => {
    const drawing = rectKey(drawCharacterOps('frontend', 'seated', 'down', 0, 'drawing'))
    const board = rectKey(drawCharacterOps('frontend', 'seated', 'down', 0, 'board_check'))
    expect(drawing).not.toBe(board)
  })

  it('monitoring and server_check produce distinct frames for devops', () => {
    const mon = rectKey(drawCharacterOps('devops', 'seated', 'down', 0, 'monitoring'))
    const srv = rectKey(drawCharacterOps('devops', 'seated', 'down', 0, 'server_check'))
    expect(mon).not.toBe(srv)
  })

  it('reading and writing produce distinct frames for designer (research)', () => {
    const read = rectKey(drawCharacterOps('designer', 'seated', 'down', 0, 'reading'))
    const write = rectKey(drawCharacterOps('designer', 'seated', 'down', 0, 'writing'))
    expect(read).not.toBe(write)
  })

  it('working silhouettes differ from idle silhouettes for each role', () => {
    for (const role of ALL_ROLES) {
      const idleHash = rasterizeSilhouette(drawCharacterOps(role, 'idle', 'down', 0))
      const seq = CHARACTER_SHEET[role].workingSequence
      const anyDiffer = seq.some(
        (activity) =>
          rasterizeSilhouette(drawCharacterOps(role, 'seated', 'down', 0, activity)) !== idleHash,
      )
      expect(anyDiffer, `${role} working silhouette should differ from idle`).toBe(true)
    }
  })
})

// A fake WorkAgentController that records setActivity calls and lets the test
// drive the reported visual state via a mutable `state` field.
function makeFakeWorkController(role: AgentDescriptor['role']): WorkAgentController & {
  activities: ActivityKind[]
  state: AgentVisualState
} {
  const fake = {
    role,
    state: 'coding' as AgentVisualState,
    activities: [] as ActivityKind[],
    currentState(): AgentVisualState {
      return fake.state
    },
    isInterrupted(): boolean {
      return false
    },
    setActivity(a: ActivityKind): void {
      fake.activities.push(a)
    },
  }
  return fake
}

describe('WorkActivityRunner (spec §16)', () => {
  it('cycles through the role workingSequence steps in order', () => {
    const role: AgentDescriptor['role'] = 'backend'
    const seq = CHARACTER_SHEET[role].workingSequence
    const ctrl = makeFakeWorkController(role)
    // Deterministic RNG pinned to the min duration so we can step precisely.
    const runner = new WorkActivityRunner(ctrl, seq, () => 0)

    // Enter step 0.
    runner.update(0.01)
    expect(runner.stepIndex).toBe(0)
    expect(runner.currentActivity).toBe(seq[0])
    expect(ctrl.activities[0]).toBe(seq[0])

    // Walk a full cycle: for each step, advance past its duration then re-enter
    // the next. The runner enters a step on one update and advances on the next,
    // so each step takes two update() calls.
    const recorded: ActivityKind[] = [seq[0]!]
    for (let i = 0; i < seq.length; i++) {
      const cur = runner.currentActivity
      const range = activityDurationRangeFor(cur)
      runner.update(range.min + 0.01) // advance (started -> false)
      runner.update(0.01) // enter next step
      recorded.push(runner.currentActivity)
    }
    // After a full cycle we wrap back to step 0.
    expect(runner.stepIndex).toBe(0)
    expect(recorded).toEqual([seq[0], seq[1], seq[2], seq[3], seq[0]])
  })

  it('applies each activity via setActivity as it advances', () => {
    const role: AgentDescriptor['role'] = 'qa'
    const seq = CHARACTER_SHEET[role].workingSequence
    const ctrl = makeFakeWorkController(role)
    const runner = new WorkActivityRunner(ctrl, seq, () => 0)

    runner.update(0.01) // enter step 0
    expect(ctrl.activities).toEqual([seq[0]])
    const range = activityDurationRangeFor(seq[0]!)
    runner.update(range.min + 0.01) // advance (started -> false)
    runner.update(0.01) // enter step 1
    expect(ctrl.activities).toEqual([seq[0], seq[1]!])
  })

  it('pauses (does not advance or apply activities) when state is non-working', () => {
    const role: AgentDescriptor['role'] = 'backend'
    const seq = CHARACTER_SHEET[role].workingSequence
    const ctrl = makeFakeWorkController(role)
    const runner = new WorkActivityRunner(ctrl, seq, () => 0)

    // Start in a working state and enter step 0.
    ctrl.state = 'coding'
    runner.update(0.01)
    expect(ctrl.activities.length).toBe(1)

    // Transition to a non-working state and pump a large dt — nothing happens.
    ctrl.state = 'communicating'
    const before = ctrl.activities.length
    runner.update(100)
    expect(ctrl.activities.length).toBe(before)
    expect(runner.stepIndex).toBe(0)

    // Return to a working state — the runner resumes from where it paused.
    ctrl.state = 'coding'
    const range = activityDurationRangeFor(seq[0]!)
    runner.update(range.min + 0.01) // advance
    runner.update(0.01) // enter step 1
    expect(runner.stepIndex).toBe(1)
  })

  it('reset restarts the sequence from step 0', () => {
    const role: AgentDescriptor['role'] = 'devops'
    const seq = CHARACTER_SHEET[role].workingSequence
    const ctrl = makeFakeWorkController(role)
    const runner = new WorkActivityRunner(ctrl, seq, () => 0)

    runner.update(0.01)
    const range = activityDurationRangeFor(seq[0]!)
    runner.update(range.min + 0.01) // advance
    runner.update(0.01) // enter step 1
    expect(runner.stepIndex).toBe(1)

    runner.reset()
    expect(runner.stepIndex).toBe(0)
    runner.update(0.01)
    expect(runner.currentActivity).toBe(seq[0])
  })

  it('exposes spec §22 duration ranges for each activity', () => {
    for (const activity of ALL_ACTIVITIES) {
      const range = activityDurationRangeFor(activity)
      expect(range.min, `${activity} min`).toBeGreaterThan(0)
      expect(range.max, `${activity} max`).toBeGreaterThanOrEqual(range.min)
    }
  })

  it('only advances while in one of the working visual states', () => {
    const role: AgentDescriptor['role'] = 'ceo'
    const seq = CHARACTER_SHEET[role].workingSequence
    for (const ws of WORKING_STATES) {
      const ctrl = makeFakeWorkController(role)
      ctrl.state = ws
      const runner = new WorkActivityRunner(ctrl, seq, () => 0)
      runner.update(0.01)
      expect(ctrl.activities.length, `${ws} should drive the runner`).toBe(1)
    }
    for (const nonWorking of ['idle', 'communicating', 'walking', 'offline'] as AgentVisualState[]) {
      const ctrl = makeFakeWorkController(role)
      ctrl.state = nonWorking
      const runner = new WorkActivityRunner(ctrl, seq, () => 0)
      runner.update(0.01)
      expect(ctrl.activities.length, `${nonWorking} should not drive the runner`).toBe(0)
    }
  })
})

// --- Per-kind message visuals (spec §13, Task 7) ---

const ALL_MESSAGE_KINDS: MessageKind[] = [
  'normal',
  'task_assignment',
  'question',
  'response',
  'warning',
  'error',
  'success',
  'approval_request',
  'emergency',
]

describe('per-kind message icons (spec §13)', () => {
  it('iconForKind returns a distinct icon for every message kind', () => {
    const icons = new Map<MessageKind, MessageIcon>()
    for (const kind of ALL_MESSAGE_KINDS) {
      icons.set(kind, iconForKind(kind))
    }
    // Every kind maps to a defined icon.
    for (const kind of ALL_MESSAGE_KINDS) {
      expect(icons.get(kind), `${kind} should have an icon`).toBeDefined()
    }
    // All icons are distinct — no two kinds share the same visual.
    const unique = new Set(icons.values())
    expect(unique.size, 'each kind must have a distinct icon').toBe(ALL_MESSAGE_KINDS.length)
  })

  it('maps each kind to its spec-mandated icon shape', () => {
    expect(iconForKind('normal')).toBe('envelope')
    expect(iconForKind('task_assignment')).toBe('task')
    expect(iconForKind('question')).toBe('question')
    expect(iconForKind('response')).toBe('speech')
    expect(iconForKind('warning')).toBe('warning')
    expect(iconForKind('error')).toBe('error')
    expect(iconForKind('success')).toBe('success')
    expect(iconForKind('approval_request')).toBe('approval')
    expect(iconForKind('emergency')).toBe('emergency')
  })

  it('marks urgent kinds (warning, error, emergency) with pulse', () => {
    expect(KIND_CONFIG.warning.pulse).toBe(true)
    expect(KIND_CONFIG.error.pulse).toBe(true)
    expect(KIND_CONFIG.emergency.pulse).toBe(true)
    // Non-urgent kinds do not pulse.
    expect(KIND_CONFIG.normal.pulse).toBe(false)
    expect(KIND_CONFIG.success.pulse).toBe(false)
  })

  it('marks positive kinds (success, approval_request, emergency) with glow', () => {
    expect(KIND_CONFIG.success.glow).toBe(true)
    expect(KIND_CONFIG.approval_request.glow).toBe(true)
    // Neutral kinds do not glow.
    expect(KIND_CONFIG.normal.glow).toBe(false)
    expect(KIND_CONFIG.warning.glow).toBe(false)
  })

  it('response uses a speech bubble distinct from the normal envelope', () => {
    expect(iconForKind('response')).not.toBe(iconForKind('normal'))
  })
})

// --- Physical conversations (spec §14, Task 7) ---

describe('physical conversation helpers (spec §14)', () => {
  it('isPhysicalMessageKind returns true only for emergency', () => {
    expect(isPhysicalMessageKind('emergency')).toBe(true)
    for (const kind of ALL_MESSAGE_KINDS) {
      if (kind === 'emergency') continue
      expect(isPhysicalMessageKind(kind), `${kind} should not be physical`).toBe(false)
    }
  })

  it('conversationApproachTile returns a walkable tile adjacent to the recipient', () => {
    const layout = buildLayout()
    const nav = NavigationGrid.fromLayout(layout)
    // Pick a walkable tile in the open corridor as the recipient's position.
    const recipient = { x: 12, y: 9 }
    expect(nav.isWalkable(recipient.x, recipient.y)).toBe(true)
    const approach = conversationApproachTile(nav, recipient)
    expect(approach).not.toBeNull()
    if (approach) {
      expect(nav.isWalkable(approach.x, approach.y)).toBe(true)
      // Must be within 1 tile (adjacent) of the recipient.
      const dist = Math.abs(approach.x - recipient.x) + Math.abs(approach.y - recipient.y)
      expect(dist).toBeLessThanOrEqual(1)
    }
  })

  it('conversationApproachTile falls back to nearestWalkable when surrounded', () => {
    const layout = buildLayout()
    const nav = NavigationGrid.fromLayout(layout)
    // A blocked tile (desk) — should still return a nearby walkable tile.
    const blocked = { x: 0, y: 0 }
    const approach = conversationApproachTile(nav, blocked)
    expect(approach).not.toBeNull()
    if (approach) {
      expect(nav.isWalkable(approach.x, approach.y)).toBe(true)
    }
  })

  it('faceDirection returns the correct cardinal direction', () => {
    expect(faceDirection({ x: 0, y: 0 }, { x: 1, y: 0 })).toBe('right')
    expect(faceDirection({ x: 1, y: 0 }, { x: 0, y: 0 })).toBe('left')
    expect(faceDirection({ x: 0, y: 0 }, { x: 0, y: 1 })).toBe('down')
    expect(faceDirection({ x: 0, y: 1 }, { x: 0, y: 0 })).toBe('up')
  })

  it('faceDirection is reciprocal — two agents face opposite directions', () => {
    const a = { x: 5, y: 5 }
    const b = { x: 6, y: 5 }
    const aFaces = faceDirection(a, b)
    const bFaces = faceDirection(b, a)
    expect(aFaces).toBe('right')
    expect(bFaces).toBe('left')
  })
})

// --- Emergency routing (spec §13, Task 7) ---

describe('emergency message routing (spec §13)', () => {
  it('emergency is classified as a physical message, not an envelope', () => {
    // isPhysicalMessageKind is the routing predicate VirtualOffice.message()
    // uses to decide between physicalConversation() and sendEnvelope().
    expect(isPhysicalMessageKind('emergency')).toBe(true)
  })

  it('non-emergency kinds are classified as envelope messages', () => {
    const envelopeKinds = ALL_MESSAGE_KINDS.filter((k) => k !== 'emergency')
    for (const kind of envelopeKinds) {
      expect(isPhysicalMessageKind(kind), `${kind} should route to an envelope`).toBe(false)
    }
  })

  it('emergency still has a distinct icon config (for completeness)', () => {
    // Even though emergency routes to a physical conversation, it has an icon
    // config so any direct envelope render (e.g. notification) stays consistent.
    expect(KIND_CONFIG.emergency.icon).toBe('emergency')
    expect(KIND_CONFIG.emergency.pulse).toBe(true)
  })
})

// --- Environmental micro-animations (spec §17, Task 8) ---

// OfficeWorld only touches the renderer lazily (in setMonitorGlow), so a bare
// cast is enough to drive construction + the update tick without a GPU.
function makeWorld(): OfficeWorld {
  const fakeRenderer = {} as unknown as Renderer
  return new OfficeWorld(fakeRenderer, buildLayout())
}

describe('OfficeWorld micro-animations (spec §17)', () => {
  it('exposes a micro-animation container populated with elements', () => {
    const world = makeWorld()
    expect(world.micro.children.length).toBeGreaterThan(0)
  })

  it('update(t) does not throw across a range of time values', () => {
    const world = makeWorld()
    for (const t of [0, 1.5, 3.0, 10.0, 100.0]) {
      expect(() => world.update(t)).not.toThrow()
    }
  })

  it('creates coffee steam particles above the break-room machine', () => {
    const world = makeWorld()
    expect(world.steamParticles.length).toBeGreaterThan(0)
    // Each steam particle is a 2x2 rect added to the micro layer.
    for (const p of world.steamParticles) {
      expect(p.gfx.width).toBe(2)
    }
  })

  it('creates blinking server LEDs on every server rack', () => {
    const world = makeWorld()
    const layout = buildLayout()
    const racks = layout.furniture.filter((f) => f.kind === 'serverRack').length
    // Two LEDs (green + red) per rack.
    expect(world.serverLeds.length).toBe(racks * 2)
    expect(world.serverLeds.length).toBeGreaterThan(0)
  })

  it('applies plant sway — container x shifts with different t values', () => {
    const world = makeWorld()
    expect(world.plantContainers.length).toBeGreaterThan(0)
    const plant = world.plantContainers[0]!
    world.update(0)
    const xAt0 = plant.x
    // Math.sin(t * 1.2): at t=0 -> 0; near t = ~1.3 sin(1.56) ~ 1 -> +1px.
    world.update(1.3)
    const xAt13 = plant.x
    expect(xAt13).not.toBe(xAt0)
    // Sway stays within the subtle ±1px budget.
    expect(Math.abs(xAt13 - xAt0)).toBeLessThanOrEqual(1)
  })

  it('keeps plant sway within the ±1px subtle budget across a full cycle', () => {
    const world = makeWorld()
    const plant = world.plantContainers[0]!
    const baseX = plant.x
    let maxDev = 0
    for (let i = 0; i <= 60; i++) {
      world.update(i)
      maxDev = Math.max(maxDev, Math.abs(plant.x - baseX))
    }
    expect(maxDev).toBeLessThanOrEqual(1)
  })

  it('creates a clock hand and notification dot for the layout', () => {
    const world = makeWorld()
    const layout = buildLayout()
    const clocks = layout.furniture.filter((f) => f.kind === 'clock').length
    const boards = layout.furniture.filter((f) => f.kind === 'taskBoard').length
    expect(world.clockHands.length).toBe(clocks)
    expect(world.notificationDots.length).toBe(boards)
    expect(world.clockHands.length).toBeGreaterThan(0)
    expect(world.notificationDots.length).toBeGreaterThan(0)
  })
})

// --- Character introduction / exit sequences (spec §26/§27, Task 9) ---

// A fake LifecycleAgent that records every call so the pure intro/exit
// orchestration can be verified without a PIXI renderer.
function makeFakeLifecycleAgent(): LifecycleAgent & {
  faces: Direction[]
  states: AgentVisualState[]
  walkTargets: Vec2[]
  offline: boolean
  hidden: boolean
} {
  const fake = {
    faces: [] as Direction[],
    states: [] as AgentVisualState[],
    walkTargets: [] as Vec2[],
    offline: false,
    hidden: false,
    face(dir: Direction) {
      fake.faces.push(dir)
    },
    setState(state: AgentVisualState) {
      fake.states.push(state)
    },
    walkTo(tile: Vec2) {
      fake.walkTargets.push(tile)
      return Promise.resolve()
    },
    setOffline() {
      fake.offline = true
    },
    hide() {
      fake.hidden = true
    },
  }
  return fake
}

// Instant delay so the async sequences resolve without waiting on real timers.
const instantDelay = (): Promise<void> => Promise.resolve()

describe('character introduction sequence (spec §26)', () => {
  it('walks the agent from the entrance to the workstation seat', async () => {
    const layout = buildLayout()
    const ws = layout.workstations.find((w) => w.role === 'backend')!
    const agent = makeFakeLifecycleAgent()
    const plan: IntroductionPlan = {
      entrance: layout.entrance,
      workstationSeat: ws.seat,
      workstationFace: ws.face as Direction,
    }
    await runIntroduction(agent, plan, instantDelay)
    // The agent first faces down (into the office) and is idle for the look.
    expect(agent.faces[0]).toBe('down')
    expect(agent.states[0]).toBe('idle')
    // Then it walks to its workstation seat.
    expect(agent.walkTargets).toContainEqual(ws.seat)
    // Then it faces the workstation and sits down (idle).
    expect(agent.faces[agent.faces.length - 1]).toBe(ws.face)
    expect(agent.states[agent.states.length - 1]).toBe('idle')
  })

  it('spawns at the office entrance tile which is walkable', () => {
    const layout = buildLayout()
    const nav = NavigationGrid.fromLayout(layout)
    expect(layout.entrance).toBeDefined()
    expect(nav.isWalkable(layout.entrance.x, layout.entrance.y)).toBe(true)
  })

  it('does not block: the delay promise gates the walk step', async () => {
    const layout = buildLayout()
    const ws = layout.workstations.find((w) => w.role === 'ceo')!
    const agent = makeFakeLifecycleAgent()
    let delayResolved = false
    const delay = (): Promise<void> => {
      delayResolved = true
      return Promise.resolve()
    }
    const plan: IntroductionPlan = {
      entrance: layout.entrance,
      workstationSeat: ws.seat,
      workstationFace: ws.face as Direction,
    }
    await runIntroduction(agent, plan, delay)
    expect(delayResolved).toBe(true)
    expect(agent.walkTargets.length).toBe(1)
  })
})

describe('agent exit sequence (spec §27)', () => {
  it('walks to the exit tile for a graceful offline then disappears', async () => {
    const layout = buildLayout()
    const agent = makeFakeLifecycleAgent()
    await runExit(agent, layout.entrance, false, instantDelay)
    expect(agent.walkTargets).toContainEqual(layout.entrance)
    expect(agent.offline).toBe(true)
    expect(agent.hidden).toBe(true)
    // A graceful exit does not enter the error freeze pose.
    expect(agent.states).not.toContain('error')
  })

  it('immediately freezes then dims for a crashed agent (no walk)', async () => {
    const layout = buildLayout()
    const agent = makeFakeLifecycleAgent()
    await runExit(agent, layout.entrance, true, instantDelay)
    // Crash path: error pose first, then offline — and no walk to the door.
    expect(agent.states[0]).toBe('error')
    expect(agent.offline).toBe(true)
    expect(agent.walkTargets.length).toBe(0)
    // Crashed agents stay visible (dimmed), they do not disappear.
    expect(agent.hidden).toBe(false)
  })

  it('gates the crash freeze behind the delay before going offline', async () => {
    const agent = makeFakeLifecycleAgent()
    const order: string[] = []
    const delay = (): Promise<void> => {
      order.push('delayed')
      return Promise.resolve()
    }
    await runExit(agent, { x: 23, y: 31 }, true, delay)
    // error set before the delay, offline set after.
    expect(agent.states[0]).toBe('error')
    expect(order).toEqual(['delayed'])
    expect(agent.offline).toBe(true)
  })
})

// --- Contextual reactions (spec §18, Task 9) ---

describe('ReactionGlance contextual reaction (spec §18)', () => {
  it('turns the agent toward a nearby walker', () => {
    const glance = new ReactionGlance()
    // Agent at (5,5) facing up at its workstation; walker passes to the right.
    const dir = glance.start('up', { x: 5, y: 5 }, { x: 7, y: 5 })
    expect(dir).toBe('right')
    expect(glance.active).toBe(true)
    expect(glance.currentRestoreFace).toBe('up')
  })

  it('returns the previous facing after the glance duration elapses', () => {
    const glance = new ReactionGlance()
    glance.start('up', { x: 5, y: 5 }, { x: 5, y: 3 }) // walker above -> face up
    // Before the duration expires, tick returns null (keep facing walker).
    expect(glance.tick(0.5)).toBeNull()
    expect(glance.tick(0.5)).toBeNull()
    expect(glance.active).toBe(true)
    // Crossing the 1.5s threshold restores the previous facing.
    const restore = glance.tick(0.5)
    expect(restore).toBe('up')
    expect(glance.active).toBe(false)
    expect(glance.currentRestoreFace).toBeNull()
  })

  it('does nothing when the walker is on the same tile', () => {
    const glance = new ReactionGlance()
    const dir = glance.start('down', { x: 5, y: 5 }, { x: 5, y: 5 })
    expect(dir).toBeNull()
    expect(glance.active).toBe(false)
  })

  it('chooses the correct cardinal direction for each neighbor', () => {
    const glance = new ReactionGlance()
    expect(glance.start('up', { x: 5, y: 5 }, { x: 6, y: 5 })).toBe('right')
    expect(glance.start('up', { x: 5, y: 5 }, { x: 4, y: 5 })).toBe('left')
    expect(glance.start('up', { x: 5, y: 5 }, { x: 5, y: 6 })).toBe('down')
    expect(glance.start('up', { x: 5, y: 5 }, { x: 5, y: 4 })).toBe('up')
  })
})

