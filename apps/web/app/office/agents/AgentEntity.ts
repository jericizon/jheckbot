import { Container, type Renderer } from 'pixi.js'
import type { ActivityKind, AgentDescriptor, AgentRole, AgentRuntimeState, AgentVisualState, Direction, IdleBehavior, InterruptPriority, Vec2 } from '../types'
import { type FurnitureKind, type OfficeLayout, type Workstation, workstationForRole } from '../world/layout'
import { NavigationGrid } from '../world/NavigationGrid'
import { AgentSprite, isWorkingVisualState } from './AgentSprite'
import { AgentMovement, tileToPxCenter } from './AgentMovement'
import { CHARACTER_SHEET } from '../characters/CharacterSheet'
import { IdleBehaviorRunner, type IdleAgentController } from './IdleBehaviorRunner'
import { WorkActivityRunner, type WorkAgentController } from './WorkActivityRunner'

// Numeric rank for priority comparison (spec §19: LOW < MEDIUM < HIGH < CRITICAL).
export function interruptPriorityRank(priority: InterruptPriority): number {
  switch (priority) {
    case 'LOW':
      return 0
    case 'MEDIUM':
      return 1
    case 'HIGH':
      return 2
    case 'CRITICAL':
      return 3
  }
}

// Pure interrupt state machine — extracted from AgentEntity so the priority
// comparison and return-to-task memory (spec §19, §20) are testable without a
// PIXI renderer. AgentEntity composes this and delegates interrupt()/resume().
export class InterruptStateMachine {
  state: AgentVisualState
  activity: ActivityKind | null = null
  previousState: AgentVisualState | null = null
  previousActivity: ActivityKind | null = null
  interruptedBy: InterruptPriority | null = null

  constructor(initialState: AgentVisualState = 'idle') {
    this.state = initialState
  }

  get isInterrupted(): boolean {
    return this.interruptedBy !== null
  }

  get runtimeState(): AgentRuntimeState {
    return {
      state: this.state,
      activity: this.activity,
      previousState: this.previousState,
      previousActivity: this.previousActivity,
      interruptedBy: this.interruptedBy,
    }
  }

  // Returns true if the interrupt was accepted (priority exceeded the current
  // one or no interrupt was active). Lower-or-equal priorities are ignored.
  interrupt(priority: InterruptPriority, newState: AgentVisualState, newActivity?: ActivityKind): boolean {
    if (this.interruptedBy !== null && interruptPriorityRank(priority) <= interruptPriorityRank(this.interruptedBy)) {
      return false
    }
    this.previousState = this.state
    this.previousActivity = this.activity
    this.interruptedBy = priority
    this.state = newState
    this.activity = newActivity ?? null
    return true
  }

  // Restore the previous state/activity. No-op when not interrupted (spec §20).
  resume(): void {
    if (this.interruptedBy === null) return
    this.state = this.previousState ?? this.state
    this.activity = this.previousActivity
    this.interruptedBy = null
    this.previousState = null
    this.previousActivity = null
  }
}

// Pure contextual-reaction glance state (spec §18) — extracted from
// AgentEntity so the turn-toward-walker-then-restore behavior is testable
// without a PIXI renderer. The agent entity composes this and applies the
// returned directions to its sprite.
export class ReactionGlance {
  private timer = 0
  private restoreFace: Direction | null = null

  get active(): boolean {
    return this.timer > 0
  }

  get currentRestoreFace(): Direction | null {
    return this.restoreFace
  }

  // Begin a glance from `fromTile` toward `towardTile`. Stores the current
  // facing to restore later and returns the direction to face now. Returns
  // null only if no direction can be computed (fromTile === towardTile).
  start(currentFace: Direction, fromTile: Vec2, towardTile: Vec2): Direction | null {
    if (fromTile.x === towardTile.x && fromTile.y === towardTile.y) return null
    this.restoreFace = currentFace
    this.timer = REACTION_GLANCE_SECONDS
    return facingToward(fromTile, towardTile)
  }

  // Advance the glance by dt seconds. Returns the face to restore when the
  // glance ends, or null while the glance continues or is inactive.
  tick(dt: number): Direction | null {
    if (this.timer <= 0) return null
    this.timer -= dt
    if (this.timer <= 0) {
      this.timer = 0
      const restore = this.restoreFace
      this.restoreFace = null
      return restore
    }
    return null
  }
}

