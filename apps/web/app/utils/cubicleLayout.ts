export interface CubiclePosition {
  row: number
  col: number
  left: number  // % of scene width
  top: number   // % of scene height
}

// Column count by viewport, capped so cubicles stay wide enough to read.
export function gridColumns(count: number, viewport: 'mobile' | 'desktop'): number {
  if (count <= 0) return 1
  if (viewport === 'mobile') return Math.min(2, count)
  return Math.min(4, count)
}

// Row/col + percentage positions for `count` cells in a `cols`-wide grid.
// A center band is reserved for the CEO so no employee overlaps the center.
export function gridPositions(count: number, cols: number): CubiclePosition[] {
  if (count <= 0) return []
  const rows = Math.ceil(count / cols)
  const positions: CubiclePosition[] = []
  // Reserve a center band for the CEO corner office.
  const centerGap = 20 // % of scene height
  const topZone = 50 - centerGap / 2 // 40%
  const bottomZone = 50 + centerGap / 2 // 60%
  const topRows = Math.ceil(rows / 2)
  const bottomRows = rows - topRows

  for (let i = 0; i < count; i++) {
    const row = Math.floor(i / cols)
    const col = i % cols
    const left = ((col + 0.5) / cols) * 100

    let top: number
    if (row < topRows) {
      top = ((row + 0.5) / topRows) * topZone
    } else {
      const bottomRow = row - topRows
      top = bottomZone + ((bottomRow + 0.5) / bottomRows) * (100 - bottomZone)
    }

    positions.push({ row, col, left, top })
  }
  return positions
}

// Scene height grows with rows so all cubicles fit without clipping.
export function sceneHeightFor(count: number, cols: number): string {
  if (count <= 0) return '22rem'
  const rows = Math.ceil(count / cols)
  const perRow = 11
  const base = 16
  return `${base + rows * perRow}rem`
}
