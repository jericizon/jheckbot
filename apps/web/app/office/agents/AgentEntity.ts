import { Container, type Renderer } from 'pixi.js'
import type { AgentDescriptor, AgentVisualState, Direction, Vec2 } from '../types'
import { type OfficeLayout, type Workstation, workstationForRole } from '../world/layout'
import { NavigationGrid } from '../world/NavigationGrid'
import { AgentSprite } from './AgentSprite'
import { AgentMovement, tileToPxCenter } from './AgentMovement'
import { CHARACTER_SHEET } from '../characters/CharacterSheet'

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
    this.state = state
    this.sprite.setState(state)
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
    this.sprite.update(t)
  }

  // Pixel position of the agent's head — used to anchor speech bubbles /
  // message envelopes above the character.
  headPixelPosition(): Vec2 {
    const px = this.movement.isMoving() ? this.movement.currentPx() : tileToPxCenter(this.tile)
    return { x: Math.round(px.x), y: Math.round(px.y) - SPRITE_HEAD_OFFSET }
  }
}

const SPRITE_HEAD_OFFSET = 16 // sprite is 18 tall, feet-anchored; head ~16px up

const BASE_SPEED = 3.0 // tiles/sec; per-role speedMultiplier scales this (§9)
