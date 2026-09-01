// Limited, coherent pixel-art palette (spec §22). Each room reuses a small
// subset; characters use even fewer colors. All colors are flat — no gradients.
import type { AgentRole } from './types'

export const PALETTE = {
  // Surfaces / structure
  cream: '#f4ecd8',
  creamDark: '#e6dcc0',
  wood: '#a9744f',
  woodDark: '#7c5236',
  woodLight: '#c89070',
  carpet: '#c9b79c',
  carpetDark: '#b09d80',
  tile: '#d8d2c4',
  tileDark: '#c2bba8',
  serverFloor: '#3a3f4b',
  serverFloorDark: '#2c3038',
  charcoal: '#2b2b33',
  charcoalLight: '#3c3c46',
  ink: '#1c1c22',

  // Walls
  wall: '#d9c9a3',
  wallShadow: '#b8a688',
  wallTrim: '#8a7a5c',
  wallTop: '#efe2c4',

  // Accents
  mutedGreen: '#6b8f6a',
  mutedGreenDark: '#4f6f4e',
  mutedBlue: '#5b7ea8',
  mutedBlueDark: '#3f5d83',
  softOrange: '#d98a4a',
  softOrangeDark: '#b06a32',
  mutedRed: '#b5544a',
  mutedRedDark: '#8a3d34',
  accentYellow: '#e8c34a',
  accentYellowDark: '#c4a233',

  // Foliage
  leaf: '#5e8a5b',
  leafDark: '#456a43',
  pot: '#a9744f',

  // Screen / glow
  screen: '#7fb8e6',
  screenDim: '#3f6f9a',
  glow: '#ffe08a',

  // Metal / hardware
  metal: '#9aa0ad',
  metalDark: '#6b727f',
  serverLed: '#6ee39a',
  serverLedRed: '#e36e6e',

  // Character skin / hair defaults (overridden per role)
  skin: '#e8c39a',
  skinShadow: '#c89a72',
  hairBrown: '#5a3a22',
  hairDark: '#2e1d12',
  hairBlonde: '#d8b25a',
  white: '#f4ecd8',
  black: '#1c1c22',
} as const

// Per-role clothing + accessory colors. Each role reads as a distinct
// silhouette while staying inside the limited palette language. `accessory`
// / `accessoryDark` drive the role-specific gear (headphones, glasses, tool
// belt, scarf, notebook, lapel pin) drawn in AgentSprite (spec §2–§7).
export const ROLE_COLORS: Record<
  AgentRole,
  {
    shirt: string
    shirtDark: string
    pants: string
    hair: string
    accent: string
    accessory: string
    accessoryDark: string
  }
> = {
  ceo: {
    shirt: PALETTE.charcoal,
    shirtDark: PALETTE.ink,
    pants: PALETTE.woodDark,
    hair: PALETTE.hairBrown,
    accent: PALETTE.accentYellow,
    accessory: PALETTE.accentYellow, // lapel pin / star
    accessoryDark: PALETTE.accentYellowDark,
  },
  backend: {
    shirt: PALETTE.mutedBlue,
    shirtDark: PALETTE.mutedBlueDark,
    pants: PALETTE.charcoal,
    hair: PALETTE.hairDark,
    accent: PALETTE.softOrange,
    accessory: PALETTE.metal, // headphones band
    accessoryDark: PALETTE.metalDark,
  },
  frontend: {
    shirt: PALETTE.softOrange,
    shirtDark: PALETTE.softOrangeDark,
    pants: PALETTE.woodDark,
    hair: PALETTE.hairBlonde,
    accent: PALETTE.mutedBlue,
    accessory: PALETTE.mutedRed, // bright scarf
    accessoryDark: PALETTE.mutedRedDark,
  },
  qa: {
    shirt: PALETTE.mutedGreen,
    shirtDark: PALETTE.mutedGreenDark,
    pants: PALETTE.charcoal,
    hair: PALETTE.hairBrown,
    accent: PALETTE.mutedRed,
    accessory: PALETTE.metal, // glasses frame
    accessoryDark: PALETTE.ink,
  },
  designer: {
    shirt: PALETTE.mutedRed,
    shirtDark: PALETTE.mutedRedDark,
    pants: PALETTE.woodDark,
    hair: PALETTE.hairBlonde,
    accent: PALETTE.accentYellow,
    accessory: PALETTE.cream, // notebook paper
    accessoryDark: PALETTE.woodLight, // notebook cover
  },
  devops: {
    shirt: PALETTE.metalDark,
    shirtDark: PALETTE.charcoal,
    pants: PALETTE.charcoal,
    hair: PALETTE.hairDark,
    accent: PALETTE.serverLed,
    accessory: PALETTE.metalDark, // tool belt
    accessoryDark: PALETTE.charcoal,
  },
}
