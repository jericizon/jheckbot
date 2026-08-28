import { describe, it, expect } from 'vitest'
import { gridColumns, gridPositions, sceneHeightFor } from '../app/utils/cubicleLayout'

describe('gridColumns', () => {
  it('uses 2 columns on mobile', () => {
    expect(gridColumns(5, 'mobile')).toBe(2)
  })
  it('uses up to 4 columns on desktop', () => {
    expect(gridColumns(8, 'desktop')).toBe(4)
  })
  it('caps at 4 columns even for many agents', () => {
    expect(gridColumns(20, 'desktop')).toBe(4)
  })
})

describe('gridPositions', () => {
  it('places 0 agents as an empty grid', () => {
    expect(gridPositions(0, 3)).toEqual([])
  })
  it('places 1 agent at the first cell', () => {
    const pos = gridPositions(1, 3)
    expect(pos).toHaveLength(1)
    expect(pos[0]).toMatchObject({ row: 0, col: 0 })
  })
  it('distributes 6 agents across 3 cols in 2 rows', () => {
    const pos = gridPositions(6, 3)
    expect(pos).toHaveLength(6)
    expect(pos[5]).toMatchObject({ row: 1, col: 2 })
  })
  it('left/top are percentages within 0-100', () => {
    for (const p of gridPositions(9, 3)) {
      expect(p.left).toBeGreaterThanOrEqual(0)
      expect(p.left).toBeLessThanOrEqual(100)
      expect(p.top).toBeGreaterThanOrEqual(0)
      expect(p.top).toBeLessThanOrEqual(100)
    }
  })
})

describe('sceneHeightFor', () => {
  it('returns a minimum height for 0 agents', () => {
    expect(sceneHeightFor(0, 3)).toMatch(/rem$/)
  })
  it('grows with row count', () => {
    const small = parseFloat(sceneHeightFor(3, 3))
    const large = parseFloat(sceneHeightFor(12, 3))
    expect(large).toBeGreaterThan(small)
  })
})
