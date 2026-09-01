import { AnimatedSprite, Container, Graphics, Rectangle, type Renderer, Texture } from 'pixi.js'
import { PALETTE, ROLE_COLORS } from '../Palette'
import { CHARACTER_SHEET } from '../characters/CharacterSheet'
import type { AgentRole, AgentVisualState, Direction } from '../types'

// Procedural pixel-art characters (spec §10/§11).
//
// Each character is drawn part-by-part with flat rect fills (head, hair, face,
// torso, arms, legs) into a Graphics, then baked into a Texture per
// (state, direction, frame). AnimatedSprite cycles the frames. This keeps
// every character original, visually distinct per role, and crisp under
// nearest-neighbor scaling — no emoji, no vector illustrations.

const SPRITE_W = 16
const SPRITE_H = 18

type FrameSet = Record<Direction, Texture[]> & {
  idle: Texture[]
  seated: Texture[]
  thinking: Texture[]
  talking: Texture[]
  success: Texture[]
  error: Texture[]
  offline: Texture[]
}

export interface AgentColorSet {
  shirt: string
  shirtDark: string
  pants: string
  hair: string
  accent: string
  accessory: string
  accessoryDark: string
}

function colorsFor(role: AgentRole): AgentColorSet {
  return ROLE_COLORS[role]
}

// A single flat-fill rect operation. drawCharacterOps produces a list of
// these (pure data, no PIXI dependency) so tests can count rects and
// rasterize silhouettes without a renderer.
export interface RectOp {
  x: number
  y: number
  w: number
  h: number
  color: string
}

export type DrawState =
  | 'idle'
  | 'walk'
  | 'seated'
  | 'thinking'
  | 'talking'
  | 'success'
  | 'error'
  | 'offline'

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n))
}

// Head block width per headShape (spec §10). wide = DevOps, square = CEO/QA,
// round = Backend, oval = Frontend/Designer.
function headWidth(shape: 'round' | 'square' | 'oval' | 'wide'): number {
  switch (shape) {
    case 'wide':
      return 9
    case 'square':
      return 8
    case 'oval':
      return 7
    case 'round':
      return 7
  }
}

