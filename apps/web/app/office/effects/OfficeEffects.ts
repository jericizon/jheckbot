import { Container, Graphics, Rectangle, Sprite, type Renderer, Texture } from 'pixi.js'
import { PALETTE } from '../Palette'
import type { ActivityKind, MessageKind, Vec2 } from '../types'

// Effects layer (spec §14): traveling message icons, message notifications,
// status effects, and speech bubbles above agents' heads. All drawn as pixel
// art — no chat UI.

// ---- Per-activity icons (persistent activity bubble, spec §16 visibility) ----
//
// Each ActivityKind gets a distinct 8x8 pixel icon so a passing viewer can
// tell what an agent is actually doing at a glance: coding, testing, reading,
// monitoring servers, etc. Drawn into the activity bubble that floats above
// working agents.

export type ActivityIcon =
  | 'code'
  | 'keyboard'
  | 'pencil'
  | 'bug'
  | 'screen'
  | 'book'
  | 'write'
  | 'thought'
  | 'search'
  | 'server'
  | 'list'
  | 'speech'

export const ACTIVITY_ICON: Record<ActivityKind, ActivityIcon> = {
  coding: 'code',
  typing: 'keyboard',
  drawing: 'pencil',
  testing: 'bug',
  monitoring: 'screen',
  reading: 'book',
  writing: 'write',
  thinking_pause: 'thought',
  board_check: 'search',
  server_check: 'server',
  task_board_read: 'list',
  communicating: 'speech',
}

export function iconForActivity(activity: ActivityKind): ActivityIcon {
  return ACTIVITY_ICON[activity]
}