// One agent in the office: sprite + movement + visual state machine.
// The VirtualOffice coordinator routes EventBus events into method calls here.
export class AgentEntity {
  readonly view: Container
  readonly descriptor: AgentDescriptor

  private sprite: AgentSprite
  private movement: AgentMovement
  private state: AgentVisualState = 'idle'
  private tile: Vec2
  private workstation?: Workstation
  private onArrive?: () => void
  private idleRunner: IdleBehaviorRunner
  private workRunner: WorkActivityRunner
  // Set by the idle controller's walkTo wrapper so setState('walking') does not
  // reset the runner mid-movement-step. Cleared on arrival / phase transition.
  private suppressRunnerReset = false
  // Interrupt state machine tracking return-to-task memory (spec §19, §20).
  private interruptState = new InterruptStateMachine('idle')
  // Contextual-reaction glance state (spec §18). Pure so the turn-then-restore
  // behavior is testable without a PIXI renderer.
  private reaction = new ReactionGlance()

  constructor(
    private renderer: Renderer,
    descriptor: AgentDescriptor,
    private layout: OfficeLayout,
    private nav: NavigationGrid,
    spawn: Vec2,
  ) {
    this.descriptor = descriptor
    this.sprite = new AgentSprite(renderer, descriptor.role)
    const walk = CHARACTER_SHEET[descriptor.role].walk
    const speed = walk.speedMultiplier * BASE_SPEED
    this.movement = new AgentMovement(speed, {
      enabled: descriptor.role === 'qa',
      interval: 2.0,
      duration: 0.3,
    })
    this.tile = { ...spawn }
    this.workstation = workstationForRole(layout, descriptor.role)
    this.view = this.sprite.view
    const px = tileToPxCenter(spawn)
    this.sprite.setPixelPosition(px.x, px.y)
    this.idleRunner = new IdleBehaviorRunner(
      this.idleController(),
      CHARACTER_SHEET[descriptor.role].idleSequence,
    )
    this.workRunner = new WorkActivityRunner(
      this.workController(),
      CHARACTER_SHEET[descriptor.role].workingSequence,
    )
    this.setState('idle')
  }

  get currentTile(): Vec2 {
    return this.movement.isMoving() ? this.movement.currentTile() : this.tile
  }

  get currentState(): AgentVisualState {
    return this.state
  }

  get isInterrupted(): boolean {
    return this.interruptState.isInterrupted
  }

  get interruptedBy(): InterruptPriority | null {
    return this.interruptState.interruptedBy
  }

  get runtimeState(): AgentRuntimeState {
    return this.interruptState.runtimeState
  }

  get workstationSeat(): Vec2 | undefined {
    return this.workstation?.seat
  }

  // Seated visual states — the agent is at its workstation chair (spec §18).
  private static readonly SEATED_STATES: ReadonlySet<AgentVisualState> = new Set([
    'idle',
    'working',
    'coding',
    'testing',
    'reviewing',
    'reading',
    'thinking',
    'waiting',
  ])

  // True when the agent is stationary at its workstation seat in a seated pose.
  get isSeated(): boolean {
    if (this.movement.isMoving()) return false
    if (!this.workstation) return false
    if (this.tile.x !== this.workstation.seat.x || this.tile.y !== this.workstation.seat.y) return false
    return AgentEntity.SEATED_STATES.has(this.state)
  }

  // Contextual reaction (spec §18): a seated agent briefly turns toward a
  // nearby walker, then returns to its previous facing. This is a LOW-priority
  // visual overlay — it does NOT go through the interrupt system and does not
  // store previousState, so the agent's logical activity is untouched.
  reactToNearbyWalker(walkerTile: Vec2, _walkerRole: AgentRole): void {
    if (!this.isSeated) return
    if (this.state === 'offline' || this.state === 'error') return
    const dir = this.reaction.start(this.sprite.direction, this.tile, walkerTile)
    if (dir !== null) this.face(dir)
  }

  get isReacting(): boolean {
    return this.reaction.active
  }

