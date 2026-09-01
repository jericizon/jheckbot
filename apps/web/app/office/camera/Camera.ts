import { Container, type Ticker } from 'pixi.js'
import type { Vec2 } from '../types'
import { TILE, WORLD_W, WORLD_H } from '../world/layout'

// Top-down camera wrapping the world container. Pan/zoom with smooth easing;
// pixel-art stays crisp because the renderer uses nearest-neighbor sampling
// and the world container scale is snapped to integers (spec §3/§4).
export class Camera {
  readonly view: Container

  private targetX = 0
  private targetY = 0
  private targetZoom = 1
  private currentX = 0
  private currentY = 0
  private currentZoom = 1

  private baseZoom = 1
  private minZoom = 0.5
  private maxZoom = 6

  private viewportW = 0
  private viewportH = 0
  private dragging = false
  private dragStart = { x: 0, y: 0, camX: 0, camY: 0 }

  constructor(viewportW: number, viewportH: number) {
    this.view = new Container()
    this.setViewportSize(viewportW, viewportH)
    this.fitToScreen(true)
  }

  setViewportSize(w: number, h: number): void {
    this.viewportW = w
    this.viewportH = h
  }

  // Snap zoom to the nearest quarter-step. Quarter-integer scales keep pixel
  // art aligned to a 4px grid while giving four zoom steps per integer for
  // smoother zooming than half- or integer-only snapping.
  setZoom(zoom: number, immediate = false): void {
    this.targetZoom = clamp(Math.round(zoom * 4) / 4, this.minZoom, this.maxZoom)
    if (immediate) {
      this.currentZoom = this.targetZoom
      this.baseZoom = this.targetZoom
    } else {
      this.baseZoom = this.targetZoom
    }
    this.clampTarget()
  }

  zoomIn(): void {
    this.setZoom(this.targetZoom + 0.25)
  }

  zoomOut(): void {
    this.setZoom(this.targetZoom - 0.25)
  }

  centerOn(point: Vec2, immediate = false): void {
    this.targetX = point.x
    this.targetY = point.y
    this.clampTarget()
    if (immediate) {
      this.currentX = this.targetX
      this.currentY = this.targetY
    }
  }

  panBy(dx: number, dy: number): void {
    this.targetX -= dx / this.currentZoom
    this.targetY -= dy / this.currentZoom
    this.clampTarget()
  }

  isDragging(): boolean {
    return this.dragging
  }

  beginDrag(screenX: number, screenY: number): void {
    this.dragging = true
    this.dragStart = {
      x: screenX,
      y: screenY,
      camX: this.targetX,
      camY: this.targetY,
    }
  }

  drag(screenX: number, screenY: number): void {
    if (!this.dragging) return
    const dx = screenX - this.dragStart.x
    const dy = screenY - this.dragStart.y
    this.targetX = this.dragStart.camX - dx / this.currentZoom
    this.targetY = this.dragStart.camY - dy / this.currentZoom
    this.clampTarget()
  }

  endDrag(): void {
    this.dragging = false
  }

  reset(): void {
    this.fitToScreen()
  }

  // Fit the whole office world into the current viewport. Calculates the zoom
  // that shows the entire world, snapped to a quarter-step, and centers it.
  fitToScreen(immediate = false): void {
    const worldPxW = WORLD_W * TILE
    const worldPxH = WORLD_H * TILE
    const fit = Math.min(this.viewportW / worldPxW, this.viewportH / worldPxH)
    this.setZoom(fit, immediate)
    this.centerOn({ x: worldPxW / 2, y: worldPxH / 2 }, immediate)
  }

  // Convert screen coords (relative to canvas) to world tile coords.
  screenToTile(screenX: number, screenY: number): Vec2 {
    const worldX = this.currentX + screenX / this.currentZoom
    const worldY = this.currentY + screenY / this.currentZoom
    return { x: Math.floor(worldX / TILE), y: Math.floor(worldY / TILE) }
  }

  update(_ticker: Ticker): void {
    // Easing toward target. Frame-rate independent enough at 60fps; the
    // movement is subtle by design (spec §3: "smooth but subtle movement").
    const ease = 0.18
    this.currentX += (this.targetX - this.currentX) * ease
    this.currentY += (this.targetY - this.currentY) * ease
    this.currentZoom += (this.targetZoom - this.currentZoom) * ease

    const zoom = this.currentZoom
    const worldW = WORLD_W * TILE
    const worldH = WORLD_H * TILE
    // Center the world in the viewport, then apply camera offset + zoom.
    this.view.scale.set(zoom)
    this.view.x = -this.currentX * zoom + this.viewportW / 2
    this.view.y = -this.currentY * zoom + this.viewportH / 2

    // Keep the camera from showing outside the office bounds. When the
    // scaled world is smaller than the viewport (zoomed out), center it
    // instead of pinning it to a corner.
    const scaledW = worldW * zoom
    const scaledH = worldH * zoom
    if (scaledW >= this.viewportW) {
      if (this.view.x > 0) this.view.x = 0
      if (this.view.x + scaledW < this.viewportW) this.view.x = this.viewportW - scaledW
    } else {
      this.view.x = (this.viewportW - scaledW) / 2
    }
    if (scaledH >= this.viewportH) {
      if (this.view.y > 0) this.view.y = 0
      if (this.view.y + scaledH < this.viewportH) this.view.y = this.viewportH - scaledH
    } else {
      this.view.y = (this.viewportH - scaledH) / 2
    }
  }

  private clampTarget(): void {
    const worldW = WORLD_W * TILE
    const worldH = WORLD_H * TILE
    const halfW = this.viewportW / 2 / this.targetZoom
    const halfH = this.viewportH / 2 / this.targetZoom
    this.targetX = clamp(this.targetX, halfW, worldW - halfW)
    this.targetY = clamp(this.targetY, halfH, worldH - halfH)
    // If the world is smaller than the viewport at this zoom, center it.
    if (worldW < this.viewportW / this.targetZoom) this.targetX = worldW / 2
    if (worldH < this.viewportH / this.targetZoom) this.targetY = worldH / 2
  }
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}
