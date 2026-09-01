import { describe, it, expect } from 'vitest'
import {
  InterruptStateMachine,
  interruptPriorityRank,
} from '../app/office/agents/AgentEntity'
import {
  IdleBehaviorRunner,
  type IdleAgentController,
} from '../app/office/agents/IdleBehaviorRunner'
import {
  WorkActivityRunner,
  type WorkAgentController,
} from '../app/office/agents/WorkActivityRunner'
import type {
  ActivityKind,
  AgentRole,
  AgentVisualState,
  Direction,
  IdleBehavior,
  InterruptPriority,
  Vec2,
} from '../app/office/types'

// ---------------------------------------------------------------------------
// InterruptStateMachine — priority comparison + return-to-task memory
// ---------------------------------------------------------------------------

describe('interruptPriorityRank (spec §19)', () => {
  it('orders LOW < MEDIUM < HIGH < CRITICAL', () => {
    expect(interruptPriorityRank('LOW')).toBeLessThan(interruptPriorityRank('MEDIUM'))
    expect(interruptPriorityRank('MEDIUM')).toBeLessThan(interruptPriorityRank('HIGH'))
    expect(interruptPriorityRank('HIGH')).toBeLessThan(interruptPriorityRank('CRITICAL'))
  })
})

describe('InterruptStateMachine.interrupt (spec §19)', () => {
  it('stores previousState and previousActivity on interrupt', () => {
    const sm = new InterruptStateMachine('working')
    sm.activity = 'coding'

    expect(sm.interrupt('MEDIUM', 'communicating')).toBe(true)
    expect(sm.previousState).toBe('working')
    expect(sm.previousActivity).toBe('coding')
    expect(sm.state).toBe('communicating')
    expect(sm.interruptedBy).toBe('MEDIUM')
  })

  it('ignores a lower-priority interrupt when a higher one is active', () => {
    const sm = new InterruptStateMachine('working')
    sm.activity = 'coding'

    // CRITICAL interrupt first.
    expect(sm.interrupt('CRITICAL', 'error')).toBe(true)
    expect(sm.interruptedBy).toBe('CRITICAL')
    expect(sm.state).toBe('error')

    // MEDIUM should be ignored (MEDIUM <= CRITICAL).
    expect(sm.interrupt('MEDIUM', 'communicating')).toBe(false)
    expect(sm.interruptedBy).toBe('CRITICAL')
    expect(sm.state).toBe('error')
  })

  it('ignores an equal-priority interrupt when one is already active', () => {
    const sm = new InterruptStateMachine('idle')

    expect(sm.interrupt('MEDIUM', 'communicating')).toBe(true)
    // A second MEDIUM should be ignored (equal priority).
    expect(sm.interrupt('MEDIUM', 'communicating')).toBe(false)
    expect(sm.interruptedBy).toBe('MEDIUM')
  })

  it('allows a higher-priority interrupt to override a lower one', () => {
    const sm = new InterruptStateMachine('working')
    sm.activity = 'coding'

    // MEDIUM first.
    expect(sm.interrupt('MEDIUM', 'communicating')).toBe(true)
    expect(sm.previousState).toBe('working')
    expect(sm.state).toBe('communicating')

    // CRITICAL overrides MEDIUM.
    expect(sm.interrupt('CRITICAL', 'error')).toBe(true)
    expect(sm.interruptedBy).toBe('CRITICAL')
    expect(sm.state).toBe('error')
    // previousState is now the MEDIUM-interrupted state.
    expect(sm.previousState).toBe('communicating')
  })

  it('accepts an interrupt when none is active', () => {
    const sm = new InterruptStateMachine('idle')
    expect(sm.interruptedBy).toBeNull()
    expect(sm.interrupt('LOW', 'idle')).toBe(true)
    expect(sm.interruptedBy).toBe('LOW')
  })
})

describe('InterruptStateMachine.resume (spec §20)', () => {
  it('restores previousState and previousActivity on resume', () => {
    const sm = new InterruptStateMachine('working')
    sm.activity = 'coding'

    sm.interrupt('HIGH', 'reviewing', 'reading')
    expect(sm.state).toBe('reviewing')
    expect(sm.activity).toBe('reading')

    sm.resume()
    expect(sm.state).toBe('working')
    expect(sm.activity).toBe('coding')
    expect(sm.interruptedBy).toBeNull()
    expect(sm.previousState).toBeNull()
    expect(sm.previousActivity).toBeNull()
  })

  it('is a no-op when not interrupted', () => {
    const sm = new InterruptStateMachine('working')
    sm.activity = 'coding'

    const stateBefore = sm.state
    const activityBefore = sm.activity
    sm.resume()
    expect(sm.state).toBe(stateBefore)
    expect(sm.activity).toBe(activityBefore)
    expect(sm.interruptedBy).toBeNull()
  })

  it('after CRITICAL overrides MEDIUM, resume restores the MEDIUM state', () => {
    const sm = new InterruptStateMachine('working')
    sm.activity = 'coding'

    sm.interrupt('MEDIUM', 'communicating')
    sm.interrupt('CRITICAL', 'error')

    // Resuming CRITICAL goes back to the MEDIUM-interrupted state.
    sm.resume()
    expect(sm.state).toBe('communicating')
    expect(sm.interruptedBy).toBeNull()
  })
})