// Pure description of one character frame as a list of rect fills. Each role
// draws a genuinely different silhouette (spec §2–§7, §10, §11) driven by the
// CharacterSheet: heightScale (applied on the sprite container), shoulderWidth
// (torso width), headShape (head/hair block), postureOffset (head shift), and
// a role-specific accessory.
export function drawCharacterOps(
  role: AgentRole,
  state: DrawState,
  dir: Direction,
  frame: number,
): RectOp[] {
  const ops: RectOp[] = []
  const push = (x: number, y: number, w: number, h: number, color: string): void => {
    ops.push({ x, y, w, h, color })
  }

  const c = colorsFor(role)
  const skin = PALETTE.skin
  const skinSh = PALETTE.skinShadow
  const hair = c.hair
  const shirt = c.shirt
  const shirtD = c.shirtDark
  const pants = c.pants
  const accent = c.accent
  const acc = c.accessory
  const accD = c.accessoryDark
  const desaturate = state === 'offline'
  const S = (col: string) => (desaturate ? desat(col) : col)

  const sheet = CHARACTER_SHEET[role]
  const shoulderW = sheet.silhouette.shoulderWidth
  const headShape = sheet.silhouette.headShape
  const posture = sheet.silhouette.postureOffset

  // Torso width from shoulderWidth (spec §11). Base 10px; clamped to 8–12 so
  // broad roles (CEO, DevOps) read wider and slim roles (Research) narrower.
  const torsoW = clamp(Math.round(shoulderW * 11), 8, 12)
  const torsoX = Math.round((SPRITE_W - torsoW) / 2)

  // Head geometry from headShape.
  const hw = headWidth(headShape)

  // postureOffset: positive = hunched (head lower/forward), negative = upright.
  // Shift the head block down for hunched roles; clamp so hair stays in-frame.
  const postureY = clamp(Math.round(posture / 3), 0, 2)
  // Forward hunch shifts head x in the facing direction for side views.
  const hunchX = posture > 2 ? 1 : 0
  const headShiftX = dir === 'left' ? -hunchX : dir === 'right' ? hunchX : 0

  const hairY = postureY
  const faceY = 4 + postureY
  const hx = Math.round((SPRITE_W - hw) / 2) + headShiftX

  // ---- Hair (shape varies by role + direction) ----
  drawHair(push, role, dir, hx, hairY, hw, S, hair)

  // ---- Headphones band (Backend) behind/over hair ----
  if (role === 'backend') {
    drawHeadphones(push, dir, hx, hairY, hw, S, acc, accD)
  }

  // ---- Face ----
  if (dir !== 'up') {
    push(hx, faceY, hw, 4, S(skin))
    push(hx, faceY + 3, hw, 1, S(skinSh))
    // Eyes
    if (dir === 'down') {
      push(hx + 1, faceY + 2, 1, 1, S(PALETTE.ink))
      push(hx + hw - 2, faceY + 2, 1, 1, S(PALETTE.ink))
    } else if (dir === 'left') {
      push(hx, faceY + 2, 1, 1, S(PALETTE.ink))
    } else if (dir === 'right') {
      push(hx + hw - 1, faceY + 2, 1, 1, S(PALETTE.ink))
    }
    // Glasses (QA) — small frames over the eyes.
    if (role === 'qa') {
      drawGlasses(push, dir, hx, faceY, hw, S, accD)
    }
  } else {
    push(hx, faceY, hw, 4, S(skinSh))
  }

  // ---- Torso / shirt (width varies by shoulderWidth) ----
  push(torsoX, 8, torsoW, 5, S(shirt))
  push(torsoX, 12, torsoW, 1, S(shirtD))

  // Role-specific torso detailing.
  drawTorsoDetail(push, role, dir, torsoX, torsoW, S, shirt, shirtD, accent, acc, accD)

  // ---- Arms ----
  const armPhase = state === 'walk' ? frame : 0
  if (state === 'success') {
    push(torsoX - 1, 8, 1, 2, S(shirt))
    push(torsoX - 2, 6, 1, 2, S(skin))
    push(torsoX + torsoW, 8, 1, 2, S(shirt))
    push(torsoX + torsoW + 1, 6, 1, 2, S(skin))
  } else if (state === 'error') {
    push(torsoX - 2, 9, 2, 1, S(shirt))
    push(torsoX + torsoW, 9, 2, 1, S(shirt))
  } else if (state === 'seated' || state === 'talking') {
    push(torsoX - 1, 9, 2, 2, S(shirt))
    push(torsoX + torsoW - 1, 9, 2, 2, S(shirt))
    if (state === 'talking' && frame === 1) {
      push(torsoX + torsoW, 8, 1, 1, S(skin))
    }
  } else {
    push(torsoX - 1, 9, 1, 3, S(shirt))
    push(torsoX + torsoW, 9, 1, 3, S(shirt))
  }
  void armPhase

  // ---- Legs ----
  const legL = Math.round((SPRITE_W - 4) / 2)
  const legR = legL + 4
  if (state === 'seated') {
    push(legL - 1, 13, 2, 3, S(pants))
    push(legR - 1, 13, 2, 3, S(pants))
    push(legL - 1, 16, 2, 1, S(PALETTE.ink))
    push(legR - 1, 16, 2, 1, S(PALETTE.ink))
  } else if (state === 'walk') {
    if (frame === 0) {
      push(legL - 1, 13, 2, 4, S(pants))
      push(legR - 1, 13, 2, 4, S(pants))
      push(legL - 1, 17, 2, 1, S(PALETTE.ink))
      push(legR - 1, 17, 2, 1, S(PALETTE.ink))
    } else {
      push(legL - 2, 13, 2, 4, S(pants))
      push(legR, 13, 2, 4, S(pants))
      push(legL - 2, 17, 2, 1, S(PALETTE.ink))
      push(legR, 17, 2, 1, S(PALETTE.ink))
    }
  } else {
    push(legL - 1, 13, 2, 4, S(pants))
    push(legR - 1, 13, 2, 4, S(pants))
    push(legL - 1, 17, 2, 1, S(PALETTE.ink))
    push(legR - 1, 17, 2, 1, S(PALETTE.ink))
  }

  // ---- Accessories held in hand (seated/idle) ----
  drawHandAccessory(push, role, state, dir, torsoX, torsoW, S, acc, accD)

  // ---- State overlays ----
  if (state === 'thinking') {
    push(torsoX + torsoW - 1, faceY + 3, 1, 1, S(skin))
    push(torsoX + torsoW - 1, 8, 1, 1, S(skin))
    push(13, 2, 1, 1, S(PALETTE.cream))
    push(15, 0, 1, 1, S(PALETTE.cream))
  } else if (state === 'error') {
    push(13, 1, 1, 1, S(PALETTE.mutedRed))
    push(14, 2, 1, 1, S(PALETTE.mutedRed))
    push(13, 3, 1, 1, S(PALETTE.mutedRed))
  } else if (state === 'success') {
    push(13, 1, 1, 1, S(PALETTE.accentYellow))
    push(12, 2, 3, 1, S(PALETTE.accentYellow))
    push(13, 3, 1, 1, S(PALETTE.accentYellow))
  } else if (state === 'idle' && frame === 1) {
    // Blink
    push(hx + 1, faceY + 2, 1, 1, S(skin))
    push(hx + hw - 2, faceY + 2, 1, 1, S(skin))
  }

  return ops
}

