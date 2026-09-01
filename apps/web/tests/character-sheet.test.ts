import { describe, it, expect } from 'vitest'
import { CHARACTER_SHEET } from '../app/office/characters/CharacterSheet'
import type { AgentRole } from '../app/office/types'

const ROLES: AgentRole[] = ['ceo', 'backend', 'frontend', 'qa', 'designer', 'devops']

describe('CHARACTER_SHEET', () => {
  it('contains all six roles', () => {
    for (const role of ROLES) {
      expect(CHARACTER_SHEET[role]).toBeDefined()
    }
    expect(Object.keys(CHARACTER_SHEET)).toHaveLength(6)
  })

  it('has no two roles sharing the same silhouette.heightScale', () => {
    const scales = ROLES.map((r) => CHARACTER_SHEET[r].silhouette.heightScale)
    expect(new Set(scales).size).toBe(scales.length)
  })

  it('has no two roles sharing the same accessory', () => {
    const accessories = ROLES.map((r) => CHARACTER_SHEET[r].accessory)
    expect(new Set(accessories).size).toBe(accessories.length)
  })

  it('has no two roles sharing the same walk.stride', () => {
    const strides = ROLES.map((r) => CHARACTER_SHEET[r].walk.stride)
    expect(new Set(strides).size).toBe(strides.length)
  })

  it('has no two roles sharing the same idleSequence (joined strings)', () => {
    const sequences = ROLES.map((r) => CHARACTER_SHEET[r].idleSequence.join(','))
    expect(new Set(sequences).size).toBe(sequences.length)
  })

  it('has at least 3 steps in each idleSequence', () => {
    for (const role of ROLES) {
      expect(CHARACTER_SHEET[role].idleSequence.length).toBeGreaterThanOrEqual(3)
    }
  })

  it('has at least 2 steps in each workingSequence', () => {
    for (const role of ROLES) {
      expect(CHARACTER_SHEET[role].workingSequence.length).toBeGreaterThanOrEqual(2)
    }
  })
})