describe('InterruptStateMachine.runtimeState', () => {
  it('exposes the full AgentRuntimeState snapshot', () => {
    const sm = new InterruptStateMachine('working')
    sm.activity = 'coding'
    sm.interrupt('HIGH', 'reviewing', 'reading')

    const rs = sm.runtimeState
    expect(rs).toEqual({
      state: 'reviewing',
      activity: 'reading',
      previousState: 'working',
      previousActivity: 'coding',
      interruptedBy: 'HIGH',
    })
  })
})

// ---------------------------------------------------------------------------
// IdleBehaviorRunner — pauses during interrupt, resumes after
// ---------------------------------------------------------------------------

// Fake controller that allows toggling the interrupted state.
function makeInterruptibleIdleController(
  role: AgentRole,
  opts: { seat?: Vec2; startTile?: Vec2; poi?: Vec2; face?: Direction } = {},
): IdleAgentController & {
  interrupted: boolean
  setInterrupted: (v: boolean) => void
  state: AgentVisualState
  setState: (s: AgentVisualState) => void
  setMoving: (v: boolean) => void
  setTile: (t: Vec2) => void
  poses: AgentVisualState[]
  walks: Vec2[]
} {
  const seat = opts.seat ?? { x: 5, y: 5 }
  const face = opts.face ?? 'up'
  const tile = { ...(opts.startTile ?? seat) }
  const poi = opts.poi ?? { x: 9, y: 6 }
  const poses: AgentVisualState[] = []
  const walks: Vec2[] = []
  let moving = false
  let interrupted = false
  let state: AgentVisualState = 'idle'

  return {
    role,
    currentState: () => state,
    isInterrupted: () => interrupted,
    isMoving: () => moving,
    currentTile: () => tile,
    setPose: (p) => poses.push(p),
    face: () => {},
    walkTo: (target) => {
      walks.push(target)
      moving = true
      return Promise.resolve()
    },
    clearMovementSuppress: () => {},
    seatTile: () => seat,
    deskTile: () => ({ x: seat.x, y: seat.y - 2 }),
    faceDirection: () => face,
    poiTileFor: () => poi,
    interrupted,
    setInterrupted(v) {
      interrupted = v
    },
    state,
    setState(s) {
      state = s
    },
    setMoving(v) {
      moving = v
    },
    setTile(t) {
      tile.x = t.x
      tile.y = t.y
    },
    poses,
    walks,
  } as IdleAgentController & {
    interrupted: boolean
    setInterrupted: (v: boolean) => void
    state: AgentVisualState
    setState: (s: AgentVisualState) => void
    setMoving: (v: boolean) => void
    setTile: (t: Vec2) => void
    poses: AgentVisualState[]
    walks: Vec2[]
  }
}

describe('IdleBehaviorRunner interrupt pausing (spec §19)', () => {
  it('does not advance while interrupted', () => {
    const ctrl = makeInterruptibleIdleController('backend', {
      startTile: { x: 16, y: 5 },
    })
    const seq: IdleBehavior[] = ['type', 'pause', 'stretch', 'type']
    const runner = new IdleBehaviorRunner(ctrl, seq, () => 0)

    // Enter step 0 ('type', 3.2s min).
    runner.update(0.016)
    expect(runner.stepIndex).toBe(0)

    // Advance partway through the step.
    for (let i = 0; i < 50; i++) runner.update(0.016) // ~0.8s
    expect(runner.stepIndex).toBe(0)

    // Interrupt — runner should pause.
    ctrl.setInterrupted(true)
    const stepBefore = runner.stepIndex
    // Try to advance past the duration — should NOT move.
    for (let i = 0; i < 300; i++) runner.update(0.016) // ~4.8s
    expect(runner.stepIndex).toBe(stepBefore) // still on step 0
  })

  it('resumes advancing after the interrupt clears', () => {
    const ctrl = makeInterruptibleIdleController('backend', {
      startTile: { x: 16, y: 5 },
    })
    const seq: IdleBehavior[] = ['type', 'pause', 'stretch', 'type']
    const runner = new IdleBehaviorRunner(ctrl, seq, () => 0)

    // Enter step 0 and advance partway.
    runner.update(0.016)
    for (let i = 0; i < 50; i++) runner.update(0.016)

    // Interrupt — runner pauses.
    ctrl.setInterrupted(true)
    for (let i = 0; i < 300; i++) runner.update(0.016)
    expect(runner.stepIndex).toBe(0)

    // Clear interrupt — runner resumes.
    ctrl.setInterrupted(false)
    // Advance past the remaining duration (3.2s total, ~0.8s already elapsed).
    for (let i = 0; i < 250; i++) runner.update(0.016) // ~4s total
    expect(runner.stepIndex).toBe(1) // advanced to 'pause'
  })
})