// Draw a single activity icon into `g` within an 8x8 frame (origin 0,0).
// Each icon uses a distinct shape so activities are visually distinguishable.
export function drawActivityIcon(g: Graphics, icon: ActivityIcon): void {
  const ink = PALETTE.ink
  const cream = PALETTE.cream
  const blue = PALETTE.mutedBlue
  const green = PALETTE.mutedGreen
  const red = PALETTE.mutedRed
  const orange = PALETTE.softOrange
  const yellow = PALETTE.accentYellow
  switch (icon) {
    case 'code':
      // </> angle brackets.
      g.rect(1, 2, 1, 1).fill(blue)
      g.rect(2, 3, 1, 1).fill(blue)
      g.rect(3, 4, 1, 1).fill(blue)
      g.rect(4, 5, 1, 1).fill(blue)
      g.rect(5, 4, 1, 1).fill(blue)
      g.rect(6, 3, 1, 1).fill(blue)
      g.rect(7, 2, 1, 1).fill(blue)
      g.rect(2, 5, 1, 1).fill(blue)
      g.rect(6, 5, 1, 1).fill(blue)
      break
    case 'keyboard':
      // Small keyboard: base + key dots.
      g.rect(1, 4, 6, 3).fill(cream)
      g.rect(1, 4, 6, 1).fill(ink)
      g.rect(1, 6, 6, 1).fill(ink)
      g.rect(1, 4, 1, 3).fill(ink)
      g.rect(6, 4, 1, 3).fill(ink)
      g.rect(2, 5, 1, 1).fill(ink)
      g.rect(4, 5, 1, 1).fill(ink)
      g.rect(5, 5, 1, 1).fill(ink)
      // Space bar.
      g.rect(2, 5, 2, 1).fill(blue)
      break
    case 'pencil':
      // Diagonal pencil.
      g.rect(2, 1, 1, 1).fill(yellow)
      g.rect(3, 2, 1, 1).fill(yellow)
      g.rect(4, 3, 1, 1).fill(yellow)
      g.rect(5, 4, 1, 1).fill(yellow)
      g.rect(6, 5, 1, 1).fill(orange)
      g.rect(1, 2, 1, 1).fill(ink)
      g.rect(7, 6, 1, 1).fill(ink)
      break
    case 'bug':
      // Bug body + legs, with a small check overlay.
      g.rect(3, 3, 2, 3).fill(red)
      g.rect(2, 2, 4, 1).fill(red)
      g.rect(2, 4, 1, 1).fill(ink)
      g.rect(5, 4, 1, 1).fill(ink)
      g.rect(2, 6, 1, 1).fill(ink)
      g.rect(5, 6, 1, 1).fill(ink)
      g.rect(3, 2, 1, 1).fill(ink)
      g.rect(4, 2, 1, 1).fill(ink)
      // Check mark overlay (bottom-right).
      g.rect(6, 5, 1, 1).fill(green)
      g.rect(5, 6, 1, 1).fill(green)
      g.rect(7, 7, 1, 1).fill(green)
      break
    case 'screen':
      // Monitor with signal bars.
      g.rect(1, 1, 6, 5).fill(ink)
      g.rect(2, 2, 4, 3).fill(blue)
      g.rect(3, 6, 2, 1).fill(ink)
      g.rect(2, 7, 4, 1).fill(ink)
      // Signal bars inside.
      g.rect(3, 3, 1, 1).fill(green)
      g.rect(4, 3, 1, 1).fill(green)
      g.rect(5, 4, 1, 1).fill(green)
      break
    case 'book':
      // Open book.
      g.rect(1, 2, 6, 5).fill(cream)
      g.rect(1, 2, 6, 1).fill(ink)
      g.rect(1, 6, 6, 1).fill(ink)
      g.rect(1, 2, 1, 5).fill(ink)
      g.rect(6, 2, 1, 5).fill(ink)
      g.rect(4, 2, 1, 5).fill(ink)
      // Text lines.
      g.rect(2, 3, 1, 1).fill(ink)
      g.rect(2, 5, 1, 1).fill(ink)
      g.rect(5, 3, 1, 1).fill(ink)
      g.rect(5, 5, 1, 1).fill(ink)
      break
    case 'write':
      // Paper with pencil writing.
      g.rect(1, 1, 5, 6).fill(cream)
      g.rect(1, 1, 5, 1).fill(ink)
      g.rect(1, 6, 5, 1).fill(ink)
      g.rect(1, 1, 1, 6).fill(ink)
      g.rect(5, 1, 1, 6).fill(ink)
      // Text lines.
      g.rect(2, 3, 3, 1).fill(ink)
      g.rect(2, 5, 2, 1).fill(ink)
      // Pencil tip.
      g.rect(6, 2, 1, 1).fill(yellow)
      g.rect(7, 3, 1, 1).fill(yellow)
      g.rect(7, 4, 1, 1).fill(orange)
      break
    case 'thought':
      // Thought cloud: small puffs + dots.
      g.rect(2, 1, 4, 1).fill(cream)
      g.rect(1, 2, 6, 3).fill(cream)
      g.rect(2, 5, 4, 1).fill(cream)
      g.rect(1, 6, 1, 1).fill(cream)
      g.rect(6, 6, 1, 1).fill(cream)
      g.rect(3, 7, 1, 1).fill(cream)
      g.rect(5, 7, 1, 1).fill(cream)
      // Dots inside.
      g.rect(3, 3, 1, 1).fill(ink)
      g.rect(5, 3, 1, 1).fill(ink)
      g.rect(4, 4, 1, 1).fill(ink)
      break
    case 'search':
      // Magnifying glass.
      g.rect(2, 1, 3, 1).fill(blue)
      g.rect(1, 2, 1, 3).fill(blue)
      g.rect(5, 2, 1, 3).fill(blue)
      g.rect(2, 5, 3, 1).fill(blue)
      g.rect(3, 3, 1, 1).fill(cream)
      g.rect(4, 6, 1, 1).fill(ink)
      g.rect(5, 7, 1, 1).fill(ink)
      break
    case 'server':
      // Server rack with LED.
      g.rect(1, 1, 6, 6).fill(ink)
      g.rect(2, 2, 4, 1).fill(blue)
      g.rect(2, 4, 4, 1).fill(blue)
      g.rect(2, 6, 4, 1).fill(blue)
      g.rect(6, 2, 1, 1).fill(green)
      g.rect(6, 4, 1, 1).fill(green)
      g.rect(6, 6, 1, 1).fill(red)
      break
    case 'list':
      // Checklist with items + check.
      g.rect(1, 1, 6, 6).fill(cream)
      g.rect(1, 1, 6, 1).fill(ink)
      g.rect(1, 6, 6, 1).fill(ink)
      g.rect(1, 1, 1, 6).fill(ink)
      g.rect(6, 1, 1, 6).fill(ink)
      // Checkboxes.
      g.rect(2, 2, 1, 1).fill(green)
      g.rect(2, 4, 1, 1).fill(ink)
      // Lines.
      g.rect(3, 2, 3, 1).fill(ink)
      g.rect(3, 4, 3, 1).fill(ink)
      break
    case 'speech':
      // Speech bubble with dots.
      g.rect(1, 1, 6, 4).fill(cream)
      g.rect(1, 1, 6, 1).fill(ink)
      g.rect(1, 4, 6, 1).fill(ink)
      g.rect(1, 1, 1, 4).fill(ink)
      g.rect(6, 1, 1, 4).fill(ink)
      g.poly([2, 5, 4, 5, 2, 7]).fill(cream)
      g.poly([2, 5, 3, 5, 2, 6]).fill(ink)
      g.rect(2, 2, 1, 1).fill(ink)
      g.rect(4, 2, 1, 1).fill(ink)
      g.rect(6, 2, 1, 1).fill(ink)
      break
  }
}

// ---- Per-kind message icons (spec §13) ----

// Distinct icon shape per MessageKind. Each is drawn procedurally at ~8x8px.
export type MessageIcon =
  | 'envelope'
  | 'task'
  | 'question'
  | 'speech'
  | 'warning'
  | 'error'
  | 'success'
  | 'approval'
  | 'emergency'

export interface EnvelopeConfig {
  color: string
  icon: MessageIcon
  // Urgent kinds pulse (scale oscillation) while traveling.
  pulse: boolean
  // Positive kinds get a soft glow halo behind the icon.
  glow: boolean
}