type PushFn = (x: number, y: number, w: number, h: number, color: string) => void
type DesatFn = (col: string) => string

// Per-role hair blocks. CEO slicked-back (top only, no sides); Backend hood
// behind head; Frontend spiky; QA short neat; Designer side-swept; DevOps
// close-cropped under a wide head.
function drawHair(
  push: PushFn,
  role: AgentRole,
  dir: Direction,
  hx: number,
  hairY: number,
  hw: number,
  S: DesatFn,
  hair: string,
): void {
  if (dir === 'up') {
    // Back of head — full hair block (role-specific width).
    push(hx - 1, hairY, hw + 2, 5, S(hair))
    return
  }
  switch (role) {
    case 'ceo':
      // Slicked back: tight top cap, no side curtains.
      push(hx, hairY, hw, 2, S(hair))
      push(hx + 1, hairY + 2, hw - 2, 1, S(hair))
      break
    case 'backend':
      // Hood silhouette: a hood shape behind/around the head in shirtDark.
      // Hair peeks at the top front only.
      push(hx - 1, hairY, hw + 2, 2, S(hair))
      break
    case 'frontend':
      // Spiky hair: base cap + upward spikes.
      push(hx, hairY, hw, 2, S(hair))
      push(hx + 1, hairY - 1, 1, 1, S(hair))
      push(hx + 3, hairY - 1, 1, 1, S(hair))
      push(hx + 5, hairY - 1, 1, 1, S(hair))
      break
    case 'qa':
      // Short neat hair.
      push(hx, hairY, hw, 2, S(hair))
      push(hx, hairY + 2, 1, 1, S(hair))
      push(hx + hw - 1, hairY + 2, 1, 1, S(hair))
      break
    case 'designer':
      // Side-swept: asymmetric bang.
      push(hx, hairY, hw, 2, S(hair))
      push(hx, hairY + 2, 2, 1, S(hair))
      break
    case 'devops':
      // Close-cropped under wide head.
      push(hx, hairY, hw, 2, S(hair))
      break
  }
  // Side hair for left/right views.
  if (dir === 'left') push(hx, hairY + 1, 1, 3, S(hair))
  else if (dir === 'right') push(hx + hw - 1, hairY + 1, 1, 3, S(hair))
}

