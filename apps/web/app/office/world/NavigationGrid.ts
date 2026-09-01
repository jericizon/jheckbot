// Walkable navigation grid + A* pathfinding (spec §13).
// Pure logic — no PIXI — so it can be unit tested directly.
import type { Vec2 } from '../types'

export class NavigationGrid {
  readonly width: number
  readonly height: number
  private walkable: boolean[][]

  constructor(walkable: boolean[][]) {
    this.walkable = walkable
    this.height = walkable.length
    this.width = this.height === 0 ? 0 : (walkable[0]?.length ?? 0)
  }

  static fromLayout(layout: {
    width: number
    height: number
    walkable: boolean[][]
  }): NavigationGrid {
    // Copy so temporary obstacle toggles don't mutate the source layout.
    const copy = layout.walkable.map((row) => row.slice())
    return new NavigationGrid(copy)
  }

  isWalkable(x: number, y: number): boolean {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return false
    return this.walkable[y]?.[x] ?? false
  }

  setWalkable(x: number, y: number, value: boolean): void {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return
    const row = this.walkable[y]
    if (row) row[x] = value
  }

  // A* on the tile grid. 4-directional movement keeps paths aligned to the
  // grid (spec §5: "navigation paths snapped to grid"). Returns the path
  // including `start` and `end`, or null if unreachable.
  findPath(start: Vec2, end: Vec2): Vec2[] | null {
    if (!this.isWalkable(start.x, start.y) || !this.isWalkable(end.x, end.y)) {
      return null
    }
    if (start.x === end.x && start.y === end.y) return [{ ...start }]

    const idx = (x: number, y: number) => y * this.width + x
    const cameFrom = new Map<number, number>()
    const gScore = new Map<number, number>()
    const fScore = new Map<number, number>()

    const h = (x: number, y: number) =>
      Math.abs(x - end.x) + Math.abs(y - end.y)

    const startIdx = idx(start.x, start.y)
    gScore.set(startIdx, 0)
    fScore.set(startIdx, h(start.x, start.y))

    // Simple bucket-based open set (small grid; no heap needed).
    const open: number[] = [startIdx]
    const inOpen = new Set<number>([startIdx])
    const closed = new Set<number>()

    const neighbors: Array<[number, number]> = [
      [0, -1],
      [0, 1],
      [-1, 0],
      [1, 0],
    ]

    while (open.length > 0) {
      // Pick the lowest fScore in the open set.
      let bestI = 0
      let bestF = Infinity
      for (let i = 0; i < open.length; i++) {
        const f = fScore.get(open[i] ?? NaN) ?? Infinity
        if (f < bestF) {
          bestF = f
          bestI = i
        }
      }
      const current = open[bestI]
      if (current === undefined) break
      const cx = current % this.width
      const cy = Math.floor(current / this.width)

      if (cx === end.x && cy === end.y) {
        return reconstruct(cameFrom, current, this.width)
      }

      open.splice(bestI, 1)
      inOpen.delete(current)
      closed.add(current)

      for (const [dx, dy] of neighbors) {
        const nx = cx + dx
        const ny = cy + dy
        if (!this.isWalkable(nx, ny)) continue
        const nIdx = idx(nx, ny)
        if (closed.has(nIdx)) continue
        const tentative = (gScore.get(current) ?? Infinity) + 1
        if (tentative < (gScore.get(nIdx) ?? Infinity)) {
          cameFrom.set(nIdx, current)
          gScore.set(nIdx, tentative)
          fScore.set(nIdx, tentative + h(nx, ny))
          if (!inOpen.has(nIdx)) {
            open.push(nIdx)
            inOpen.add(nIdx)
          }
        }
      }
    }
    return null
  }

  // Nearest walkable tile to a given tile (used when an agent's target is
  // blocked by furniture it just walked up to).
  nearestWalkable(target: Vec2, maxRadius = 4): Vec2 | null {
    if (this.isWalkable(target.x, target.y)) return { ...target }
    for (let r = 1; r <= maxRadius; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue
          const x = target.x + dx
          const y = target.y + dy
          if (this.isWalkable(x, y)) return { x, y }
        }
      }
    }
    return null
  }
}

function reconstruct(
  cameFrom: Map<number, number>,
  current: number,
  width: number,
): Vec2[] {
  const path: Vec2[] = []
  let node: number | undefined = current
  while (node !== undefined) {
    path.push({ x: node % width, y: Math.floor(node / width) })
    node = cameFrom.get(node)
  }
  path.reverse()
  return path
}