  // Walk to a tile; resolves when the agent arrives.
  walkTo(target: Vec2): Promise<void> {
    return new Promise((resolve) => {
      const start = this.currentTile
      let path = this.nav.findPath(start, target)
      if (!path) {
        // Target blocked (e.g. a desk) — step to the nearest walkable tile.
        const near = this.nav.nearestWalkable(target)
        if (near) path = this.nav.findPath(start, near)
      }
      if (!path || path.length === 0) {
        resolve()
        return
      }
      this.setState('walking')
      const px = tileToPxCenter(start)
      this.movement.setPath(path, px, (arrived) => {
        this.tile = { ...arrived }
        resolve()
      })
    })
  }

  // Walk to this agent's workstation seat and switch to a working pose.
  async goToWorkstation(state: AgentVisualState = 'working'): Promise<void> {
    if (!this.workstation) return
    await this.walkTo(this.workstation.seat)
    this.face(this.workstation.face)
    this.setState(state)
  }

  face(dir: Direction): void {
    this.sprite.setDirection(dir)
  }

  setState(state: AgentVisualState): void {
    const wasIdle = this.state === 'idle' || this.state === 'waiting'
    const wasWorking = isWorkingVisualState(this.state)
    this.state = state
    this.interruptState.state = state
    this.sprite.setState(state)
    // Leaving idle for a real task pauses the runner; reset so the next idle
    // period restarts the sequence cleanly. Suppressed when the state change
    // originates from the idle runner's own walkTo (movement step).
    if (wasIdle && state !== 'idle' && state !== 'waiting' && !this.suppressRunnerReset) {
      this.idleRunner.reset()
    }
    // Leaving a working state pauses the work cycle; reset so the next working
    // period restarts the sequence from the first activity (spec §16).
    if (wasWorking && !isWorkingVisualState(state)) {
      this.workRunner.reset()
    }
  }

  // Set a visual pose without changing the logical state — used by the idle
  // runner so the agent stays in 'idle'/'waiting' (keeping the runner active)
  // while showing typing/reading/thinking frames.
  setPose(pose: AgentVisualState): void {
    this.sprite.setState(pose)
  }

  // Apply the current work activity so the sprite picks the per-activity
  // working frame set (spec §16). Driven by the WorkActivityRunner.
  setActivity(activity: ActivityKind): void {
    this.interruptState.activity = activity
    this.sprite.setActivity(activity)
  }

  setOffline(): void {
    this.setState('offline')
  }

  // Interrupt the current activity with a higher-priority event (spec §19).
  // Stores the previous state/activity so resume() can restore them (§20).
  // Returns true if the interrupt was accepted; false if a higher-or-equal
  // priority interrupt is already active. A real interrupt resets the runners
  // (suppressRunnerReset is NOT set) so they pick up the new state cleanly.
  interrupt(priority: InterruptPriority, newState: AgentVisualState, newActivity?: ActivityKind): boolean {
    const accepted = this.interruptState.interrupt(priority, newState, newActivity)
    if (!accepted) return false
    this.setState(newState)
    if (newActivity) this.setActivity(newActivity)
    return true
  }

  // Resume the previous activity after an interrupt resolves (spec §20).
  // No-op when not interrupted. The runners pick up naturally based on the
  // restored state since they check the current state each tick.
  resume(): void {
    if (!this.interruptState.isInterrupted) return
    this.interruptState.resume()
    this.setState(this.interruptState.state)
    if (this.interruptState.activity) this.setActivity(this.interruptState.activity)
  }

  update(dt: number, t: number): void {
    const arrived = this.movement.update(dt)
    if (this.movement.isMoving()) {
      const px = this.movement.currentPx()
      this.sprite.setPixelPosition(Math.round(px.x), Math.round(px.y))
      this.sprite.setDirection(this.movement.direction())
      this.tile = this.movement.currentTile()
    }
    if (arrived && this.state === 'walking') {
      // Caller (coordinator) decides the next state; default to idle.
      this.setState('idle')
    }
    // Tick the contextual-reaction glance (spec §18). Restore the previous
    // facing when the glance expires. Movement overrides any glance, so only
    // count down while stationary.
    if (this.reaction.active && !this.movement.isMoving()) {
      const restore = this.reaction.tick(dt)
      if (restore !== null) this.face(restore)
    }
    // Drive the idle behavior tree only while idle/waiting and stationary.
    if ((this.state === 'idle' || this.state === 'waiting') && !this.movement.isMoving()) {
      this.idleRunner.update(dt)
    }
    // Drive the working sub-activity cycle while in a working state and
    // stationary (spec §16). The runner self-pauses on non-working states.
    if (isWorkingVisualState(this.state) && !this.movement.isMoving()) {
      this.workRunner.update(dt)
    }
    this.sprite.update(t)
  }