// ---------------------------------------------------------------------------
// WorkActivityRunner — pauses during interrupt
// ---------------------------------------------------------------------------

function makeInterruptibleWorkController(
  role: AgentRole,
): WorkAgentController & {
  interrupted: boolean
  setInterrupted: (v: boolean) => void
  state: AgentVisualState
  setState: (s: AgentVisualState) => void
  activities: ActivityKind[]
} {
  const activities: ActivityKind[] = []
  let interrupted = false
  let state: AgentVisualState = 'working'

  return {
    role,
    currentState: () => state,
    isInterrupted: () => interrupted,
    setActivity: (a) => activities.push(a),
    interrupted,
    setInterrupted(v) {
      interrupted = v
    },
    state,
    setState(s) {
      state = s
    },
    activities,
  } as WorkAgentController & {
    interrupted: boolean
    setInterrupted: (v: boolean) => void
    state: AgentVisualState
    setState: (s: AgentVisualState) => void
    activities: ActivityKind[]
  }
}

describe('WorkActivityRunner interrupt pausing (spec §19)', () => {
  it('does not advance while interrupted', () => {
    const ctrl = makeInterruptibleWorkController('backend')
    const seq: ActivityKind[] = ['coding', 'typing', 'thinking_pause', 'board_check']
    const runner = new WorkActivityRunner(ctrl, seq, () => 0)

    // Enter step 0 ('coding', 3.2s min).
    runner.update(0.016)
    expect(runner.stepIndex).toBe(0)
    expect(ctrl.activities[0]).toBe('coding')

    // Interrupt — runner should pause.
    ctrl.setInterrupted(true)
    for (let i = 0; i < 300; i++) runner.update(0.016) // ~4.8s
    expect(runner.stepIndex).toBe(0) // still on 'coding'
  })

  it('resumes after the interrupt clears', () => {
    const ctrl = makeInterruptibleWorkController('backend')
    const seq: ActivityKind[] = ['coding', 'typing', 'thinking_pause', 'board_check']
    const runner = new WorkActivityRunner(ctrl, seq, () => 0)

    runner.update(0.016)
    ctrl.setInterrupted(true)
    for (let i = 0; i < 300; i++) runner.update(0.016)
    expect(runner.stepIndex).toBe(0)

    ctrl.setInterrupted(false)
    for (let i = 0; i < 250; i++) runner.update(0.016) // ~4s
    expect(runner.stepIndex).toBe(1) // advanced to 'typing'
    expect(ctrl.activities[1]).toBe('typing')
  })
})

// ---------------------------------------------------------------------------
// Full priority-override scenario (CRITICAL overrides MEDIUM)
// ---------------------------------------------------------------------------

describe('CRITICAL overrides MEDIUM scenario (spec §19, §20)', () => {
  it('MEDIUM interrupt is ignored while CRITICAL is active', () => {
    const sm = new InterruptStateMachine('working')
    sm.activity = 'coding'

    // CRITICAL interrupt (server failure).
    expect(sm.interrupt('CRITICAL', 'error')).toBe(true)
    expect(sm.state).toBe('error')
    expect(sm.interruptedBy).toBe('CRITICAL')

    // While CRITICAL is active, a MEDIUM interrupt (message) is ignored.
    expect(sm.interrupt('MEDIUM', 'communicating')).toBe(false)
    expect(sm.state).toBe('error')
    expect(sm.interruptedBy).toBe('CRITICAL')

    // After CRITICAL resolves, resume restores the previous activity.
    sm.resume()
    expect(sm.state).toBe('working')
    expect(sm.activity).toBe('coding')
    expect(sm.interruptedBy).toBeNull()
  })

  it('HIGH interrupt overrides MEDIUM, then resume restores work', () => {
    const sm = new InterruptStateMachine('working')
    sm.activity = 'coding'

    // MEDIUM interrupt (message).
    sm.interrupt('MEDIUM', 'communicating')
    expect(sm.state).toBe('communicating')

    // HIGH interrupt (task assignment) overrides MEDIUM.
    sm.interrupt('HIGH', 'reviewing', 'reading')
    expect(sm.interruptedBy).toBe('HIGH')
    expect(sm.state).toBe('reviewing')

    // Resume restores the MEDIUM-interrupted state.
    sm.resume()
    expect(sm.state).toBe('communicating')
    expect(sm.interruptedBy).toBeNull()

    // Resume again is a no-op (not interrupted).
    const stateBefore = sm.state
    sm.resume()
    expect(sm.state).toBe(stateBefore)
  })
})