// Backend hoodie hood + headphones band (spec §3).
function drawHeadphones(
  push: PushFn,
  dir: Direction,
  hx: number,
  hairY: number,
  hw: number,
  S: DesatFn,
  acc: string,
  accD: string,
): void {
  // Hood: draped behind the head, slightly wider than the head block.
  push(hx - 1, hairY - 1, hw + 2, 4, S(accD))
  // Headphones band over the top of the head.
  push(hx + 1, hairY - 1, hw - 2, 1, S(acc))
  // Ear cups on the sides (visible down/left/right).
  if (dir !== 'up') {
    push(hx - 1, hairY + 2, 1, 2, S(acc))
    push(hx + hw, hairY + 2, 1, 2, S(acc))
  }
}

// QA glasses: two small frame pixels over the eyes (spec §5).
function drawGlasses(
  push: PushFn,
  dir: Direction,
  hx: number,
  faceY: number,
  hw: number,
  S: DesatFn,
  accD: string,
): void {
  if (dir === 'down') {
    push(hx, faceY + 2, 1, 1, S(accD))
    push(hx + 2, faceY + 2, 1, 1, S(accD))
    push(hx + hw - 3, faceY + 2, 1, 1, S(accD))
    push(hx + hw - 1, faceY + 2, 1, 1, S(accD))
  } else if (dir === 'left') {
    push(hx, faceY + 2, 2, 1, S(accD))
  } else if (dir === 'right') {
    push(hx + hw - 2, faceY + 2, 2, 1, S(accD))
  }
}

// Role-specific torso detailing: CEO suit lapel + tie + pin; Frontend scarf;
// DevOps work vest + tool belt.
function drawTorsoDetail(
  push: PushFn,
  role: AgentRole,
  dir: Direction,
  torsoX: number,
  torsoW: number,
  S: DesatFn,
  shirt: string,
  shirtD: string,
  accent: string,
  acc: string,
  accD: string,
): void {
  const cx = torsoX + Math.floor(torsoW / 2)
  switch (role) {
    case 'ceo':
      // Suit lapel (two dark stripes) + tie down the middle + lapel pin.
      push(cx - 2, 8, 1, 4, S(shirtD))
      push(cx + 1, 8, 1, 4, S(shirtD))
      push(cx - 1, 8, 2, 4, S(accent))
      push(cx - 1, 12, 2, 1, S(PALETTE.ink))
      if (dir === 'down') push(cx + 2, 9, 1, 1, S(acc)) // lapel pin / star
      break
    case 'frontend':
      // Bright scarf wrapped at the neck.
      push(torsoX, 8, torsoW, 1, S(acc))
      push(cx - 1, 9, 2, 1, S(accD))
      break
    case 'devops':
      // Work vest: open-front vest overlay (two side panels) over the shirt.
      push(torsoX, 8, 2, 4, S(accD))
      push(torsoX + torsoW - 2, 8, 2, 4, S(accD))
      // Tool belt at the waist.
      push(torsoX, 12, torsoW, 1, S(acc))
      push(cx - 1, 12, 1, 1, S(PALETTE.ink))
      push(cx + 1, 12, 1, 1, S(PALETTE.ink))
      break
    case 'backend':
      // Hoodie center pocket stripe.
      push(cx - 1, 10, 2, 2, S(shirtD))
      break
    case 'qa':
      // Subtle collar accent.
      push(cx - 1, 8, 2, 1, S(accent))
      break
    case 'designer':
      // Open collar.
      push(cx - 1, 8, 2, 1, S(accent))
      break
  }
}

// Accessories held in the hand when seated/idle (spec §5, §7): QA clipboard,
// Research notebook.
function drawHandAccessory(
  push: PushFn,
  role: AgentRole,
  state: DrawState,
  dir: Direction,
  torsoX: number,
  torsoW: number,
  S: DesatFn,
  acc: string,
  accD: string,
): void {
  if (dir === 'up') return
  const held = state === 'seated' || state === 'idle' || state === 'talking'
  if (!held) return
  if (role === 'qa') {
    // Clipboard/tablet in the left hand.
    push(torsoX - 2, 10, 2, 3, S(accD))
    push(torsoX - 2, 10, 2, 1, S(acc))
  } else if (role === 'designer') {
    // Notebook in the right hand.
    push(torsoX + torsoW, 10, 2, 3, S(accD))
    push(torsoX + torsoW, 10, 2, 2, S(acc))
  }
}

