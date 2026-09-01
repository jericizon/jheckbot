import { Container, Graphics, Rectangle, Sprite, type Renderer, Texture } from 'pixi.js'
import { PALETTE } from '../Palette'
import { TILE, type OfficeLayout, type FurniturePlacement, type FloorCode } from './layout'

// Renders the static office shell: floors, walls, doors, furniture, and
// decorations. All artwork is drawn pixel-by-pixel with flat fills (spec
// §4/§8/§9/§30 — no static background image, no gradients, no blur).
//
// Animated decor (server LEDs, coffee steam, clock, monitor glow) is exposed
// via update() so the VirtualOffice ticker can drive it.

const FLOOR_COLORS: Record<FloorCode, { base: string; dark: string; speckle: string }> = {
  void: { base: PALETTE.ink, dark: PALETTE.ink, speckle: PALETTE.ink },
  wall: { base: PALETTE.wall, dark: PALETTE.wallShadow, speckle: PALETTE.wallTrim },
  carpet: { base: PALETTE.carpet, dark: PALETTE.carpetDark, speckle: PALETTE.carpetDark },
  ceo: { base: PALETTE.cream, dark: PALETTE.creamDark, speckle: PALETTE.creamDark },
  eng: { base: PALETTE.carpet, dark: PALETTE.carpetDark, speckle: PALETTE.mutedBlueDark },
  qa: { base: PALETTE.tile, dark: PALETTE.tileDark, speckle: PALETTE.tileDark },
  design: { base: PALETTE.cream, dark: PALETTE.creamDark, speckle: PALETTE.softOrangeDark },
  collab: { base: PALETTE.carpet, dark: PALETTE.carpetDark, speckle: PALETTE.mutedGreenDark },
  server: { base: PALETTE.serverFloor, dark: PALETTE.serverFloorDark, speckle: PALETTE.serverFloorDark },
  break: { base: PALETTE.tile, dark: PALETTE.tileDark, speckle: PALETTE.creamDark },
}

// Procedural ambient micro-animation elements (spec §17). Each is a tiny
// PIXI.Graphics/Container drawn into the `micro` layer above the furniture
// and nudged a few pixels per tick so the office feels alive.
interface SteamParticle {
  gfx: Graphics
  baseX: number
  baseY: number
  phase: number // 0..1 offset so particles desync
}
interface ServerLed {
  gfx: Graphics
  period: number // toggle cadence in seconds
}
interface ClockHand {
  gfx: Graphics
  cx: number
  cy: number
}

export class OfficeWorld {
  readonly view: Container
  // Glow overlay container drawn above furniture but below agents — used for
  // monitor glow when a workstation is occupied.
  readonly glow: Container
  // Micro-animation layer: ambient decor (steam, LEDs, plant sway, clock
  // hands, notification dots) drawn above furniture but below agents.
  readonly micro: Container
  // Exposed for tests / introspection.
  readonly steamParticles: SteamParticle[] = []
  readonly serverLeds: ServerLed[] = []
  readonly plantContainers: Container[] = []
  readonly clockHands: ClockHand[] = []
  readonly notificationDots: Graphics[] = []

  // Map of "x,y" -> monitor glow sprite, toggled by the agent layer.
  private monitorGlows = new Map<string, Sprite>()

  constructor(private renderer: Renderer, private layout: OfficeLayout) {
    this.view = new Container()
    this.glow = new Container()
    this.micro = new Container()
    this.build()
  }

  private build(): void {
    this.buildFloors()
    this.buildWalls()
    this.buildFurniture()
    this.buildMicroAnimations()
    // Micro layer sits above the furniture within the world view; glow and
    // agents are parented above this by VirtualOffice.
    this.view.addChild(this.micro)
  }

  private buildFloors(): void {
    const g = new Graphics()
    for (let y = 0; y < this.layout.height; y++) {
      for (let x = 0; x < this.layout.width; x++) {
        const code = this.layout.tiles[y]?.[x] ?? 'void'
        const c = FLOOR_COLORS[code]
        const px = x * TILE
        const py = y * TILE
        g.rect(px, py, TILE, TILE).fill(c.base)
        // Subtle checker to add depth without gradients.
        if ((x + y) % 2 === 0) {
          g.rect(px, py, TILE, TILE).fill(c.dark + 'aa')
        }
        // A few speckle pixels for texture.
        g.rect(px + 2, py + 3, 1, 1).fill(c.speckle)
        g.rect(px + 9, py + 11, 1, 1).fill(c.speckle)
      }
    }
    this.view.addChild(g)
  }