export const KIND_CONFIG: Record<MessageKind, EnvelopeConfig> = {
  normal: { color: PALETTE.cream, icon: 'envelope', pulse: false, glow: false },
  task_assignment: { color: PALETTE.accentYellow, icon: 'task', pulse: false, glow: false },
  question: { color: PALETTE.mutedBlue, icon: 'question', pulse: false, glow: false },
  response: { color: PALETTE.cream, icon: 'speech', pulse: false, glow: false },
  warning: { color: PALETTE.softOrange, icon: 'warning', pulse: true, glow: false },
  error: { color: PALETTE.mutedRed, icon: 'error', pulse: true, glow: false },
  success: { color: PALETTE.mutedGreen, icon: 'success', pulse: false, glow: true },
  approval_request: { color: PALETTE.accentYellow, icon: 'approval', pulse: false, glow: true },
  emergency: { color: PALETTE.mutedRed, icon: 'emergency', pulse: true, glow: true },
}

// Testable helper: returns the distinct icon shape a kind renders.
export function iconForKind(kind: MessageKind): MessageIcon {
  return KIND_CONFIG[kind].icon
}

// Draw a single kind icon into `g` within an 8x8 frame (origin 0,0).
// Each icon uses a distinct shape so kinds are visually distinguishable.
export function drawKindIcon(g: Graphics, icon: MessageIcon, color: string): void {
  switch (icon) {
    case 'envelope':
      // Small envelope: body + flap.
      g.rect(1, 2, 6, 5).fill(color)
      g.rect(1, 2, 6, 1).fill(PALETTE.ink)
      g.rect(1, 6, 6, 1).fill(PALETTE.ink)
      g.rect(1, 2, 1, 5).fill(PALETTE.ink)
      g.rect(6, 2, 1, 5).fill(PALETTE.ink)
      g.poly([1, 3, 6, 3, 3.5, 5]).fill(color)
      g.poly([1, 3, 3.5, 5, 1, 6]).fill(PALETTE.charcoal + '33')
      break
    case 'task':
      // Document with folded corner.
      g.rect(1, 1, 6, 6).fill(color)
      g.rect(1, 1, 6, 1).fill(PALETTE.ink)
      g.rect(1, 6, 6, 1).fill(PALETTE.ink)
      g.rect(1, 1, 1, 6).fill(PALETTE.ink)
      g.rect(6, 1, 1, 6).fill(PALETTE.ink)
      // Folded corner (top-right).
      g.poly([5, 1, 7, 1, 7, 3]).fill(PALETTE.creamDark)
      g.poly([5, 1, 6, 2, 7, 3]).fill(PALETTE.ink)
      // Text lines.
      g.rect(2, 3, 3, 1).fill(PALETTE.ink)
      g.rect(2, 5, 2, 1).fill(PALETTE.ink)
      break
    case 'question':
      // Question mark '?'.
      g.rect(3, 1, 2, 1).fill(color)
      g.rect(2, 2, 4, 1).fill(color)
      g.rect(5, 3, 1, 1).fill(color)
      g.rect(4, 4, 1, 1).fill(color)
      g.rect(4, 5, 1, 1).fill(color)
      g.rect(4, 7, 1, 1).fill(color)
      break
    case 'speech':
      // Speech bubble with tail.
      g.rect(1, 1, 6, 4).fill(color)
      g.rect(1, 1, 6, 1).fill(PALETTE.ink)
      g.rect(1, 4, 6, 1).fill(PALETTE.ink)
      g.rect(1, 1, 1, 4).fill(PALETTE.ink)
      g.rect(6, 1, 1, 4).fill(PALETTE.ink)
      g.poly([2, 5, 4, 5, 2, 7]).fill(color)
      g.poly([2, 5, 3, 5, 2, 6]).fill(PALETTE.ink)
      // Dots inside.
      g.rect(2, 2, 1, 1).fill(PALETTE.ink)
      g.rect(4, 2, 1, 1).fill(PALETTE.ink)
      break
    case 'warning':
      // Warning triangle with exclamation.
      g.poly([4, 1, 7, 6, 1, 6]).fill(color)
      g.poly([4, 1, 7, 6, 1, 6]).stroke({ color: PALETTE.ink, width: 1 })
      g.rect(3.5, 3, 1, 2).fill(PALETTE.ink)
      g.rect(3.5, 5.5, 1, 1).fill(PALETTE.ink)
      break
    case 'error':
      // Red exclamation in a rounded badge.
      g.rect(1, 1, 6, 6).fill(color)
      g.rect(1, 1, 6, 1).fill(PALETTE.ink)
      g.rect(1, 6, 6, 1).fill(PALETTE.ink)
      g.rect(1, 1, 1, 6).fill(PALETTE.ink)
      g.rect(6, 1, 1, 6).fill(PALETTE.ink)
      g.rect(3.5, 2, 1, 3).fill(PALETTE.cream)
      g.rect(3.5, 5.5, 1, 1).fill(PALETTE.cream)
      break
    case 'success':
      // Green checkmark.
      g.rect(1, 4, 2, 1).fill(color)
      g.rect(3, 5, 1, 1).fill(color)
      g.rect(4, 4, 1, 1).fill(color)
      g.rect(5, 3, 1, 1).fill(color)
      g.rect(6, 2, 1, 1).fill(color)
      g.rect(5, 6, 1, 1).fill(color)
      break
    case 'approval':
      // Calendar: body with header bar.
      g.rect(1, 2, 6, 5).fill(color)
      g.rect(1, 2, 6, 1).fill(PALETTE.ink)
      g.rect(1, 6, 6, 1).fill(PALETTE.ink)
      g.rect(1, 2, 1, 5).fill(PALETTE.ink)
      g.rect(6, 2, 1, 5).fill(PALETTE.ink)
      // Header bar.
      g.rect(1, 2, 6, 2).fill(PALETTE.accentYellowDark)
      g.rect(2, 1, 1, 2).fill(PALETTE.ink)
      g.rect(5, 1, 1, 2).fill(PALETTE.ink)
      // Date dot.
      g.rect(3, 5, 2, 1).fill(PALETTE.ink)
      break
    case 'emergency':
      // Alert badge: red circle with exclamation.
      g.circle(4, 4, 3).fill(color)
      g.circle(4, 4, 3).stroke({ color: PALETTE.ink, width: 1 })
      g.rect(3.5, 2, 1, 3).fill(PALETTE.cream)
      g.rect(3.5, 5.5, 1, 1).fill(PALETTE.cream)
      break
  }
}

