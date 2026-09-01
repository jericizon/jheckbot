import type { Direction, Vec2 } from '../types'
import { TILE } from '../world/layout'

// Options for the QA micro-stop behaviour (spec §5): QA pauses briefly every
// few seconds while walking, giving a cautious, hesitant gait.
export interface MicroStopOptions {
  enabled: boolean
  interval: number // seconds of walking between stops
  duration: number // seconds to pause during a stop
}

// Smooth path-following along a tile grid (spec §13).
// Agents move between tile centers with linear interpolation, snapping to the
// grid at each waypoint while keeping a pixel-art appearance (positions are
// rounded in the renderer via roundPixels).
export class AgentMovement {
  private path: Vec2[] = []
  private index = 0
  private speed: number // tiles per second
  private fromPx: Vec2 = { x: 0, y: 0 }
  private toPx: Vec2 = { x: 0, y: 0 }
  private progress = 0
  private moving = false
  private onArrive?: (tile: Vec2) => void

  // Micro-stop state (spec §5, QA). When enabled, the agent periodically
  // pauses mid-walk for `duration` seconds, then resumes from the same
  // interpolated position.
  readonly microStopInterval: number
  private readonly microStopDuration: number
  private readonly microStopEnabled: boolean
  private walkTimer = 0
  private inMicroStop = false
  private microStopTimer = 0

  constructor(speed = 3.0, microStop?: MicroStopOptions) {
    this.speed = speed
    this.microStopEnabled = microStop?.enabled ?? false
    this.microStopInterval = microStop?.enabled ? (microStop.interval || 2.0) : 0
    this.microStopDuration = microStop?.duration ?? 0.3
  }

  setPath(path: Vec2[], startPx: Vec2, onArrive?: (tile: Vec2) => void): void {
    this.path = path
    this.index = 0
    this.fromPx = { ...startPx }
    this.progress = 0
    this.onArrive = onArrive
    this.walkTimer = 0
    this.inMicroStop = false
    this.microStopTimer = 0
    const first = path[0]
    const last = path[path.length - 1]
    if (path.length === 0 || (path.length === 1 && first && sameTile(first, pxToTile(startPx)))) {
      this.moving = false
      onArrive?.(last ?? pxToTile(startPx))
      return
    }
    // Skip the first waypoint if it equals the current tile.
    if (first && sameTile(first, pxToTile(startPx))) {
      this.index = 1
    }
    if (this.index >= path.length) {
      this.moving = false
      onArrive?.(last ?? pxToTile(startPx))
      return
    }
    const next = path[this.index]
    if (next) this.toPx = tileToPxCenter(next)
    this.moving = true
  }

  isMoving(): boolean {
    return this.moving
  }

  currentTile(): Vec2 {
    return pxToTile(this.currentPx())
  }

  currentPx(): Vec2 {
    if (!this.moving) return this.toPx.x || this.fromPx.x ? this.fromPx : this.toPx
    const t = this.progress
    return {
      x: this.fromPx.x + (this.toPx.x - this.fromPx.x) * t,
      y: this.fromPx.y + (this.toPx.y - this.fromPx.y) * t,
    }
  }

  direction(): Direction {
    if (!this.moving) return 'down'
    const dx = this.toPx.x - this.fromPx.x
    const dy = this.toPx.y - this.fromPx.y
    if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'right' : 'left'
    return dy > 0 ? 'down' : 'up'
  }

  // Advance movement by dt seconds. Returns true if just arrived at final tile.
  update(dt: number): boolean {
    // Handle an active micro-stop: count down, then resume walking.
    if (this.inMicroStop) {
      this.microStopTimer -= dt
      if (this.microStopTimer <= 0) {
        this.inMicroStop = false
        this.moving = true
      }
      return false
    }

    if (!this.moving) return false

    // QA micro-stop: accumulate walking time and trigger a periodic pause.
    if (this.microStopEnabled) {
      this.walkTimer += dt
      if (this.walkTimer >= this.microStopInterval) {
        this.walkTimer = 0
        this.inMicroStop = true
        this.microStopTimer = this.microStopDuration
        this.moving = false
        return false
      }
    }

    const dist = tileDistance(this.fromPx, this.toPx)
    const step = (this.speed * TILE / dist) * dt
    this.progress += step
    while (this.progress >= 1 && this.moving) {
      this.progress -= 1
      this.fromPx = { ...this.toPx }
      this.index++
      if (this.index >= this.path.length) {
        this.moving = false
        this.progress = 0
        const arrived = this.path[this.path.length - 1]
        this.onArrive?.(arrived ?? this.toPx)
        this.onArrive = undefined
        return true
      }
      const next = this.path[this.index]
      if (next) this.toPx = tileToPxCenter(next)
    }
    return false
  }
}

export function tileToPxCenter(tile: Vec2): Vec2 {
  return { x: tile.x * TILE + TILE / 2, y: tile.y * TILE + TILE / 2 }
}

export function pxToTile(px: Vec2): Vec2 {
  return { x: Math.floor(px.x / TILE), y: Math.floor(px.y / TILE) }
}

function sameTile(a: Vec2, b: Vec2): boolean {
  return a.x === b.x && a.y === b.y
}

function tileDistance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y) || 1
}