  private buildWalls(): void {
    const g = new Graphics()
    for (let y = 0; y < this.layout.height; y++) {
      for (let x = 0; x < this.layout.width; x++) {
        if (this.layout.tiles[y]?.[x] !== 'wall') continue
        const px = x * TILE
        const py = y * TILE
        // Wall body
        g.rect(px, py, TILE, TILE).fill(PALETTE.wall)
        // Top highlight (light catches the top of the wall)
        g.rect(px, py, TILE, 3).fill(PALETTE.wallTop)
        // Bottom shadow
        g.rect(px, py + TILE - 3, TILE, 3).fill(PALETTE.wallShadow)
        // Trim line
        g.rect(px, py + TILE - 4, TILE, 1).fill(PALETTE.wallTrim)
      }
    }
    this.view.addChild(g)
  }

  private buildFurniture(): void {
    for (const f of this.layout.furniture) {
      this.placeFurniture(f)
    }
  }

  private placeFurniture(f: FurniturePlacement): void {
    const px = f.tile.x * TILE
    const py = f.tile.y * TILE
    switch (f.kind) {
      case 'roomSign':
        this.drawRoomSign(g => this.view.addChild(g), f, px, py)
        break
      case 'window':
        this.drawWindow(g => this.view.addChild(g), px, py, f.w)
        break
      case 'poster':
        this.drawPoster(g => this.view.addChild(g), px, py)
        break
      default: {
        const g = this.drawFurniturePiece(f.kind, f.w, f.h)
        g.position.set(px, py)
        this.view.addChild(g)
      }
    }
  }