// ---- Traveling message icon ----

class Envelope {
  readonly view: Container
  private from: Vec2
  private to: Vec2
  private t = 0
  private duration: number
  private arc: number
  private _done = false
  private onArrive?: () => void
  private cfg: EnvelopeConfig
  private elapsed = 0

  constructor(renderer: Renderer, from: Vec2, to: Vec2, kind: MessageKind, onArrive?: () => void) {
    this.from = { ...from }
    this.to = { ...to }
    this.onArrive = onArrive
    this.cfg = KIND_CONFIG[kind]
    const dist = Math.hypot(to.x - from.x, to.y - from.y)
    this.duration = Math.max(0.5, dist / 220) // pixels per second
    this.arc = Math.min(24, dist * 0.18)

    this.view = new Container()
    // Glow halo behind the icon for positive kinds.
    if (this.cfg.glow) {
      const glow = new Graphics()
      glow.circle(4, 4, 6).fill({ color: this.cfg.color, alpha: 0.25 })
      const glowTex = renderer.generateTexture({
        target: glow,
        resolution: 1,
        antialias: false,
        frame: new Rectangle(0, 0, 12, 12),
      })
      glow.destroy()
      const glowSprite = new Sprite(glowTex)
      glowSprite.anchor.set(0.5, 0.5)
      glowSprite.position.set(0, 0)
      this.view.addChild(glowSprite)
    }
    const g = new Graphics()
    drawKindIcon(g, this.cfg.icon, this.cfg.color)
    const tex = renderer.generateTexture({
      target: g,
      resolution: 1,
      antialias: false,
      frame: new Rectangle(0, 0, 8, 8),
    })
    g.destroy()
    const sprite = new Sprite(tex)
    sprite.anchor.set(0.5, 0.5)
    this.view.addChild(sprite)
    this.view.position.set(from.x, from.y)
  }

  get done(): boolean {
    return this._done
  }

  update(dt: number): void {
    if (this._done) return
    this.elapsed += dt
    this.t += dt / this.duration
    if (this.t >= 1) {
      this.t = 1
      this._done = true
      this.view.position.set(this.to.x, this.to.y)
      this.onArrive?.()
      return
    }
    const x = this.from.x + (this.to.x - this.from.x) * this.t
    const y = this.from.y + (this.to.y - this.from.y) * this.t - Math.sin(this.t * Math.PI) * this.arc
    this.view.position.set(Math.round(x), Math.round(y))
    // Urgent kinds pulse (fast scale oscillation).
    if (this.cfg.pulse) {
      const s = 1 + Math.sin(this.elapsed * 12) * 0.18
      this.view.scale.set(s, s)
    }
  }

  destroy(): void {
    this.view.destroy({ children: true })
  }
}

// ---- Notification bubble (brief "incoming message" pop above an agent) ----

class Notification {
  readonly view: Container
  private life = 0
  private readonly ttl: number

  constructor(renderer: Renderer, at: Vec2, kind: MessageKind) {
    this.ttl = 1.4
    const cfg = KIND_CONFIG[kind]
    const g = new Graphics()
    // Bubble
    g.rect(0, 0, 10, 8).fill(PALETTE.cream)
    g.rect(0, 0, 10, 1).fill(PALETTE.ink)
    g.rect(0, 7, 10, 1).fill(PALETTE.ink)
    g.rect(0, 0, 1, 8).fill(PALETTE.ink)
    g.rect(9, 0, 1, 8).fill(PALETTE.ink)
    g.poly([3, 8, 6, 8, 4, 11]).fill(PALETTE.cream)
    // Dot color by kind
    g.rect(2, 3, 2, 2).fill(cfg.color)
    g.rect(5, 2, 1, 1).fill(PALETTE.ink)
    g.rect(7, 2, 1, 1).fill(PALETTE.ink)
    const tex = renderer.generateTexture({
      target: g,
      resolution: 1,
      antialias: false,
      frame: new Rectangle(0, 0, 10, 12),
    })
    g.destroy()
    const sprite = new Sprite(tex)
    sprite.anchor.set(0.5, 1.0)
    this.view = new Container()
    this.view.addChild(sprite)
    this.view.position.set(at.x, at.y)
  }

