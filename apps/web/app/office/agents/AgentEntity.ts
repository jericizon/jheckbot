import { Container, type Renderer } from 'pixi.js'
import type { AgentDescriptor, AgentRole, AgentVisualState, Direction, IdleBehavior, Vec2 } from '../types'
import { type FurnitureKind, type OfficeLayout, type Workstation, workstationForRole } from '../world/layout'
import { NavigationGrid } from '../world/NavigationGrid'
import { AgentSprite } from './AgentSprite'
import { AgentMovement, tileToPxCenter } from './AgentMovement'
import { CHARACTER_SHEET } from '../characters/CharacterSheet'
import { IdleBehaviorRunner, type IdleAgentController } from './IdleBehaviorRunner'

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
    this.setState('idle')
  }

  get currentTile(): Vec2 {
    return this.movement.isMoving() ? this.movement.currentTile() : this.tile
  }

  get currentState(): AgentVisualState {
    return this.state
  }

  get workstationSeat(): Vec2 | undefined {
    return this.workstation?.seat
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
    this.state = state
    this.sprite.setState(state)
    // Leaving idle for a real task pauses the runner; reset so the next idle
    // period restarts the sequence cleanly.
    if (wasIdle && state !== 'idle' && state !== 'waiting') {
      this.idleRunner.reset()
    }
  }

  // Set a visual pose without changing the logical state — used by the idle
  // runner so the agent stays in 'idle'/'waiting' (keeping the runner active)
  // while showing typing/reading/thinking frames.
  setPose(pose: AgentVisualState): void {
    this.sprite.setState(pose)
  }

  setOffline(): void {
    this.setState('offline')
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
    // Drive the idle behavior tree only while idle/waiting and stationary.
    if ((this.state === 'idle' || this.state === 'waiting') && !this.movement.isMoving()) {
      this.idleRunner.update(dt)
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
      isMoving: () => self.movement.isMoving(),
      currentTile: () => self.currentTile,
      setPose: (pose) => self.setPose(pose),
      face: (dir) => self.face(dir),
      walkTo: (target) => self.walkTo(target),
      seatTile: () => self.workstation?.seat,
      deskTile: () => self.workstation?.desk,
      faceDirection: () => self.workstation?.face as Direction | undefined,
      poiTileFor: (step) => self.poiTileFor(step),
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