  private drawFurniturePiece(kind: FurniturePlacement['kind'], w: number, h: number): Graphics {
    const g = new Graphics()
    const W = w * TILE
    const H = h * TILE
    switch (kind) {
      case 'desk':
        // Wooden desk top with darker front edge.
        g.rect(0, 2, W, H - 4).fill(PALETTE.wood)
        g.rect(0, H - 4, W, 3).fill(PALETTE.woodDark)
        g.rect(0, 2, W, 2).fill(PALETTE.woodLight)
        // Cable detail
        g.rect(2, H - 2, 1, 2).fill(PALETTE.charcoal)
        g.rect(W - 4, H - 2, 1, 2).fill(PALETTE.charcoal)
        break
      case 'monitor':
        // Monitor stand + screen.
        g.rect(4, 8, 8, 2).fill(PALETTE.metalDark)
        g.rect(6, 10, 4, 3).fill(PALETTE.metalDark)
        g.rect(2, 2, 12, 7).fill(PALETTE.charcoal)
        g.rect(3, 3, 10, 5).fill(PALETTE.screenDim)
        break
      case 'chair':
        g.rect(4, 2, 8, 10).fill(PALETTE.metalDark)
        g.rect(3, 4, 10, 7).fill(PALETTE.charcoalLight)
        g.rect(4, 11, 8, 2).fill(PALETTE.metalDark)
        break
      case 'bookshelf':
        g.rect(0, 0, TILE, H).fill(PALETTE.woodDark)
        g.rect(1, 1, TILE - 2, H - 2).fill(PALETTE.wood)
        // Shelves + books
        for (let s = 0; s < Math.floor(H / 6); s++) {
          const sy = 2 + s * 6
          g.rect(1, sy + 4, TILE - 2, 1).fill(PALETTE.woodDark)
          g.rect(2, sy, 2, 4).fill(PALETTE.mutedRed)
          g.rect(5, sy, 2, 4).fill(PALETTE.mutedBlue)
          g.rect(8, sy, 2, 4).fill(PALETTE.mutedGreen)
          g.rect(11, sy, 2, 4).fill(PALETTE.accentYellow)
        }
        break
      case 'plant':
        g.rect(5, 10, 6, 5).fill(PALETTE.pot)
        g.rect(4, 10, 8, 2).fill(PALETTE.woodDark)
        g.rect(3, 4, 10, 7).fill(PALETTE.leaf)
        g.rect(5, 2, 6, 5).fill(PALETTE.leafDark)
        g.rect(7, 1, 2, 3).fill(PALETTE.leaf)
        break
      case 'taskBoard':
        g.rect(0, 0, TILE, H).fill(PALETTE.cream)
        g.rect(0, 0, TILE, 1).fill(PALETTE.woodDark)
        g.rect(0, H - 1, TILE, 1).fill(PALETTE.woodDark)
        // Sticky notes
        g.rect(2, 3, 4, 4).fill(PALETTE.accentYellow)
        g.rect(8, 4, 4, 4).fill(PALETTE.softOrange)
        g.rect(3, 9, 4, 4).fill(PALETTE.mutedBlue)
        break
      case 'commMonitor':
        g.rect(2, 4, 12, 9).fill(PALETTE.charcoal)
        g.rect(3, 5, 10, 7).fill(PALETTE.screen)
        g.rect(4, 6, 8, 1).fill(PALETTE.glow)
        g.rect(4, 8, 6, 1).fill(PALETTE.glow)
        break
      case 'meetingTable':
        g.rect(2, 2, W - 4, H - 4).fill(PALETTE.wood)
        g.rect(2, 2, W - 4, 2).fill(PALETTE.woodLight)
        g.rect(2, H - 4, W - 4, 2).fill(PALETTE.woodDark)
        // Center inset
        g.rect(6, 6, W - 12, H - 12).fill(PALETTE.woodDark)
        break
      case 'whiteboard':
        g.rect(0, 0, W, H).fill(PALETTE.metalDark)
        g.rect(1, 1, W - 2, H - 2).fill(PALETTE.cream)
        g.rect(2, 3, 6, 1).fill(PALETTE.mutedBlue)
        g.rect(2, 5, 9, 1).fill(PALETTE.softOrange)
        g.rect(2, 7, 5, 1).fill(PALETTE.mutedGreen)
        break
      case 'serverRack':
        g.rect(0, 0, TILE, H).fill(PALETTE.charcoal)
        g.rect(1, 1, TILE - 2, H - 2).fill(PALETTE.charcoalLight)
        for (let u = 0; u < Math.floor(H / 4); u++) {
          const uy = 2 + u * 4
          g.rect(2, uy, TILE - 4, 3).fill(PALETTE.metalDark)
          // LED placeholders (animated separately)
          g.rect(12, uy + 1, 1, 1).fill(PALETTE.serverLed)
        }
        break
      case 'coffeeMachine':
        g.rect(0, 0, W, H - 2).fill(PALETTE.metalDark)
        g.rect(1, 1, W - 2, H - 4).fill(PALETTE.metal)
        g.rect(3, 3, 4, 5).fill(PALETTE.charcoal)
        g.rect(4, 4, 2, 3).fill(PALETTE.screen)
        // Cup
        g.rect(W - 7, H - 4, 4, 3).fill(PALETTE.cream)
        break
      case 'fridge':
        g.rect(0, 0, TILE, H).fill(PALETTE.metal)
        g.rect(1, 1, TILE - 2, H - 2).fill(PALETTE.metalDark)
        g.rect(2, 2, TILE - 4, H - 4).fill(PALETTE.metal)
        g.rect(TILE - 4, 3, 1, H - 6).fill(PALETTE.charcoal)
        break
      case 'breakTable':
        g.rect(2, 2, W - 4, H - 4).fill(PALETTE.woodLight)
        g.rect(2, 2, W - 4, 2).fill(PALETTE.cream)
        g.rect(2, H - 4, W - 4, 2).fill(PALETTE.woodDark)
        break
      case 'bugBoard':
        g.rect(0, 0, TILE, H).fill(PALETTE.cream)
        g.rect(0, 0, TILE, 1).fill(PALETTE.woodDark)
        // Bug sticky notes (red/green)
        g.rect(2, 3, 4, 4).fill(PALETTE.mutedRed)
        g.rect(8, 5, 4, 4).fill(PALETTE.mutedGreen)
        g.rect(3, 11, 4, 4).fill(PALETTE.accentYellow)
        break
      case 'designBoard':
        g.rect(0, 0, W, H).fill(PALETTE.cream)
        g.rect(1, 1, W - 2, H - 2).fill(PALETTE.creamDark)
        // Color samples
        g.rect(2, 2, 4, 4).fill(PALETTE.mutedRed)
        g.rect(7, 2, 4, 4).fill(PALETTE.mutedBlue)
        g.rect(12, 2, 4, 4).fill(PALETTE.mutedGreen)
        g.rect(2, 7, 4, 4).fill(PALETTE.accentYellow)
        g.rect(7, 7, 4, 4).fill(PALETTE.softOrange)
        break
      case 'filingCabinet':
        g.rect(0, 0, TILE, TILE).fill(PALETTE.metalDark)
        g.rect(1, 1, TILE - 2, TILE - 2).fill(PALETTE.metal)
        g.rect(2, 4, TILE - 4, 1).fill(PALETTE.charcoal)
        g.rect(2, 9, TILE - 4, 1).fill(PALETTE.charcoal)
        break
      case 'lamp':
        g.rect(6, 0, 4, 2).fill(PALETTE.accentYellow)
        g.rect(7, 2, 2, 8).fill(PALETTE.metalDark)
        g.rect(5, 10, 6, 2).fill(PALETTE.metalDark)
        break
      case 'clock':
        g.rect(2, 2, 12, 12).fill(PALETTE.cream)
        g.rect(2, 2, 12, 12).fill(PALETTE.charcoal + '00')
        g.rect(7, 3, 2, 5).fill(PALETTE.charcoal)
        g.rect(8, 8, 4, 1).fill(PALETTE.charcoal)
        g.rect(7, 2, 2, 1).fill(PALETTE.woodDark)
        g.rect(7, 14, 2, 1).fill(PALETTE.woodDark)
        g.rect(2, 7, 1, 2).fill(PALETTE.woodDark)
        g.rect(14, 7, 1, 2).fill(PALETTE.woodDark)
        break
      case 'rug':
        g.rect(0, 0, W, H).fill(PALETTE.mutedBlueDark + '55')
        g.rect(2, 2, W - 4, H - 4).fill(PALETTE.mutedBlue + '33')
        g.rect(4, 4, W - 8, H - 8).fill(PALETTE.accentYellow + '22')
        break
      default:
        g.rect(0, 0, W, H).fill(PALETTE.charcoalLight)
    }
    return g
  }