  get done(): boolean {
    return this.life >= this.ttl
  }

  update(dt: number): void {
    this.life += dt
    // Bounce in then fade out.
    const p = this.life / this.ttl
    if (p < 0.2) {
      this.view.scale.set(0.6 + p * 2)
    } else {
      this.view.scale.set(1)
    }
    if (p > 0.7) this.view.alpha = Math.max(0, 1 - (p - 0.7) / 0.3)
  }

  destroy(): void {
    this.view.destroy({ children: true })
  }
}

// ---- Status effect (floating icon above an agent for a state) ----

export type StatusIcon = 'thinking' | 'success' | 'error' | 'blocked' | 'review'

class StatusEffect {
  readonly view: Container
  private life = 0
  private readonly ttl: number

  constructor(renderer: Renderer, at: Vec2, icon: StatusIcon, ttl = 2) {
    this.ttl = ttl
    const g = new Graphics()
    drawStatusIcon(g, icon)
    const tex = renderer.generateTexture({
      target: g,
      resolution: 1,
      antialias: false,
      frame: new Rectangle(0, 0, 8, 8),
    })
    g.destroy()
    const sprite = new Sprite(tex)
    sprite.anchor.set(0.5, 0.5)
    this.view = new Container()
    this.view.addChild(sprite)
    this.view.position.set(at.x, at.y)
  }

  get done(): boolean {
    return this.life >= this.ttl
  }

  update(dt: number): void {
    this.life += dt
    this.view.y -= dt * 4 // float upward
    const p = this.life / this.ttl
    if (p > 0.6) this.view.alpha = Math.max(0, 1 - (p - 0.6) / 0.4)
  }

  destroy(): void {
    this.view.destroy({ children: true })
  }
}

function drawStatusIcon(g: Graphics, icon: StatusIcon): void {
  switch (icon) {
    case 'thinking':
      g.rect(3, 0, 2, 2).fill(PALETTE.cream)
      g.rect(0, 2, 3, 2).fill(PALETTE.cream)
      g.rect(5, 2, 3, 2).fill(PALETTE.cream)
      break
    case 'success':
      g.rect(0, 3, 2, 2).fill(PALETTE.mutedGreen)
      g.rect(2, 5, 2, 2).fill(PALETTE.mutedGreen)
      g.rect(4, 1, 2, 2).fill(PALETTE.mutedGreen)
      g.rect(6, 3, 2, 2).fill(PALETTE.mutedGreen)
      break
    case 'error':
      g.rect(2, 2, 4, 4).fill(PALETTE.mutedRed)
      g.rect(3, 3, 2, 2).fill(PALETTE.cream)
      break
    case 'blocked':
      g.rect(1, 1, 6, 6).fill(PALETTE.softOrange)
      g.rect(3, 3, 2, 2).fill(PALETTE.ink)
      break
    case 'review':
      g.rect(2, 1, 4, 4).fill(PALETTE.mutedBlue)
      g.rect(3, 2, 2, 2).fill(PALETTE.cream)
      g.rect(3, 6, 2, 1).fill(PALETTE.ink)
      break
  }
}

// ---- Speech bubble (physical conversation indicator, spec §14) ----

class SpeechBubble {
  readonly view: Container
  private life = 0
  private readonly ttl: number

  constructor(renderer: Renderer, at: Vec2, duration: number) {
    this.ttl = duration
    const g = new Graphics()
    // Small speech bubble with tail.
    g.rect(0, 0, 8, 6).fill(PALETTE.cream)
    g.rect(0, 0, 8, 1).fill(PALETTE.ink)
    g.rect(0, 5, 8, 1).fill(PALETTE.ink)
    g.rect(0, 0, 1, 6).fill(PALETTE.ink)
    g.rect(7, 0, 1, 6).fill(PALETTE.ink)
    g.poly([2, 6, 4, 6, 2, 8]).fill(PALETTE.cream)
    g.poly([2, 6, 3, 6, 2, 7]).fill(PALETTE.ink)
    // Talking dots.
    g.rect(2, 2, 1, 1).fill(PALETTE.ink)
    g.rect(4, 2, 1, 1).fill(PALETTE.ink)
    g.rect(6, 2, 1, 1).fill(PALETTE.ink)
    const tex = renderer.generateTexture({
      target: g,
      resolution: 1,
      antialias: false,
      frame: new Rectangle(0, 0, 9, 9),
    })
    g.destroy()
    const sprite = new Sprite(tex)
    sprite.anchor.set(0.5, 1.0)
    this.view = new Container()
    this.view.addChild(sprite)
    this.view.position.set(at.x, at.y)
  }

  get done(): boolean {
    return this.life >= this.ttl
  }

