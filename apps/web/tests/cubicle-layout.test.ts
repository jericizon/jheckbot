import { describe, it, expect } from 'vitest'
import {
  gridColumns,
  gridPositions,
  sceneHeightFor,
  midZoneLayout,
  conferenceSeats,
  hallwayPositions,
} from '../app/utils/cubicleLayout'

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

  it('never places an employee at the exact scene center', () => {
    for (const count of [1, 2, 3, 4, 5, 6, 7, 8, 9, 12]) {
      const cols = Math.min(4, count)
      const pos = gridPositions(count, cols)
      for (const p of pos) {
        // No cell should be within the center band (40-60% top)
        expect(p.top < 40 || p.top > 60).toBe(true)
        expect(p).not.toHaveProperty('top', 50)
      }
    }
  })

  it('keeps a center gap for the CEO across various headcounts', () => {
    for (const count of [1, 3, 6, 9, 12]) {
      const cols = Math.min(4, count)
      const pos = gridPositions(count, cols)
      // All positions should be either above 40% or below 60%
      for (const p of pos) {
        expect(p.top < 40 || p.top > 60).toBe(true)
      }
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

describe('midZoneLayout', () => {
  it('places CEO on the left and conference room centered on screen', () => {
    const { ceo, conference } = midZoneLayout()
    expect(ceo.left).toBeLessThan(50)
    expect(conference.left).toBe(50)
  })
  it('positions both in the middle band of the scene', () => {
    const { ceo, conference } = midZoneLayout()
    expect(ceo.top).toBeGreaterThan(40)
    expect(ceo.top).toBeLessThan(80)
    expect(conference.top).toBeGreaterThan(40)
    expect(conference.top).toBeLessThan(80)
  })
})

describe('conferenceSeats', () => {
  it('returns empty for 0 participants', () => {
    expect(conferenceSeats(0)).toEqual([])
  })
  it('places seats near the conference room center', () => {
    const seats = conferenceSeats(4)
    expect(seats).toHaveLength(4)
    const { conference } = midZoneLayout()
    for (const s of seats) {
      expect(Math.abs(s.left - conference.left)).toBeLessThan(15)
      expect(Math.abs(s.top - conference.top)).toBeLessThan(15)
    }
  })
})

describe('hallwayPositions', () => {
  it('returns hallway strips in ascending order', () => {
    const hallways = hallwayPositions()
    expect(hallways.length).toBeGreaterThanOrEqual(2)
    for (let i = 1; i < hallways.length; i++) {
      expect(hallways[i - 1].top).toBeLessThan(hallways[i].top)
    }
  })
})