  private drawRoomSign(add: (g: Graphics) => void, f: FurniturePlacement, px: number, py: number): void {
    const g = new Graphics()
    const W = f.w * TILE
    g.rect(0, 0, W, TILE - 4).fill(PALETTE.woodDark)
    g.rect(1, 1, W - 2, TILE - 6).fill(PALETTE.cream)
    // Label dots instead of text (pixel font rendering is heavy); a colored
    // bar identifies the room. The Vue overlay shows the real label.
    const bar = roomAccent(f.label ?? '')
    g.rect(2, 3, 4, TILE - 10).fill(bar)
    add(g)
    g.position.set(px, py)
  }

  private drawWindow(add: (g: Graphics) => void, px: number, py: number, w: number): void {
    const g = new Graphics()
    const W = w * TILE
    // Frame
    g.rect(0, 0, W, TILE).fill(PALETTE.wallTrim)
    g.rect(1, 1, W - 2, TILE - 2).fill(PALETTE.mutedBlue)
    // Cross bars
    g.rect(W / 2 - 1, 1, 2, TILE - 2).fill(PALETTE.wallTrim)
    g.rect(1, TILE / 2 - 1, W - 2, 2).fill(PALETTE.wallTrim)
    // Soft outside brightness
    g.rect(2, 2, 4, 4).fill(PALETTE.cream + '88')
    add(g)
    g.position.set(px, py)
  }

  private drawPoster(add: (g: Graphics) => void, px: number, py: number): void {
    const g = new Graphics()
    g.rect(0, 0, TILE, TILE - 2).fill(PALETTE.mutedRedDark)
    g.rect(1, 1, TILE - 2, TILE - 4).fill(PALETTE.accentYellow)
    g.rect(3, 3, 4, 4).fill(PALETTE.mutedBlue)
    g.rect(9, 8, 3, 3).fill(PALETTE.charcoal)
    add(g)
    g.position.set(px, py)
  }

