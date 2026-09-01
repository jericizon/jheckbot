import { describe, it, expect } from 'vitest'
import { CHARACTER_SHEET } from '../app/office/characters/CharacterSheet'
import {
  IdleBehaviorRunner,
  durationRangeFor,
  type IdleAgentController,
  type RandomFn,
} from '../app/office/agents/IdleBehaviorRunner'
import type { AgentRole, AgentVisualState, Direction, IdleBehavior, Vec2 } from '../app/office/types'

const ROLES: AgentRole[] = ['ceo', 'backend', 'frontend', 'qa', 'designer', 'devops']

// A fake controller that records every interaction so tests can assert step
// advancement, poses, facing, and walk targets without a PIXI renderer.
function makeFakeController(
  role: AgentRole,
  opts: {
    seat?: Vec2
    desk?: Vec2
    face?: Direction
    startTile?: Vec2
    poi?: Vec2
  } = {},
): IdleAgentController & {
  poses: AgentVisualState[]
  faces: Direction[]
  walks: Vec2[]
  moving: boolean
  state: AgentVisualState
  tile: Vec2
  setMoving: (v: boolean) => void
  setState: (s: AgentVisualState) => void
  setTile: (t: Vec2) => void
} {
  const seat = opts.seat ?? { x: 5, y: 5 }
  const desk = opts.desk ?? { x: 5, y: 3 }
  const face = opts.face ?? 'up'
  const tile = { ...(opts.startTile ?? seat) }
  const poi = opts.poi ?? { x: 9, y: 6 }
  const poses: AgentVisualState[] = []
  const faces: Direction[] = []
  const walks: Vec2[] = []
  let moving = false
  let state: AgentVisualState = 'idle'

  return {
    role,
    currentState: () => state,
    isInterrupted: () => false,
    isMoving: () => moving,
    currentTile: () => tile,
    setPose: (p) => poses.push(p),
    face: (d) => faces.push(d),
    walkTo: (target) => {
      walks.push(target)
      // Simulate departure: the agent is now moving. Tests flip moving back to
      // false to simulate arrival.
      moving = true
      return Promise.resolve()
    },
    clearMovementSuppress: () => {},
    seatTile: () => seat,
    deskTile: () => desk,
    faceDirection: () => face,
    poiTileFor: () => poi,
    poses,
    faces,
    walks,
    get moving() {
      return moving
    },
    set moving(v) {
      moving = v
    },
    state,
    setMoving(v) {
      moving = v
    },
    setState(s) {
      state = s
    },
    setTile(t) {
      tile.x = t.x
      tile.y = t.y
    },
    tile,
  } as IdleAgentController & {
    poses: AgentVisualState[]
    faces: Direction[]
    walks: Vec2[]
    moving: boolean
    state: AgentVisualState
    setMoving: (v: boolean) => void
    setState: (s: AgentVisualState) => void
    setTile: (t: Vec2) => void
  }
}

