// Per-role working sub-activity cycling (spec §16, §22).
//
// Cycles an agent through their role's `workingSequence` from the CharacterSheet
// while the agent is in a working visual state. Each step sets the current
// ActivityKind on the agent (driving the per-activity working frame set in
// AgentSprite) and dwells for a weighted duration range (§22) before advancing.
// The runner self-pauses when the agent leaves a working state, so transitions
// to communicating/idle/etc. freeze the cycle without extra wiring.

import { isWorkingVisualState } from './AgentSprite'
import type { ActivityKind, AgentRole, AgentVisualState } from '../types'

// The runner drives the agent through callbacks on this interface. It is
// deliberately decoupled from AgentEntity so tests can supply a fake.
export interface WorkAgentController {
  readonly role: AgentRole
  // Current logical visual state — the runner only advances while this is a
  // working state (spec §16).
  currentState(): AgentVisualState
  // True while the agent is interrupted by a higher-priority event (spec §19).
  // The runner pauses (does not advance) while this is true.
  isInterrupted(): boolean
  // Apply the current activity so the sprite picks the right frame set.
  setActivity(activity: ActivityKind): void
}

// Injectable RNG so durations are deterministic in tests (§22: weighted, not
// pure-random). Defaults to Math.random.
export type RandomFn = () => number

// Weighted duration ranges per activity (spec §22). Keyboard-heavy activities
// use the typing range (3.2–7.8s); monitoring/reading dwell shorter; pause and
// turn/check steps are brief held poses.
const ACTIVITY_DURATION_RANGES: Record<ActivityKind, { min: number; max: number }> = {
  coding: { min: 3.2, max: 7.8 },
  typing: { min: 3.2, max: 7.8 },
  drawing: { min: 3.2, max: 7.8 },
  testing: { min: 2, max: 6 },
  monitoring: { min: 2, max: 6 },
  reading: { min: 3.2, max: 7.8 },
  writing: { min: 3.2, max: 7.8 },
  thinking_pause: { min: 1, max: 3 },
  board_check: { min: 1, max: 3 },
  server_check: { min: 1, max: 3 },
  task_board_read: { min: 2, max: 6 },
  communicating: { min: 2, max: 6 },
}

export function activityDurationRangeFor(activity: ActivityKind): { min: number; max: number } {
  return ACTIVITY_DURATION_RANGES[activity]
}

export class WorkActivityRunner {
  private index = 0
  private elapsed = 0
  private duration = 0
  private started = false

  constructor(
    private readonly controller: WorkAgentController,
    private readonly sequence: ActivityKind[],
    private readonly rand: RandomFn = Math.random,
  ) {
    if (sequence.length === 0) {
      throw new Error('WorkActivityRunner requires a non-empty working sequence')
    }
  }

  get stepIndex(): number {
    return this.index
  }

  get currentActivity(): ActivityKind {
    return this.sequence[this.index] ?? this.sequence[0]!
  }

  // Reset to the first step (e.g. after the agent leaves a working state for a
  // real task and later returns). The next update() re-enters step 0.
  reset(): void {
    this.index = 0
    this.elapsed = 0
    this.started = false
  }

  // Called every tick. Self-pauses when the agent is not in a working state
  // or is interrupted, so transitions to communicating/idle/etc. freeze the
  // cycle (spec §16, §19).
  update(dt: number): void {
    if (this.controller.isInterrupted()) return
    if (!isWorkingVisualState(this.controller.currentState())) return
    if (!this.started) {
      this.enterStep()
      this.started = true
      return
    }
    this.elapsed += dt
    if (this.elapsed >= this.duration) this.advance()
  }

  private enterStep(): void {
    const activity = this.currentActivity
    this.elapsed = 0
    this.duration = this.sampleDuration(activity)
    this.controller.setActivity(activity)
  }

  private advance(): void {
    this.index = (this.index + 1) % this.sequence.length
    this.started = false // re-enter on next update()
  }

  // Triangular distribution biased toward the midpoint (spec §22: weighted,
  // not pure-random). Averaging two uniform samples produces a triangular
  // peak at the center, keeping the result within [min, max].
  private sampleDuration(activity: ActivityKind): number {
    const range = ACTIVITY_DURATION_RANGES[activity]
    const r = (this.rand() + this.rand()) / 2
    return range.min + (range.max - range.min) * r
  }
}