  // Toggle monitor glow at a workstation desk tile (called by agent layer).
  setMonitorGlow(deskTile: { x: number; y: number }, on: boolean): void {
    const key = `${deskTile.x},${deskTile.y}`
    let sprite = this.monitorGlows.get(key)
    if (on) {
      if (!sprite) {
        const tex = this.makeGlowTexture()
        sprite = new Sprite(tex)
        sprite.anchor.set(0.5)
        sprite.position.set(deskTile.x * TILE + TILE / 2, deskTile.y * TILE + TILE / 2 + 2)
        sprite.alpha = 0
        this.glow.addChild(sprite)
        this.monitorGlows.set(key, sprite)
      }
      // Fade in handled in update via target alpha.
      ;(sprite as Sprite & { targetAlpha?: number }).targetAlpha = 0.55
    } else if (sprite) {
      ;(sprite as Sprite & { targetAlpha?: number }).targetAlpha = 0
    }
  }

  private makeGlowTexture(): Texture {
    const g = new Graphics()
    // Soft pixel-cluster glow (no blur — just concentric dimmer rings).
    g.rect(4, 4, 8, 8).fill(PALETTE.glow + '44')
    g.rect(6, 6, 4, 4).fill(PALETTE.glow + '66')
    g.rect(7, 7, 2, 2).fill(PALETTE.glow)
    const tex = this.renderer.generateTexture({
      target: g,
      resolution: 1,
      antialias: false,
      frame: new Rectangle(0, 0, 16, 16),
    })
    g.destroy()
    return tex
  }

  update(t: number): void {
    this.updateMicro(t)
    // Monitor glow: ease a base alpha toward the agent-set target, then layer
    // a subtle ±0.1 brightness flicker on occupied desks (spec §17).
    for (const sprite of this.monitorGlows.values()) {
      const s = sprite as Sprite & { targetAlpha?: number; baseAlpha?: number }
      const target = s.targetAlpha ?? 0
      s.baseAlpha = (s.baseAlpha ?? 0) + (target - (s.baseAlpha ?? 0)) * 0.1
      const flicker = (s.baseAlpha ?? 0) > 0.02 ? Math.sin(t * 1.5) * 0.1 : 0
      sprite.alpha = Math.max(0, (s.baseAlpha ?? 0) + flicker)
      sprite.visible = (s.baseAlpha ?? 0) > 0.02
    }
  }

  // ---- Micro-animation construction (spec §17) ----

  private buildMicroAnimations(): void {
    for (const f of this.layout.furniture) {
      const px = f.tile.x * TILE
      const py = f.tile.y * TILE
      switch (f.kind) {
        case 'coffeeMachine':
          this.buildSteam(px, py, f.w)
          break
        case 'serverRack':
          this.buildServerLeds(px, py, f.h)
          break
        case 'plant':
          this.buildPlantSway(px, py)
          break
        case 'clock':
          this.buildClockHand(px, py)
          break
        case 'taskBoard':
          this.buildNotificationDot(px, py, f.w)
          break
        default:
          break
      }
    }
  }

  // 2x2 semi-transparent steam rects drifting up ~6px over a 3s loop.
  private buildSteam(px: number, py: number, w: number): void {
    const cupX = px + w * TILE - 5
    const baseY = py + 8
    for (let i = 0; i < 3; i++) {
      const gfx = new Graphics()
      gfx.rect(0, 0, 2, 2).fill(PALETTE.cream)
      gfx.alpha = 0
      const baseX = cupX + i * 2
      this.micro.addChild(gfx)
      this.steamParticles.push({ gfx, baseX, baseY, phase: i / 3 })
    }
  }

  // Green + red 1x1 LEDs blinking on staggered cadences.
  private buildServerLeds(px: number, py: number, h: number): void {
    const ledX = px + 12
    const greenY = py + 2
    const redY = py + Math.min(6, h * TILE - 4)
    const green = new Graphics().rect(0, 0, 1, 1).fill(PALETTE.serverLed)
    const red = new Graphics().rect(0, 0, 1, 1).fill(PALETTE.serverLedRed)
    green.position.set(ledX, greenY)
    red.position.set(ledX, redY)
    this.micro.addChild(green, red)
    this.serverLeds.push({ gfx: green, period: 1.5 }, { gfx: red, period: 2.5 })
  }