  update(dt: number): void {
    this.life += dt
    // Gentle bob while active, then fade out over the last 25%.
    this.view.y += Math.sin(this.life * 6) * dt * 2
    const p = this.life / this.ttl
    if (p > 0.75) this.view.alpha = Math.max(0, 1 - (p - 0.75) / 0.25)
  }

  destroy(): void {
    this.view.destroy({ children: true })
  }
}

// ---- Group chat bubble (collaboration chit-chat) ----
//
// A larger, more visible speech bubble with animated talking dots that cycle
// through patterns. Used during the collaboration room chit-chat so it feels
// like a real group conversation — multiple bubbles are visible at once.

class ChatBubble {
  readonly view: Container
  private life = 0
  private readonly ttl: number
  private dots: Sprite
  private dotTex: Texture[]
  private time = 0

  constructor(renderer: Renderer, at: Vec2, duration: number) {
    this.ttl = duration
    const W = 14
    const H = 10

    // Bubble background with tail.
    const bg = new Graphics()
    bg.rect(0, 0, W, H).fill(PALETTE.cream)
    bg.rect(0, 0, W, 1).fill(PALETTE.ink)
    bg.rect(0, H - 1, W, 1).fill(PALETTE.ink)
    bg.rect(0, 0, 1, H).fill(PALETTE.ink)
    bg.rect(W - 1, 0, 1, H).fill(PALETTE.ink)
    // Tail pointing down.
    bg.poly([5, H, 8, H, 5, H + 3]).fill(PALETTE.cream)
    bg.poly([5, H, 6, H, 5, H + 2]).fill(PALETTE.ink)
    bg.rect(4, H, 1, 1).fill(PALETTE.ink)
    bg.rect(8, H, 1, 1).fill(PALETTE.ink)
    const bgTex = renderer.generateTexture({
      target: bg,
      resolution: 1,
      antialias: false,
      frame: new Rectangle(0, 0, W + 2, H + 4),
    })
    bg.destroy()
    const bgSprite = new Sprite(bgTex)
    bgSprite.anchor.set(0.5, 1.0)
    this.view = new Container()
    this.view.addChild(bgSprite)

    // Animated talking dots — 3 frames of dot patterns.
    this.dotTex = []
    const dotFrames: Array<[number, number][]> = [
      [[3, 4], [6, 4], [9, 4]], // all dots
      [[4, 4], [7, 4], [10, 4]], // shifted right
      [[3, 3], [6, 5], [9, 3]], // varied heights
    ]
    for (const frame of dotFrames) {
      const dg = new Graphics()
      for (const [dx, dy] of frame) dg.rect(dx, dy, 2, 2).fill(PALETTE.ink)
      const tex = renderer.generateTexture({
        target: dg,
        resolution: 1,
        antialias: false,
        frame: new Rectangle(0, 0, W, H),
      })
      dg.destroy()
      this.dotTex.push(tex)
    }
    this.dots = new Sprite(this.dotTex[0]!)
    this.dots.anchor.set(0.5, 0.5)
    this.dots.position.set(0, -H / 2)
    this.view.addChild(this.dots)

    this.view.position.set(at.x, at.y)
    this.view.scale.set(0.3) // pop-in
  }

  setPosition(p: Vec2): void {
    this.view.position.set(p.x, p.y)
  }

  get done(): boolean {
    return this.life >= this.ttl
  }

  update(dt: number): void {
    this.life += dt
    this.time += dt
    // Pop-in scale.
    const scale = Math.min(1, this.view.scale.x + dt * 6)
    this.view.scale.set(scale)
    // Animate talking dots every 0.25s.
    const frame = Math.floor(this.time / 0.25) % this.dotTex.length
    const tex = this.dotTex[frame]
    if (tex && this.dots.texture !== tex) this.dots.texture = tex
    // Gentle bob.
    this.view.y += Math.sin(this.time * 5) * dt * 1.5
    // Fade out over the last 20%.
    const p = this.life / this.ttl
    if (p > 0.8) this.view.alpha = Math.max(0, 1 - (p - 0.8) / 0.2)
  }

  destroy(): void {
    for (const t of this.dotTex) t.destroy(true)
    this.view.destroy({ children: true })
  }
}

// ---- Persistent activity bubble (spec §16 visibility) ----
//
// A small thought-style bubble that floats above a working agent's head and
// stays visible for as long as the agent is in a working visual state. It
// shows a distinct pixel icon per ActivityKind so a viewer can tell at a
// glance what the agent is doing: coding, testing, reading, monitoring, etc.
// The bubble follows the agent's head position (updated each tick by the
// manager) and gently bobs. A short pop-in scale animation plays on appear.

class ActivityBubble {
  readonly view: Container
  private icon: ActivityIcon
  private time = 0
  private popIn = 0 // 0..1 pop-in progress
  private iconTex: Texture

