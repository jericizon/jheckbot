// Per-role idle behavior trees (spec §8, §22, §23).
//
// Cycles an agent through their role's `idleSequence` from the CharacterSheet.
// Each step has a weighted duration range (§22) and triggers a visual/behavioral
// change on the agent via the `IdleAgentController` interface. The runner only
// advances while the agent is idle/waiting and not moving; movement steps issue
// `walkTo` calls and pause themselves until the agent arrives. All movement is
// to specific POIs (§23 — no random wandering).

import type { AgentRole, AgentVisualState, Direction, IdleBehavior, Vec2 } from '../types'

// The runner drives the agent through callbacks on this interface. It is
// deliberately decoupled from AgentEntity so tests can supply a fake.
export interface IdleAgentController {
  readonly role: AgentRole
  // Current logical state (idle/waiting/walking/...).
  currentState(): AgentVisualState
  // True while the agent is mid-path.
  isMoving(): boolean
  // Current tile the agent occupies.
  currentTile(): Vec2
  // Set a visual pose without changing the agent's logical state (which stays
  // idle/waiting so the runner keeps advancing). Maps to the sprite's frame set.
  setPose(pose: AgentVisualState): void
  face(dir: Direction): void
  walkTo(target: Vec2): Promise<void>
  // The agent's workstation seat/desk/face for return + desk-facing steps.
  seatTile(): Vec2 | undefined
  deskTile(): Vec2 | undefined
  faceDirection(): Direction | undefined
  // Resolve the POI tile for a movement step (task board, server rack, etc.).
  poiTileFor(step: IdleBehavior): Vec2 | undefined
}

// Injectable RNG so durations are deterministic in tests (§22: weighted, not
// pure-random). Defaults to Math.random.
export type RandomFn = () => number

// Weighted duration ranges per step kind (spec §22). Typing 3.2–7.8s, idle
// pause 2–8s, look-around 1–3s; other steps scaled appropriately.
const DURATION_RANGES: Record<IdleBehavior, { min: number; max: number }> = {
  check_task_board: { min: 2, max: 6 },
  look_around: { min: 1, max: 3 },
  walk: { min: 1, max: 3 },
  observe: { min: 1, max: 3 },
  type: { min: 3.2, max: 7.8 },
  pause: { min: 2, max: 8 },
  stretch: { min: 1, max: 2.5 },
  stand: { min: 1, max: 3 },
  inspect_board: { min: 1, max: 3 },
  sit: { min: 1, max: 2 },
  look_at_monitor: { min: 2, max: 6 },
  inspect: { min: 1, max: 3 },
  return: { min: 0.5, max: 1 },
  check_monitor: { min: 2, max: 6 },
  walk_to_server: { min: 1, max: 3 },
  read: { min: 3.2, max: 7.8 },
  write: { min: 3.2, max: 7.8 },
  think: { min: 2, max: 8 },
}

// Steps that move the agent to a POI (or back to seat) before dwelling.
const MOVEMENT_STEPS: ReadonlySet<IdleBehavior> = new Set([
  'walk',
  'inspect_board',
  'walk_to_server',
  'inspect',
  'return',
  'sit',
])

// Steps that cycle facing directions to simulate looking around (§8).
const LOOK_STEPS: ReadonlySet<IdleBehavior> = new Set(['look_around', 'observe'])
const LOOK_DIRECTIONS: readonly Direction[] = ['down', 'left', 'right', 'down']

type Phase =
  | 'depart' // outbound walk issued; waiting for arrival
  | 'dwell' // at POI (or seated), counting down dwell duration
  | 'return' // return walk to seat issued; waiting for arrival
  | 'active' // stationary step, counting down pose duration

export function durationRangeFor(step: IdleBehavior): { min: number; max: number } {
  return DURATION_RANGES[step]
}

export class IdleBehaviorRunner {
  private index = 0
  private phase: Phase = 'active'
  private elapsed = 0
  private duration = 0
  private lookSegment = 0
  private started = false

  constructor(
    private readonly controller: IdleAgentController,
    private readonly sequence: IdleBehavior[],
    private readonly rand: RandomFn = Math.random,
  ) {
    if (sequence.length === 0) {
      throw new Error('IdleBehaviorRunner requires a non-empty idle sequence')
    }
  }

  get stepIndex(): number {
    return this.index
  }

  get currentStep(): IdleBehavior {
    return this.sequence[this.index] ?? this.sequence[0]!
  }

  get currentPhase(): Phase {
    return this.phase
  }

  // Reset to the first step (e.g. after the agent leaves idle for a real task
  // and later returns). The next update() re-enters step 0.
  reset(): void {
    this.index = 0
    this.phase = 'active'
    this.elapsed = 0
    this.lookSegment = 0
    this.started = false
  }