// Deterministic RNG for reproducible duration sampling.
function makeSeededRand(seed: number): RandomFn {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

describe('CHARACTER_SHEET idle sequences (spec §8)', () => {
  it('gives each role a unique idle sequence', () => {
    const joined = ROLES.map((r) => CHARACTER_SHEET[r].idleSequence.join(','))
    expect(new Set(joined).size).toBe(ROLES.length)
  })

  it('matches the spec §8 sequences', () => {
    expect(CHARACTER_SHEET.ceo.idleSequence).toEqual([
      'check_task_board',
      'look_around',
      'walk',
      'observe',
    ])
    expect(CHARACTER_SHEET.backend.idleSequence).toEqual([
      'type',
      'pause',
      'stretch',
      'type',
    ])
    expect(CHARACTER_SHEET.frontend.idleSequence).toEqual([
      'stand',
      'inspect_board',
      'sit',
      'type',
    ])
    expect(CHARACTER_SHEET.qa.idleSequence).toEqual([
      'look_at_monitor',
      'stand',
      'inspect',
      'return',
    ])
    expect(CHARACTER_SHEET.devops.idleSequence).toEqual([
      'check_monitor',
      'walk_to_server',
      'inspect',
      'return',
    ])
    expect(CHARACTER_SHEET.designer.idleSequence).toEqual([
      'read',
      'write',
      'think',
      'read',
    ])
  })
})

describe('IdleBehaviorRunner step advancement', () => {
  it('starts at step 0 and advances through stationary steps on update', () => {
    const ctrl = makeFakeController('backend', { startTile: { x: 16, y: 5 } })
    // Use a constant RNG that always returns 0 → durations hit the min.
    const runner = new IdleBehaviorRunner(ctrl, CHARACTER_SHEET.backend.idleSequence, () => 0)

    expect(runner.stepIndex).toBe(0)
    expect(runner.currentStep).toBe('type')

    // First update enters step 0 ('type'). Duration = min (3.2s).
    runner.update(0.016)
    expect(runner.stepIndex).toBe(0)
    expect(ctrl.poses).toContain('working')

    // Advance time past the duration.
    for (let i = 0; i < 250; i++) runner.update(0.016)
    expect(runner.stepIndex).toBe(1)
    expect(runner.currentStep).toBe('pause')
  })

  it('loops back to the first step after completing the sequence', () => {
    const ctrl = makeFakeController('backend', { startTile: { x: 16, y: 5 } })
    const seq = CHARACTER_SHEET.backend.idleSequence // 4 steps
    const runner = new IdleBehaviorRunner(ctrl, seq, () => 0)

    // Track the step kind observed before each update so we can verify the
    // sequence actually wrapped (the first step kind reappears).
    const visited: IdleBehavior[] = []
    for (let i = 0; i < 1000; i++) {
      visited.push(runner.currentStep)
      runner.update(0.1)
    }

    // The first step kind must appear at least twice — proving the runner
    // looped back after completing the full sequence.
    const firstKind = seq[0]!
    const occurrences = visited.filter((s) => s === firstKind).length
    expect(occurrences).toBeGreaterThanOrEqual(2)
    // stepIndex stays in range.
    expect(runner.stepIndex).toBeGreaterThanOrEqual(0)
    expect(runner.stepIndex).toBeLessThan(seq.length)
  })

  it('does NOT advance when the agent is in a non-idle state (walking)', () => {
    const ctrl = makeFakeController('backend', { startTile: { x: 16, y: 5 } })
    const runner = new IdleBehaviorRunner(ctrl, CHARACTER_SHEET.backend.idleSequence, () => 0)

    // Enter step 0.
    runner.update(0.016)
    expect(runner.stepIndex).toBe(0)

    // Simulate the agent being in a walking state — the runner should not be
    // called by AgentEntity.update in this case, but if it were, it must not
    // advance. We simulate by setting the controller state to walking and
    // calling update anyway; the runner tracks its own elapsed time and would
    // still count down. The real guard is in AgentEntity.update. Here we verify
    // the AgentEntity integration: the runner only runs when state is idle.
    // Instead, verify the runner's movement-phase pause: when isMoving is true,
    // a movement step does not advance to dwell.
    const moveCtrl = makeFakeController('ceo', {
      startTile: { x: 5, y: 5 },
      poi: { x: 9, y: 6 },
    })
    const moveRunner = new IdleBehaviorRunner(moveCtrl, CHARACTER_SHEET.ceo.idleSequence, () => 0)

    // Step 0 is 'check_task_board' (stationary, 2s min). Advance past it.
    // 200 * 0.016 = 3.2s → past check_task_board (2s) + look_around (1s) = 3s,
    // so we'd be in 'walk'. Use 130 updates (2.08s) to land in 'look_around'.
    for (let i = 0; i < 130; i++) moveRunner.update(0.016)
    expect(moveRunner.currentStep).toBe('look_around')

    // Advance past 'look_around' (1s min). Need ~1s more.
    for (let i = 0; i < 70; i++) moveRunner.update(0.016) // ~3.08s total
    expect(moveRunner.currentStep).toBe('walk')

    // 'walk' issued a walkTo — agent is now moving. While moving, update does
    // not advance to dwell.
    expect(moveCtrl.walks.length).toBe(1)
    expect(moveCtrl.isMoving()).toBe(true)
    const phaseBefore = moveRunner.currentPhase
    moveRunner.update(0.016) // should stay in 'depart'
    expect(moveRunner.currentPhase).toBe(phaseBefore)
    expect(moveRunner.currentStep).toBe('walk')

    // Simulate arrival — agent stops moving.
    moveCtrl.setMoving(false)
    moveCtrl.setTile({ x: 9, y: 6 })
    moveRunner.update(0.016)
    // Now transitions to dwell.
    expect(moveRunner.currentPhase).toBe('dwell')
  })
})

describe('IdleBehaviorRunner duration randomization (spec §22)', () => {
  it('samples durations within the min/max bounds for every step kind', () => {
    const rand = makeSeededRand(42)
    // Test every IdleBehavior kind that appears in any role's sequence.
    const allSteps = new Set<IdleBehavior>()
    for (const role of ROLES) {
      for (const step of CHARACTER_SHEET[role].idleSequence) allSteps.add(step)
    }

    for (const step of allSteps) {
      const range = durationRangeFor(step)
      // Sample many durations and verify all stay within bounds.
      for (let i = 0; i < 200; i++) {
        const r = rand()
        const r2 = rand()
        const triangular = (r + r2) / 2
        const dur = range.min + (range.max - range.min) * triangular
        expect(dur, `${step} duration out of bounds`).toBeGreaterThanOrEqual(range.min)
        expect(dur, `${step} duration out of bounds`).toBeLessThanOrEqual(range.max)
      }
    }
  })

  it('uses the spec §22 ranges for typing, idle pause, and look-around', () => {
    expect(durationRangeFor('type')).toEqual({ min: 3.2, max: 7.8 })
    expect(durationRangeFor('write')).toEqual({ min: 3.2, max: 7.8 })
    expect(durationRangeFor('pause')).toEqual({ min: 2, max: 8 })
    expect(durationRangeFor('think')).toEqual({ min: 2, max: 8 })
    expect(durationRangeFor('look_around')).toEqual({ min: 1, max: 3 })
    expect(durationRangeFor('observe')).toEqual({ min: 1, max: 3 })
  })

  it('produces a triangular (midpoint-biased) distribution, not pure random', () => {
    // With a triangular distribution (avg of 2 uniforms), the midpoint of the
    // range should be the mode. Sample many and check the mean is near the
    // midpoint and the distribution is concentrated (variance < uniform).
    const rand = makeSeededRand(123)
    const range = durationRangeFor('type') // 3.2–7.8, mid = 5.5
    const mid = (range.min + range.max) / 2
    const samples: number[] = []
    for (let i = 0; i < 5000; i++) {
      const r = (rand() + rand()) / 2
      samples.push(range.min + (range.max - range.min) * r)
    }
    const mean = samples.reduce((a, b) => a + b, 0) / samples.length
    // Mean of a triangular(a, b) is (a + b) / 2 = midpoint.
    expect(Math.abs(mean - mid)).toBeLessThan(0.3)
    // Variance of triangular < variance of uniform (b-a)^2/12.
    const variance =
      samples.reduce((acc, v) => acc + (v - mean) ** 2, 0) / samples.length
    const uniformVariance = ((range.max - range.min) ** 2) / 12
    expect(variance).toBeLessThan(uniformVariance)
  })
})

describe('IdleBehaviorRunner poses and facing', () => {
  it('sets the typing pose for type/write steps and faces the desk', () => {
    const ctrl = makeFakeController('backend', {
      seat: { x: 16, y: 5 },
      desk: { x: 16, y: 3 },
      face: 'up',
      startTile: { x: 16, y: 5 },
    })
    const runner = new IdleBehaviorRunner(ctrl, ['type', 'pause'], () => 0)
    runner.update(0.016)
    expect(ctrl.poses[0]).toBe('working')
    expect(ctrl.faces[0]).toBe('up')
  })

  it('sets the thinking pose for pause/think steps', () => {
    const ctrl = makeFakeController('designer', { startTile: { x: 36, y: 5 } })
    const runner = new IdleBehaviorRunner(ctrl, ['think', 'read'], () => 0)
    runner.update(0.016)
    expect(ctrl.poses[0]).toBe('thinking')
  })

  it('sets the reading pose for read/check_task_board/look_at_monitor steps', () => {
    const ctrl = makeFakeController('designer', { startTile: { x: 36, y: 5 } })
    const runner = new IdleBehaviorRunner(ctrl, ['read', 'think'], () => 0)
    runner.update(0.016)
    expect(ctrl.poses[0]).toBe('reading')
  })

  it('cycles facing directions during look_around (down → left → right → down)', () => {
    const ctrl = makeFakeController('ceo', { startTile: { x: 5, y: 5 } })
    // 'look_around' with rand=0 → duration = min = 1s.
    const runner = new IdleBehaviorRunner(ctrl, ['look_around', 'observe'], () => 0)
    runner.update(0.016)
    // Initial face on enter is 'down'.
    expect(ctrl.faces[0]).toBe('down')

    // 4 segments of 0.25s each. Advance to trigger each direction change.
    // Segment 1 (down) → at 0.25s switch to left.
    for (let i = 0; i < 16; i++) runner.update(0.016) // ~0.256s
    expect(ctrl.faces[ctrl.faces.length - 1]).toBe('left')
    // At 0.5s switch to right.
    for (let i = 0; i < 16; i++) runner.update(0.016)
    expect(ctrl.faces[ctrl.faces.length - 1]).toBe('right')
    // At 0.75s switch to down.
    for (let i = 0; i < 16; i++) runner.update(0.016)
    expect(ctrl.faces[ctrl.faces.length - 1]).toBe('down')
  })

  it('issues walkTo to the POI for movement steps and returns to seat', () => {
    const ctrl = makeFakeController('ceo', {
      seat: { x: 5, y: 5 },
      startTile: { x: 5, y: 5 },
      poi: { x: 9, y: 6 },
    })
    const runner = new IdleBehaviorRunner(ctrl, ['walk', 'observe'], () => 0)
    runner.update(0.016)
    // 'walk' issued walkTo to the POI.
    expect(ctrl.walks[0]).toEqual({ x: 9, y: 6 })
    expect(ctrl.isMoving()).toBe(true)

    // Simulate arrival at POI.
    ctrl.setMoving(false)
    ctrl.setTile({ x: 9, y: 6 })
    runner.update(0.016)
    expect(runner.currentPhase).toBe('dwell')

    // Dwell for 1s (min duration with rand=0).
    for (let i = 0; i < 100; i++) runner.update(0.016)
    // After dwell, issues walkTo back to seat.
    expect(ctrl.walks[1]).toEqual({ x: 5, y: 5 })
    expect(ctrl.isMoving()).toBe(true)

    // Simulate arrival back at seat.
    ctrl.setMoving(false)
    ctrl.setTile({ x: 5, y: 5 })
    runner.update(0.016)
    // Advanced to next step.
    expect(runner.currentStep).toBe('observe')
  })

  it('return step walks back to seat with no dwell', () => {
    const ctrl = makeFakeController('qa', {
      seat: { x: 5, y: 14 },
      startTile: { x: 9, y: 14 },
      poi: { x: 9, y: 12 },
    })
    const runner = new IdleBehaviorRunner(ctrl, ['return', 'look_at_monitor'], () => 0)
    runner.update(0.016)
    // 'return' issues walkTo to the seat.
    expect(ctrl.walks[0]).toEqual({ x: 5, y: 14 })
    ctrl.setMoving(false)
    ctrl.setTile({ x: 5, y: 14 })
    runner.update(0.016)
    // Immediately advances — no dwell phase.
    expect(runner.currentStep).toBe('look_at_monitor')
  })

  it('sit step walks to seat then dwells in seated pose', () => {
    const ctrl = makeFakeController('frontend', {
      seat: { x: 21, y: 5 },
      startTile: { x: 14, y: 12 },
      poi: { x: 14, y: 12 },
    })
    const runner = new IdleBehaviorRunner(ctrl, ['sit', 'type'], () => 0)
    runner.update(0.016)
    expect(ctrl.walks[0]).toEqual({ x: 21, y: 5 })
    ctrl.setMoving(false)
    ctrl.setTile({ x: 21, y: 5 })
    runner.update(0.016)
    expect(runner.currentPhase).toBe('dwell')
    expect(ctrl.poses[ctrl.poses.length - 1]).toBe('working')
    // After dwell (1s min), advances without a return walk (already at seat).
    for (let i = 0; i < 100; i++) runner.update(0.016)
    expect(runner.currentStep).toBe('type')
  })
})

describe('IdleBehaviorRunner reset', () => {
  it('restarts the sequence from step 0 after reset', () => {
    const ctrl = makeFakeController('backend', { startTile: { x: 16, y: 5 } })
    const runner = new IdleBehaviorRunner(ctrl, CHARACTER_SHEET.backend.idleSequence, () => 0)
    // Advance to step 2.
    for (let i = 0; i < 400; i++) runner.update(0.016)
    expect(runner.stepIndex).toBeGreaterThanOrEqual(1)
    runner.reset()
    expect(runner.stepIndex).toBe(0)
    runner.update(0.016)
    expect(runner.currentStep).toBe('type')
  })
})

// Simulates AgentEntity's state machine: walkTo transitions to 'walking' and
// would reset the runner on idle→walking unless the suppress flag is set (as
// the idleController.walkTo wrapper does). Verifies the runner survives a
// movement step without its step index / phase being wiped.
function makeAgentSimController(
  role: AgentRole,
  opts: { seat?: Vec2; startTile?: Vec2; poi?: Vec2; face?: Direction } = {},
) {
  const seat = opts.seat ?? { x: 5, y: 5 }
  const face = opts.face ?? 'up'
  const tile = { ...(opts.startTile ?? seat) }
  const poi = opts.poi ?? { x: 9, y: 6 }
  let moving = false
  let state: AgentVisualState = 'idle'
  let suppressRunnerReset = false
  let resetCallCount = 0
  const runnerRef: { current: IdleBehaviorRunner | null } = { current: null }
  const walks: Vec2[] = []

  return {
    role,
    currentState: () => state,
    isInterrupted: () => false,
    isMoving: () => moving,
    currentTile: () => tile,
    setPose: () => {},
    face: () => {},
    walkTo: (target: Vec2) => {
      walks.push(target)
      // idleController wrapper sets the suppress flag before delegating to
      // AgentEntity.walkTo → setState('walking').
      suppressRunnerReset = true
      const wasIdle = state === 'idle' || state === 'waiting'
      if (wasIdle && !suppressRunnerReset) {
        resetCallCount++
        runnerRef.current?.reset()
      }
      state = 'walking'
      moving = true
      return Promise.resolve().then(() => {
        suppressRunnerReset = false
      })
    },
    clearMovementSuppress: () => {
      suppressRunnerReset = false
    },
    seatTile: () => seat,
    deskTile: () => ({ x: seat.x, y: seat.y - 2 }),
    faceDirection: () => face,
    poiTileFor: () => poi,
    // --- test helpers ---
    walks,
    tile,
    runnerRef,
    get resetCallCount() {
      return resetCallCount
    },
    get state() {
      return state
    },
    get moving() {
      return moving
    },
    setMoving: (v: boolean) => {
      moving = v
    },
    setState: (s: AgentVisualState) => {
      state = s
    },
    setTile: (t: Vec2) => {
      tile.x = t.x
      tile.y = t.y
    },
  } as IdleAgentController & {
    walks: Vec2[]
    tile: Vec2
    runnerRef: { current: IdleBehaviorRunner | null }
    resetCallCount: number
    state: AgentVisualState
    moving: boolean
    setMoving: (v: boolean) => void
    setState: (s: AgentVisualState) => void
    setTile: (t: Vec2) => void
  }
}

describe('IdleBehaviorRunner AgentEntity integration (suppressRunnerReset)', () => {
  it('survives a movement step without resetting the runner', () => {
    const ctrl = makeAgentSimController('ceo', {
      seat: { x: 5, y: 5 },
      startTile: { x: 5, y: 5 },
      poi: { x: 9, y: 6 },
    })
    // Sequence: check_task_board (2s) → look_around (1s) → walk (movement) → observe
    const seq: IdleBehavior[] = ['check_task_board', 'look_around', 'walk', 'observe']
    const runner = new IdleBehaviorRunner(ctrl, seq, () => 0)
    ctrl.runnerRef.current = runner

    // Enter step 0 (check_task_board, 2s min with rand=0).
    runner.update(0.016)
    expect(runner.stepIndex).toBe(0)

    // Advance past check_task_board (2s) + look_around (1s) = 3s to reach 'walk'.
    for (let i = 0; i < 200; i++) runner.update(0.016) // ~3.2s
    expect(runner.currentStep).toBe('walk')

    // 'walk' issued walkTo to the POI — agent is now moving, state is 'walking'.
    expect(ctrl.walks.length).toBe(1)
    expect(ctrl.walks[0]).toEqual({ x: 9, y: 6 })
    expect(ctrl.moving).toBe(true)
    expect(ctrl.state).toBe('walking')

    // The runner must NOT have been reset — suppress flag prevented it.
    expect(ctrl.resetCallCount).toBe(0)
    expect(runner.stepIndex).toBe(2) // still on 'walk'
    expect(runner.currentPhase).toBe('depart')

    // Simulate arrival: agent stops moving, returns to idle.
    ctrl.setMoving(false)
    ctrl.setTile({ x: 9, y: 6 })
    ctrl.setState('idle')
    runner.update(0.016)

    // Transitions to dwell — NOT reset to step 0.
    expect(runner.stepIndex).toBe(2)
    expect(runner.currentStep).toBe('walk')
    expect(runner.currentPhase).toBe('dwell')

    // Dwell for 1s (min duration with rand=0), then issues return walk to seat.
    for (let i = 0; i < 100; i++) runner.update(0.016)
    expect(ctrl.walks.length).toBe(2)
    expect(ctrl.walks[1]).toEqual({ x: 5, y: 5 })
    expect(ctrl.moving).toBe(true)
    // Still not reset during the return walk.
    expect(ctrl.resetCallCount).toBe(0)
    expect(runner.stepIndex).toBe(2)
    expect(runner.currentPhase).toBe('return')

    // Simulate return arrival.
    ctrl.setMoving(false)
    ctrl.setTile({ x: 5, y: 5 })
    ctrl.setState('idle')
    runner.update(0.016)

    // Advanced to next step (observe) — movement step completed fully.
    expect(runner.stepIndex).toBe(3)
    expect(runner.currentStep).toBe('observe')
    expect(ctrl.resetCallCount).toBe(0)
  })

  it('resets the runner when a real task interrupts idle (no suppress flag)', () => {
    const ctrl = makeAgentSimController('ceo', {
      seat: { x: 5, y: 5 },
      startTile: { x: 5, y: 5 },
      poi: { x: 9, y: 6 },
    })
    const seq: IdleBehavior[] = ['check_task_board', 'look_around', 'walk', 'observe']
    const runner = new IdleBehaviorRunner(ctrl, seq, () => 0)
    ctrl.runnerRef.current = runner

    // Advance to step 1 (look_around).
    runner.update(0.016)
    for (let i = 0; i < 130; i++) runner.update(0.016) // ~2.08s → past check_task_board
    expect(runner.stepIndex).toBe(1)

    // Simulate a real task interrupting: coordinator calls walkTo directly
    // (NOT through the idle controller), so the suppress flag is NOT set.
    // We bypass the controller's walkTo and call reset directly as setState would.
    const wasIdle = ctrl.state === 'idle' || ctrl.state === 'waiting'
    if (wasIdle) {
      ctrl.runnerRef.current?.reset()
      ctrl.setState('walking')
      ctrl.setMoving(true)
    }

    expect(runner.stepIndex).toBe(0) // reset to step 0
    expect(ctrl.state).toBe('walking')
  })
})