  constructor(renderer: Renderer, icon: ActivityIcon) {
    this.icon = icon
    this.view = new Container()
    // Bubble background: rounded-ish rect with a tiny tail puff.
    const bg = new Graphics()
    const W = 12
    const H = 10
    bg.rect(0, 0, W, H).fill(PALETTE.cream)
    bg.rect(0, 0, W, 1).fill(PALETTE.ink)
    bg.rect(0, H - 1, W, 1).fill(PALETTE.ink)
    bg.rect(0, 0, 1, H).fill(PALETTE.ink)
    bg.rect(W - 1, 0, 1, H).fill(PALETTE.ink)
    // Tail: small puff below the bubble.
    bg.rect(4, H, 2, 1).fill(PALETTE.cream)
    bg.rect(4, H, 2, 1).fill(PALETTE.ink)
    bg.rect(3, H, 1, 1).fill(PALETTE.ink)
    bg.rect(6, H, 1, 1).fill(PALETTE.ink)
    const bgTex = renderer.generateTexture({
      target: bg,
      resolution: 1,
      antialias: false,
      frame: new Rectangle(0, 0, W + 2, H + 2),
    })
    bg.destroy()
    const bgSprite = new Sprite(bgTex)
    bgSprite.anchor.set(0.5, 1.0) // tail points down at the agent
    this.view.addChild(bgSprite)

    // Activity icon centered inside the bubble.
    const iconG = new Graphics()
    drawActivityIcon(iconG, icon)
    this.iconTex = renderer.generateTexture({
      target: iconG,
      resolution: 1,
      antialias: false,
      frame: new Rectangle(0, 0, 8, 8),
    })
    iconG.destroy()
    const iconSprite = new Sprite(this.iconTex)
    iconSprite.anchor.set(0.5, 0.5)
    iconSprite.position.set(0, -H / 2)
    this.view.addChild(iconSprite)

    this.view.scale.set(0.1) // start small for pop-in
  }

  setPosition(p: Vec2): void {
    this.view.position.set(p.x, p.y)
  }

  updateIcon(renderer: Renderer, icon: ActivityIcon): void {
    if (icon === this.icon) return
    this.icon = icon
    const g = new Graphics()
    drawActivityIcon(g, icon)
    const tex = renderer.generateTexture({
      target: g,
      resolution: 1,
      antialias: false,
      frame: new Rectangle(0, 0, 8, 8),
    })
    g.destroy()
    this.iconTex.destroy(true)
    const sprite = this.view.children[1] as Sprite
    sprite.texture = tex
    this.iconTex = tex
  }

  update(dt: number): void {
    this.time += dt
    if (this.popIn < 1) {
      this.popIn = Math.min(1, this.popIn + dt * 5)
      const s = 0.1 + 0.9 * easeOutBack(this.popIn)
      this.view.scale.set(s)
    }
    // Gentle vertical bob (±1px).
    this.view.y += Math.sin(this.time * 3) * dt * 1.5
  }

  destroy(): void {
    this.view.destroy({ children: true })
  }
}

function easeOutBack(t: number): number {
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
}

// ---- Confetti burst (task completion celebration) ----

// A burst of pixel-art confetti pieces that explode upward from a point,
// arc under gravity, spin, and fade out. Used when a task is completed.
class ConfettiPiece {
  readonly view: Container
  private vx: number
  private vy: number
  private rotSpeed: number
  private life = 0
  private readonly ttl: number
  private readonly gravity: number
  private sprite: Sprite

  constructor(renderer: Renderer, origin: Vec2, color: string) {
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.9
    const speed = 60 + Math.random() * 90
    this.vx = Math.cos(angle) * speed
    this.vy = Math.sin(angle) * speed
    this.rotSpeed = (Math.random() - 0.5) * 12
    this.ttl = 1.6 + Math.random() * 0.8
    this.gravity = 220

    // 2x3 pixel rect piece.
    const g = new Graphics()
    g.rect(0, 0, 2, 3).fill(color)
    const tex = renderer.generateTexture({
      target: g,
      resolution: 1,
      antialias: false,
      frame: new Rectangle(0, 0, 2, 3),
    })
    g.destroy()
    this.sprite = new Sprite(tex)
    this.sprite.anchor.set(0.5, 0.5)
    this.view = new Container()
    this.view.addChild(this.sprite)
    this.view.position.set(origin.x, origin.y)
  }

  get done(): boolean {
    return this.life >= this.ttl
  }

  update(dt: number): void {
    this.life += dt
    this.vy += this.gravity * dt
    this.view.x += this.vx * dt
    this.view.y += this.vy * dt
    this.sprite.rotation += this.rotSpeed * dt
    const p = this.life / this.ttl
    if (p > 0.7) this.view.alpha = Math.max(0, 1 - (p - 0.7) / 0.3)
  }

  destroy(): void {
    this.view.destroy({ children: true })
  }
}

class ConfettiBurst {
  readonly view: Container
  private pieces: ConfettiPiece[] = []
  private _done = false

  constructor(renderer: Renderer, at: Vec2, count = 40) {
    this.view = new Container()
    const colors = [
      PALETTE.accentYellow,
      PALETTE.mutedGreen,
      PALETTE.mutedBlue,
      PALETTE.softOrange,
      PALETTE.mutedRed,
      PALETTE.cream,
    ]
    for (let i = 0; i < count; i++) {
      const color = colors[i % colors.length] ?? PALETTE.cream
      const piece = new ConfettiPiece(renderer, at, color)
      this.pieces.push(piece)
      this.view.addChild(piece.view)
    }
  }