  // Called every tick while the agent is idle/waiting and not moving.
  update(dt: number): void {
    if (!this.started) {
      this.enterStep()
      this.started = true
      // enterStep may have issued a walk (movement step) — if so, the agent is
      // now moving and we must not process further this tick.
      if (this.controller.isMoving()) return
      // enterStep may have advanced immediately (already at target for 'return').
      if (!this.started) return
    }

    const step = this.currentStep
    if (MOVEMENT_STEPS.has(step)) {
      this.updateMovement(dt, step)
    } else {
      this.updateStationary(dt, step)
    }
  }

  // --- Movement steps ---

  private updateMovement(dt: number, step: IdleBehavior): void {
    switch (this.phase) {
      case 'depart':
        // We only reach here once the outbound walk has completed (the agent
        // was moving, so update() wasn't called until arrival).
        if (!this.controller.isMoving()) {
          if (step === 'return') {
            this.advance()
          } else {
            this.phase = 'dwell'
            this.elapsed = 0
            this.applyDwellPose(step)
          }
        }
        break
      case 'dwell':
        this.elapsed += dt
        if (this.elapsed >= this.duration) {
          if (step === 'sit') {
            // 'sit' stays at the seat; no return walk needed.
            this.advance()
          } else {
            const seat = this.controller.seatTile()
            if (seat && !sameTile(seat, this.controller.currentTile())) {
              this.phase = 'return'
              void this.controller.walkTo(seat)
            } else {
              this.advance()
            }
          }
        }
        break
      case 'return':
        if (!this.controller.isMoving()) {
          this.advance()
        }
        break
      default:
        this.enterStep()
    }
  }

  // --- Stationary steps ---

  private updateStationary(dt: number, step: IdleBehavior): void {
    this.elapsed += dt
    if (LOOK_STEPS.has(step)) {
      const segmentLen = this.duration / LOOK_DIRECTIONS.length
      const seg = Math.min(
        Math.floor(this.elapsed / segmentLen),
        LOOK_DIRECTIONS.length - 1,
      )
      if (seg !== this.lookSegment) {
        this.lookSegment = seg
        this.controller.face(LOOK_DIRECTIONS[seg]!)
      }
    }
    if (this.elapsed >= this.duration) {
      this.advance()
    }
  }

  // --- Step entry / advance ---

  private enterStep(): void {
    const step = this.currentStep
    this.elapsed = 0
    this.lookSegment = 0
    this.duration = this.sampleDuration(step)

    if (MOVEMENT_STEPS.has(step)) {
      const target = this.movementTarget(step)
      const here = this.controller.currentTile()
      if (target && !sameTile(target, here)) {
        this.phase = 'depart'
        void this.controller.walkTo(target)
      } else if (step === 'return') {
        // Already at the seat — step is complete.
        this.advance()
      } else {
        this.phase = 'dwell'
        this.applyDwellPose(step)
      }
    } else {
      this.phase = 'active'
      this.applyStationaryPose(step)
    }
  }

  private advance(): void {
    this.index = (this.index + 1) % this.sequence.length
    this.started = false // re-enter on next update()
  }

  private movementTarget(step: IdleBehavior): Vec2 | undefined {
    if (step === 'return' || step === 'sit') return this.controller.seatTile()
    return this.controller.poiTileFor(step)
  }

  // --- Poses ---

  private applyDwellPose(step: IdleBehavior): void {
    if (step === 'sit') {
      const face = this.controller.faceDirection()
      if (face) this.controller.face(face)
      this.controller.setPose('working')
    } else {
      // Inspecting a board / server rack — seated/reviewing pose.
      this.controller.setPose('reviewing')
    }
  }

  private applyStationaryPose(step: IdleBehavior): void {
    switch (step) {
      case 'type':
      case 'write':
        this.faceDesk()
        this.controller.setPose('working')
        break
      case 'read':
      case 'check_task_board':
      case 'look_at_monitor':
      case 'check_monitor':
        this.faceDesk()
        this.controller.setPose('reading')
        break
      case 'pause':
      case 'think':
        this.controller.setPose('thinking')
        break
      case 'stretch':
        // Lean-back is a brief idle variant; sprite offset could be applied
        // here in a future task. For now the idle pose conveys the rest.
        this.controller.setPose('idle')
        break
      case 'stand':
        this.controller.setPose('idle')
        break
      case 'look_around':
      case 'observe':
        this.controller.setPose('idle')
        this.controller.face('down')
        break
      default:
        this.controller.setPose('idle')
    }
  }

  private faceDesk(): void {
    const face = this.controller.faceDirection()
    if (face) this.controller.face(face)
  }

  // Triangular distribution biased toward the midpoint (spec §22: weighted,
  // not pure-random). Averaging two uniform samples produces a triangular
  // peak at the center, keeping the result within [min, max].
  private sampleDuration(step: IdleBehavior): number {
    const range = DURATION_RANGES[step]
    const r = (this.rand() + this.rand()) / 2
    return range.min + (range.max - range.min) * r
  }
}

function sameTile(a: Vec2, b: Vec2): boolean {
  return a.x === b.x && a.y === b.y
}