  // Pixel position of the agent's head — used to anchor speech bubbles /
  // message envelopes above the character.
  headPixelPosition(): Vec2 {
    const px = this.movement.isMoving() ? this.movement.currentPx() : tileToPxCenter(this.tile)
    return { x: Math.round(px.x), y: Math.round(px.y) - SPRITE_HEAD_OFFSET }
  }

  // Build the IdleAgentController the runner uses to drive this agent.
  private idleController(): IdleAgentController {
    const self = this
    return {
      get role(): AgentRole {
        return self.descriptor.role
      },
      currentState: () => self.state,
      isInterrupted: () => self.isInterrupted,
      isMoving: () => self.movement.isMoving(),
      currentTile: () => self.currentTile,
      setPose: (pose) => self.setPose(pose),
      face: (dir) => self.face(dir),
      walkTo: (target) => {
        // Suppress runner reset so setState('walking') inside walkTo does not
        // wipe the runner's step index / phase mid-movement-step.
        self.suppressRunnerReset = true
        return self.walkTo(target).then(() => {
          self.suppressRunnerReset = false
        })
      },
      clearMovementSuppress: () => {
        self.suppressRunnerReset = false
      },
      seatTile: () => self.workstation?.seat,
      deskTile: () => self.workstation?.desk,
      faceDirection: () => self.workstation?.face as Direction | undefined,
      poiTileFor: (step) => self.poiTileFor(step),
    }
  }

  // Build the WorkAgentController the work runner uses to drive this agent.
  private workController(): WorkAgentController {
    const self = this
    return {
      get role(): AgentRole {
        return self.descriptor.role
      },
      currentState: () => self.state,
      isInterrupted: () => self.isInterrupted,
      setActivity: (activity) => self.setActivity(activity),
    }
  }

  // Resolve the point-of-interest tile for a movement idle step (spec §23:
  // all movement is to specific POIs, never random wandering).
  private poiTileFor(step: IdleBehavior): Vec2 | undefined {
    const role = this.descriptor.role
    const findFurniture = (kind: FurnitureKind): Vec2 | undefined =>
      this.layout.furniture.find((f) => f.kind === kind)?.tile
    const roomDoor = (id: string): Vec2 | undefined =>
      this.layout.rooms.find((r) => r.id === id)?.door

    switch (step) {
      case 'walk':
        // CEO → task board; DevOps → server rack; others → break room.
        if (role === 'ceo') return findFurniture('taskBoard')
        if (role === 'devops') return findFurniture('serverRack')
        return roomDoor('break')
      case 'inspect_board':
        return findFurniture('whiteboard') ?? findFurniture('designBoard')
      case 'walk_to_server':
        return findFurniture('serverRack')
      case 'inspect':
        return findFurniture('bugBoard') ?? findFurniture('taskBoard')
      default:
        return undefined
    }
  }
}

const SPRITE_HEAD_OFFSET = 16 // sprite is 18 tall, feet-anchored; head ~16px up

const BASE_SPEED = 3.0 // tiles/sec; per-role speedMultiplier scales this (§9)

// Duration of the contextual-reaction glance (spec §18): 1-2s. Picked at the
// middle of the range so the turn reads as a brief look, not a stare.
const REACTION_GLANCE_SECONDS = 1.5

// Cardinal direction from `from` toward `to`, based on tile positions. Mirrors
// VirtualOffice.faceDirection but kept local to avoid a circular import.
function facingToward(from: Vec2, to: Vec2): Direction {
  const dx = to.x - from.x
  const dy = to.y - from.y
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'right' : 'left'
  return dy > 0 ? 'down' : 'up'
}