  get done(): boolean {
    return this._done
  }

  update(dt: number): void {
    let allDone = true
    for (const p of this.pieces) {
      p.update(dt)
      if (!p.done) allDone = false
    }
    this._done = allDone
  }

  destroy(): void {
    for (const p of this.pieces) p.destroy()
    this.pieces = []
    this.view.destroy({ children: true })
  }
}

// ---- Effects manager ----

export class OfficeEffects {
  readonly view: Container
  private envelopes: Envelope[] = []
  private notifications: Notification[] = []
  private statuses: StatusEffect[] = []
  private bubbles: SpeechBubble[] = []
  private chatBubbles: ChatBubble[] = []
  private confettiBursts: ConfettiBurst[] = []
  // Persistent activity bubbles keyed by agent id (spec §16 visibility).
  private activityBubbles = new Map<string, ActivityBubble>()

  constructor(private renderer: Renderer) {
    this.view = new Container()
  }

  // Fly a message icon from -> to (pixel coords). onArrive fires when it lands.
  sendEnvelope(from: Vec2, to: Vec2, kind: MessageKind, onArrive?: () => void): void {
    const env = new Envelope(this.renderer, from, to, kind, onArrive)
    this.envelopes.push(env)
    this.view.addChild(env.view)
  }

  popNotification(at: Vec2, kind: MessageKind): void {
    const n = new Notification(this.renderer, at, kind)
    this.notifications.push(n)
    this.view.addChild(n.view)
  }

  showStatus(at: Vec2, icon: StatusIcon, ttl?: number): void {
    const s = new StatusEffect(this.renderer, at, icon, ttl)
    this.statuses.push(s)
    this.view.addChild(s.view)
  }

  // Speech bubble above an agent's head for a physical conversation (spec §14).
  speechBubble(position: Vec2, duration: number): void {
    const b = new SpeechBubble(this.renderer, position, duration)
    this.bubbles.push(b)
    this.view.addChild(b.view)
  }

  // Larger animated chat bubble for the collaboration chit-chat. Multiple
  // can be active at once so it feels like a group conversation.
  chatBubble(position: Vec2, duration: number): void {
    const b = new ChatBubble(this.renderer, position, duration)
    this.chatBubbles.push(b)
    this.view.addChild(b.view)
  }

  // Confetti celebration burst at a pixel position (task completion).
  confetti(at: Vec2, count?: number): void {
    const burst = new ConfettiBurst(this.renderer, at, count)
    this.confettiBursts.push(burst)
    this.view.addChild(burst.view)
  }

  // Show or update a persistent activity bubble for an agent. Creates the
  // bubble if none exists for `agentId`; updates the icon if the activity
  // changed; repositions it above the agent's head each call. Pass `null` as
  // the activity to hide the bubble.
  setActivityBubble(agentId: string, headPos: Vec2, activity: ActivityKind | null): void {
    if (activity === null) {
      this.hideActivityBubble(agentId)
      return
    }
    const icon = ACTIVITY_ICON[activity]
    const existing = this.activityBubbles.get(agentId)
    if (existing) {
      existing.updateIcon(this.renderer, icon)
      existing.setPosition(headPos)
    } else {
      const b = new ActivityBubble(this.renderer, icon)
      b.setPosition(headPos)
      this.activityBubbles.set(agentId, b)
      this.view.addChild(b.view)
    }
  }

  hideActivityBubble(agentId: string): void {
    const b = this.activityBubbles.get(agentId)
    if (!b) return
    this.view.removeChild(b.view)
    b.destroy()
    this.activityBubbles.delete(agentId)
  }

  get activeActivityBubbles(): number {
    return this.activityBubbles.size
  }

  update(dt: number): void {
    this.updateList(this.envelopes, dt)
    this.updateList(this.notifications, dt)
    this.updateList(this.statuses, dt)
    this.updateList(this.bubbles, dt)
    this.updateList(this.chatBubbles, dt)
    this.updateList(this.confettiBursts, dt)
    for (const b of this.activityBubbles.values()) b.update(dt)
  }

  private updateList<T extends { update: (dt: number) => void; done: boolean; destroy: () => void; view: Container }>(
    list: T[],
    dt: number,
  ): void {
    for (let i = list.length - 1; i >= 0; i--) {
      const item = list[i]
      if (!item) continue
      item.update(dt)
      if (item.done) {
        this.view.removeChild(item.view)
        item.destroy()
        list.splice(i, 1)
      }
    }
  }

  clear(): void {
    for (const e of this.envelopes) e.destroy()
    for (const n of this.notifications) n.destroy()
    for (const s of this.statuses) s.destroy()
    for (const b of this.bubbles) b.destroy()
    for (const c of this.chatBubbles) c.destroy()
    for (const c of this.confettiBursts) c.destroy()
    for (const b of this.activityBubbles.values()) b.destroy()
    this.envelopes = []
    this.notifications = []
    this.statuses = []
    this.bubbles = []
    this.chatBubbles = []
    this.confettiBursts = []
    this.activityBubbles.clear()
    this.view.removeChildren()
  }
}
