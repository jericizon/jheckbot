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
// Cells are centered as a block; left/top locate the cell's center point.
export function gridPositions(count: number, cols: number): CubiclePosition[] {
  if (count <= 0) return []
  const rows = Math.ceil(count / cols)
  const positions: CubiclePosition[] = []
  for (let i = 0; i < count; i++) {
    const row = Math.floor(i / cols)
    const col = i % cols
    const left = ((col + 0.5) / cols) * 100
    const top = ((row + 0.5) / rows) * 100
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