  // Foliage overlay that sways ±1px horizontally (Math.sin(t * 1.2), ~5s).
  private buildPlantSway(px: number, py: number): void {
    const c = new Container()
    const foliage = new Graphics()
    foliage.rect(3, 4, 10, 7).fill(PALETTE.leaf)
    foliage.rect(5, 2, 6, 5).fill(PALETTE.leafDark)
    foliage.rect(7, 1, 2, 3).fill(PALETTE.leaf)
    c.addChild(foliage)
    c.position.set(px, py)
    ;(c as Container & { baseX: number }).baseX = px
    this.micro.addChild(c)
    this.plantContainers.push(c)
  }

  // Clock hand: 1 revolution / 60s, redrawn pixel-snapped each tick.
  private buildClockHand(px: number, py: number): void {
    const gfx = new Graphics()
    const cx = px + 8
    const cy = py + 8
    this.micro.addChild(gfx)
    this.clockHands.push({ gfx, cx, cy })
  }

  // Notification dot bouncing 1px vertically every ~2s on the task board.
  private buildNotificationDot(px: number, py: number, w: number): void {
    const gfx = new Graphics().rect(0, 0, 2, 2).fill(PALETTE.mutedRed)
    gfx.position.set(px + w * TILE - 4, py + 1)
    this.micro.addChild(gfx)
    this.notificationDots.push(gfx)
  }

  private updateMicro(t: number): void {
    // Coffee steam: drift up + fade over 3s, then reset.
    for (const p of this.steamParticles) {
      const phase = (t / 3 + p.phase) % 1
      p.gfx.position.set(p.baseX, p.baseY - Math.round(phase * 6))
      p.gfx.alpha = (1 - phase) * 0.5
    }
    // Server LEDs: hard blink on/off per period.
    for (const led of this.serverLeds) {
      led.gfx.visible = Math.floor(t / led.period) % 2 === 0
    }
    // Plant sway: ±1px horizontal.
    for (const c of this.plantContainers) {
      const baseX = (c as Container & { baseX?: number }).baseX ?? c.x
      c.x = baseX + Math.round(Math.sin(t * 1.2))
    }
    // Clock hands: 1 rev / 60s, pixel-snapped line from center.
    for (const h of this.clockHands) {
      h.gfx.clear()
      const ang = (t / 60) * Math.PI * 2
      const hx = h.cx + Math.round(Math.cos(ang) * 3)
      const hy = h.cy + Math.round(Math.sin(ang) * 3)
      plotLine(h.gfx, h.cx, h.cy, hx, hy, PALETTE.charcoal)
    }
    // Notification bounce: 1px vertical, 2s period.
    for (const dot of this.notificationDots) {
      const baseY = (dot as Graphics & { baseY?: number }).baseY ?? dot.y
      ;(dot as Graphics & { baseY?: number }).baseY = baseY
      dot.y = baseY + Math.round(Math.sin(t * Math.PI))
    }
  }
}

function roomAccent(label: string): string {
  if (label.startsWith('CEO')) return PALETTE.accentYellow
  if (label.startsWith('ENGINEERING')) return PALETTE.mutedBlue
  if (label.startsWith('DESIGN')) return PALETTE.mutedRed
  if (label.startsWith('QA')) return PALETTE.mutedGreen
  if (label.startsWith('SERVER')) return PALETTE.serverLed
  if (label.startsWith('BREAK')) return PALETTE.softOrange
  return PALETTE.charcoal
}

// Plots a 1px-wide line of 1x1 rects between two points (tiny Bresenham).
function plotLine(g: Graphics, x0: number, y0: number, x1: number, y1: number, color: string): void {
  let dx = Math.abs(x1 - x0)
  let dy = Math.abs(y1 - y0)
  let sx = x0 < x1 ? 1 : -1
  let sy = y0 < y1 ? 1 : -1
  let err = dx - dy
  let x = x0
  let y = y0
  while (true) {
    g.rect(x, y, 1, 1).fill(color)
    if (x === x1 && y === y1) break
    const e2 = err * 2
    if (e2 > -dy) { err -= dy; x += sx }
    if (e2 < dx) { err += dx; y += sy }
  }
}