// Apply a list of rect ops to a PIXI Graphics.
function applyRectOps(g: Graphics, ops: RectOp[]): void {
  for (const o of ops) g.rect(o.x, o.y, o.w, o.h).fill(o.color)
}

// Rasterize rect ops into a w×h boolean grid (for silhouette hashing in tests
// that have no PIXI renderer). Returns the grid as rows of '0'/'1'.
export function rasterizeSilhouette(ops: RectOp[], w = SPRITE_W, h = SPRITE_H): string {
  const grid = new Array<string>(h)
  for (let y = 0; y < h; y++) {
    let row = ''
    for (let x = 0; x < w; x++) row += '0'
    grid[y] = row
  }
  const set = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return
    const row = grid[y]!
    grid[y] = row.slice(0, x) + '1' + row.slice(x + 1)
  }
  for (const o of ops) {
    for (let y = o.y; y < o.y + o.h; y++) {
      for (let x = o.x; x < o.x + o.w; x++) set(x, y)
    }
  }
  return grid.join('\n')
}

// Draw one character frame into a Graphics at (0,0).
function drawCharacter(
  g: Graphics,
  role: AgentRole,
  state: DrawState,
  dir: Direction,
  frame: number,
): void {
  applyRectOps(g, drawCharacterOps(role, state, dir, frame))
}

function makeTexture(renderer: Renderer, draw: (g: Graphics) => void): Texture {
  const g = new Graphics()
  draw(g)
  const tex = renderer.generateTexture({
    target: g,
    resolution: 1,
    antialias: false,
    frame: new Rectangle(0, 0, SPRITE_W, SPRITE_H),
  })
  g.destroy()
  return tex
}

function buildFrameSet(renderer: Renderer, role: AgentRole): FrameSet {
  const dirs: Direction[] = ['down', 'up', 'left', 'right']
  const walk: Record<Direction, Texture[]> = {
    down: [
      makeTexture(renderer, (g) => drawCharacter(g, role, 'walk', 'down', 0)),
      makeTexture(renderer, (g) => drawCharacter(g, role, 'walk', 'down', 1)),
    ],
    up: [
      makeTexture(renderer, (g) => drawCharacter(g, role, 'walk', 'up', 0)),
      makeTexture(renderer, (g) => drawCharacter(g, role, 'walk', 'up', 1)),
    ],
    left: [
      makeTexture(renderer, (g) => drawCharacter(g, role, 'walk', 'left', 0)),
      makeTexture(renderer, (g) => drawCharacter(g, role, 'walk', 'left', 1)),
    ],
    right: [
      makeTexture(renderer, (g) => drawCharacter(g, role, 'walk', 'right', 0)),
      makeTexture(renderer, (g) => drawCharacter(g, role, 'walk', 'right', 1)),
    ],
  }
  return {
    ...walk,
    idle: [
      makeTexture(renderer, (g) => drawCharacter(g, role, 'idle', 'down', 0)),
      makeTexture(renderer, (g) => drawCharacter(g, role, 'idle', 'down', 1)),
    ],
    seated: [
      makeTexture(renderer, (g) => drawCharacter(g, role, 'seated', 'down', 0)),
      makeTexture(renderer, (g) => drawCharacter(g, role, 'seated', 'down', 1)),
    ],
    thinking: [makeTexture(renderer, (g) => drawCharacter(g, role, 'thinking', 'down', 0))],
    talking: [
      makeTexture(renderer, (g) => drawCharacter(g, role, 'talking', 'down', 0)),
      makeTexture(renderer, (g) => drawCharacter(g, role, 'talking', 'down', 1)),
    ],
    success: [makeTexture(renderer, (g) => drawCharacter(g, role, 'success', 'down', 0))],
    error: [makeTexture(renderer, (g) => drawCharacter(g, role, 'error', 'down', 0))],
    offline: [makeTexture(renderer, (g) => drawCharacter(g, role, 'offline', 'down', 0))],
  }
}

