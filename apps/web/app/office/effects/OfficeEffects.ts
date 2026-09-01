import { Container, Graphics, Rectangle, Sprite, type Renderer, Texture } from 'pixi.js'
import { PALETTE } from '../Palette'
import type { MessageKind, Vec2 } from '../types'

// Effects layer (spec §14): traveling message icons, message notifications,
// status effects, and speech bubbles above agents' heads. All drawn as pixel
// art — no chat UI.

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

// ---- Effects manager ----

export class OfficeEffects {
  readonly view: Container
  private envelopes: Envelope[] = []
  private notifications: Notification[] = []
  private statuses: StatusEffect[] = []
  private bubbles: SpeechBubble[] = []

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

  update(dt: number): void {
    this.updateList(this.envelopes, dt)
    this.updateList(this.notifications, dt)
    this.updateList(this.statuses, dt)
    this.updateList(this.bubbles, dt)
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
    this.envelopes = []
    this.notifications = []
    this.statuses = []
    this.bubbles = []
    this.view.removeChildren()
  }
}