// Map visual state -> frame set key + animation speed.
function stateToFrames(
  set: FrameSet,
  state: AgentVisualState,
  dir: Direction,
): { textures: Texture[]; fps: number; loop: boolean } {
  switch (state) {
    case 'walking':
      return { textures: set[dir], fps: 6, loop: true }
    case 'working':
    case 'coding':
    case 'testing':
    case 'reviewing':
    case 'reading':
      return { textures: set.seated, fps: 5, loop: true }
    case 'thinking':
    case 'blocked':
      return { textures: set.thinking, fps: 1, loop: false }
    case 'communicating':
    case 'meeting':
      return { textures: set.talking, fps: 4, loop: true }
    case 'waiting':
    case 'idle':
      return { textures: set.idle, fps: 1.5, loop: true }
    case 'success':
      return { textures: set.success, fps: 1, loop: false }
    case 'error':
      return { textures: set.error, fps: 1, loop: false }
    case 'offline':
      return { textures: set.offline, fps: 1, loop: false }
    default:
      return { textures: set.idle, fps: 1.5, loop: true }
  }
}

export class AgentSprite {
  readonly view: Container
  private sprite: AnimatedSprite
  private set: FrameSet
  private currentState: AgentVisualState = 'idle'
  private currentDir: Direction = 'down'

  constructor(private renderer: Renderer, private role: AgentRole) {
    this.set = buildFrameSet(renderer, role)
    const initial = stateToFrames(this.set, 'idle', 'down')
    this.sprite = new AnimatedSprite(initial.textures)
    this.sprite.anchor.set(0.5, 1.0) // feet at bottom-center of the tile
    // Per-role height scale (spec §11): taller roles read larger, shorter
    // roles smaller, while sharing the same 16×18 base art.
    this.sprite.scale.set(CHARACTER_SHEET[role].silhouette.heightScale)
    this.sprite.animationSpeed = initial.fps / 60
    this.sprite.loop = initial.loop
    this.sprite.play()
    this.view = new Container()
    this.view.addChild(this.sprite)
  }

  setState(state: AgentVisualState, dir: Direction = this.currentDir): void {
    this.currentDir = dir
    if (state === this.currentState) {
      // Direction may still change while walking.
      if (state === 'walking') this.applyFrames(state)
      return
    }
    this.currentState = state
    this.applyFrames(state)
  }

  private applyFrames(state: AgentVisualState): void {
    const { textures, fps, loop } = stateToFrames(this.set, state, this.currentDir)
    // Avoid restarting the animation if the texture set is identical.
    if (this.sprite.textures !== textures) {
      this.sprite.textures = textures
      this.sprite.animationSpeed = fps / 60
      this.sprite.loop = loop
      this.sprite.gotoAndPlay(0)
    }
  }

  setDirection(dir: Direction): void {
    if (dir === this.currentDir) return
    this.currentDir = dir
    if (this.currentState === 'walking') this.applyFrames('walking')
  }

  setPixelPosition(x: number, y: number): void {
    this.view.position.set(x, y)
  }

  getState(): AgentVisualState {
    return this.currentState
  }

  // Subtle vertical bob while idle (breathing) — handled here so the agent
  // layer stays simple.
  update(t: number): void {
    if (this.currentState === 'idle' || this.currentState === 'waiting') {
      this.view.y = Math.round(this.view.y + Math.sin(t * 2) * 0.0) // no float jitter
    }
  }
}

// Approximate desaturation for the offline state (mix toward charcoal).
function desat(hex: string): string {
  if (!hex.startsWith('#')) return hex
  const n = parseInt(hex.slice(1), 16)
  const r = (n >> 16) & 0xff
  const g = (n >> 8) & 0xff
  const b = n & 0xff
  const gray = Math.round((r + g + b) / 3)
  const mix = (c: number) => Math.round(c * 0.4 + gray * 0.6)
  const toHex = (c: number) => c.toString(16).padStart(2, '0')
  return `#${toHex(mix(r))}${toHex(mix(g))}${toHex(mix(b))}`
}
