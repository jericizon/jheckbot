// Pure, PIXI-free office layout definition (spec §5/§6/§7/§8/§9).
//
// The office is a 48x32 tile grid (16px logical tiles). Rooms are "islands"
// separated by corridors, each with its own floor material and a door opening.
// Furniture is placed on non-walkable tiles. Everything is authored, not
// procedural noise (spec §4: "feel authored rather than procedurally generated").

import type { AgentRole, Vec2 } from '../types'

export const TILE = 16
export const WORLD_W = 48
export const WORLD_H = 32

export type FloorCode =
  | 'void'
  | 'wall'
  | 'carpet' // corridors
  | 'ceo'
  | 'eng'
  | 'qa'
  | 'design'
  | 'collab'
  | 'server'
  | 'break'

export interface RoomDef {
  id: string
  label: string
  floor: FloorCode
  // Interior rect (inside the walls), in tile coords.
  x: number
  y: number
  w: number
  h: number
  door: Vec2 // walkable tile at the room opening
  roles: AgentRole[]
}

export interface FurniturePlacement {
  kind: FurnitureKind
  tile: Vec2 // top-left anchor tile
  w: number
  h: number
  // Optional facing for chairs etc.
  face?: 'down' | 'up' | 'left' | 'right'
  // Label for signs/room plaques.
  label?: string
}

export type FurnitureKind =
  | 'desk'
  | 'monitor'
  | 'chair'
  | 'bookshelf'
  | 'plant'
  | 'taskBoard'
  | 'commMonitor'
  | 'meetingTable'
  | 'whiteboard'
  | 'serverRack'
  | 'coffeeMachine'
  | 'fridge'
  | 'breakTable'
  | 'bugBoard'
  | 'designBoard'
  | 'filingCabinet'
  | 'lamp'
  | 'clock'
  | 'poster'
  | 'window'
  | 'rug'
  | 'roomSign'

export interface Workstation {
  id: string
  role: AgentRole
  // Tile the agent stands/sits on (walkable, in front of the desk).
  seat: Vec2
  // Desk anchor tile (for monitor glow alignment).
  desk: Vec2
  face: 'down' | 'up' | 'left' | 'right'
}

export interface OfficeLayout {
  width: number
  height: number
  tiles: FloorCode[][] // [y][x]
  walkable: boolean[][] // [y][x]; false = wall/void/furniture
  rooms: RoomDef[]
  furniture: FurniturePlacement[]
  workstations: Workstation[]
  // Default spawn tile per role (e.g. CEO in corner office).
  spawns: Record<AgentRole, Vec2>
  // Meeting seat tiles around the collaboration table.
  meetingSeats: Vec2[]
  // Office entrance/exit door tile (spec §26/§27). Agents enter and leave
  // through this tile; it is carved walkable on the outer border wall.
  entrance: Vec2
}

interface RoomSpec {
  id: string
  label: string
  floor: FloorCode
  x: number
  y: number
  w: number
  h: number
  door: Vec2
  roles: AgentRole[]
}

// Room geometry. Interiors are inside 1-tile walls; doors sit on a perimeter
// tile and are kept walkable.
const ROOMS: RoomSpec[] = [
  {
    id: 'ceo',
    label: 'CEO OFFICE',
    floor: 'ceo',
    x: 3,
    y: 3,
    w: 8,
    h: 5,
    door: { x: 7, y: 8 },
    roles: ['ceo'],
  },
  {
    id: 'engineering',
    label: 'ENGINEERING',
    floor: 'eng',
    x: 14,
    y: 3,
    w: 15,
    h: 5,
    door: { x: 21, y: 8 },
    roles: ['backend', 'frontend'],
  },
  {
    id: 'design',
    label: 'DESIGN / FRONTEND',
    floor: 'design',
    x: 33,
    y: 3,
    w: 12,
    h: 5,
    door: { x: 38, y: 8 },
    roles: ['designer'],
  },
  {
    id: 'qa',
    label: 'QA DEPARTMENT',
    floor: 'qa',
    x: 3,
    y: 12,
    w: 8,
    h: 6,
    door: { x: 7, y: 11 },
    roles: ['qa'],
  },
  {
    id: 'collab',
    label: 'COLLABORATION',
    floor: 'collab',
    x: 14,
    y: 12,
    w: 19,
    h: 7,
    door: { x: 23, y: 11 },
    roles: [],
  },
  {
    id: 'server',
    label: 'SERVER ROOM',
    floor: 'server',
    x: 3,
    y: 23,
    w: 9,
    h: 6,
    door: { x: 7, y: 22 },
    roles: ['devops'],
  },
  {
    id: 'break',
    label: 'BREAK AREA',
    floor: 'break',
    x: 33,
    y: 23,
    w: 12,
    h: 6,
    door: { x: 38, y: 22 },
    roles: [],
  },
]

function emptyGrid<T>(w: number, h: number, fill: T): T[][] {
  const g: T[][] = []
  for (let y = 0; y < h; y++) {
    const row: T[] = []
    for (let x = 0; x < w; x++) row.push(fill)
    g.push(row)
  }
  return g
}

function inBounds(x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < WORLD_W && y < WORLD_H
}

function setTile(tiles: FloorCode[][], x: number, y: number, v: FloorCode): void {
  const row = tiles[y]
  if (row) row[x] = v
}
function setWalk(walkable: boolean[][], x: number, y: number, v: boolean): void {
  const row = walkable[y]
  if (row) row[x] = v
}
function getTile(tiles: FloorCode[][], x: number, y: number): FloorCode | undefined {
  return tiles[y]?.[x]
}

export function buildLayout(): OfficeLayout {
  const tiles = emptyGrid<FloorCode>(WORLD_W, WORLD_H, 'carpet')
  const walkable = emptyGrid<boolean>(WORLD_W, WORLD_H, true)

  // Outer void + border wall.
  for (let y = 0; y < WORLD_H; y++) {
    for (let x = 0; x < WORLD_W; x++) {
      const border = x === 0 || y === 0 || x === WORLD_W - 1 || y === WORLD_H - 1
      if (border) {
        setTile(tiles, x, y, 'wall')
        setWalk(walkable, x, y, false)
      }
    }
  }

  const rooms: RoomDef[] = []

  for (const spec of ROOMS) {
    const { x, y, w, h } = spec
    // Walls around the room perimeter (1-tile ring), interior filled with floor.
    for (let ry = y - 1; ry <= y + h; ry++) {
      for (let rx = x - 1; rx <= x + w; rx++) {
        if (!inBounds(rx, ry)) continue
        const isPerim =
          ry === y - 1 || ry === y + h || rx === x - 1 || rx === x + w
        if (isPerim) {
          setTile(tiles, rx, ry, 'wall')
          setWalk(walkable, rx, ry, false)
        } else {
          setTile(tiles, rx, ry, spec.floor)
        }
      }
    }
    // Carve the door back to walkable carpet (corridor side stays carpet).
    setTile(tiles, spec.door.x, spec.door.y, 'carpet')
    setWalk(walkable, spec.door.x, spec.door.y, true)
    // Also clear the tile just outside the door so agents can step through.
    const outside = doorOutside(spec)
    if (outside && inBounds(outside.x, outside.y)) {
      setTile(tiles, outside.x, outside.y, 'carpet')
      setWalk(walkable, outside.x, outside.y, true)
    }
    rooms.push({ ...spec })
  }

  // Carve explicit corridor rows/cols so room islands connect.
  // Horizontal corridors at rows 9-10 and 20-21.
  for (const ry of [9, 10, 20, 21]) {
    for (let x = 1; x < WORLD_W - 1; x++) {
      if (getTile(tiles, x, ry) === 'wall' && !isRoomWall(rooms, x, ry)) {
        setTile(tiles, x, ry, 'carpet')
        setWalk(walkable, x, ry, true)
      }
    }
  }
  // Vertical corridors at cols 12-13 and 30-32.
  for (const cx of [12, 13, 30, 31, 32]) {
    for (let y = 1; y < WORLD_H - 1; y++) {
      if (getTile(tiles, cx, y) === 'wall' && !isRoomWall(rooms, cx, y)) {
        setTile(tiles, cx, y, 'carpet')
        setWalk(walkable, cx, y, true)
      }
    }
  }

  const furniture = placeFurniture(rooms)
  const workstations = placeWorkstations(rooms)
  const meetingSeats = placeMeetingSeats(rooms)

  // Block solid furniture tiles from walking. Decorative pieces that sit on
  // walls or floors (posters, windows, room signs, rugs) do not obstruct
  // movement — windows/posters are on already-blocked walls and rugs are
  // walkable floor decor.
  const NON_SOLID = new Set(['poster', 'window', 'roomSign', 'rug', 'chair'])
  for (const f of furniture) {
    if (NON_SOLID.has(f.kind)) continue
    for (let fy = 0; fy < f.h; fy++) {
      for (let fx = 0; fx < f.w; fx++) {
        const tx = f.tile.x + fx
        const ty = f.tile.y + fy
        if (inBounds(tx, ty)) setWalk(walkable, tx, ty, false)
      }
    }
  }
  // Workstation seats stay walkable; desks block.
  for (const ws of workstations) {
    if (inBounds(ws.desk.x, ws.desk.y)) setWalk(walkable, ws.desk.x, ws.desk.y, false)
  }

  const spawns: Record<AgentRole, Vec2> = {
    ceo: { x: 6, y: 5 },
    backend: { x: 16, y: 5 },
    frontend: { x: 22, y: 5 },
    designer: { x: 36, y: 5 },
    qa: { x: 5, y: 14 },
    devops: { x: 5, y: 27 },
  }

  // Office entrance/exit door on the bottom border wall (spec §26/§27). Carve
  // it walkable so agents can step onto it when entering/leaving. The tile
  // above (row 30) is already carpet and connects to the corridor network.
  const entrance = { x: 23, y: WORLD_H - 1 }
  setTile(tiles, entrance.x, entrance.y, 'carpet')
  setWalk(walkable, entrance.x, entrance.y, true)

  return {
    width: WORLD_W,
    height: WORLD_H,
    tiles,
    walkable,
    rooms,
    furniture,
    workstations,
    spawns,
    meetingSeats,
    entrance,
  }
}

function doorOutside(spec: RoomSpec): Vec2 | null {
  const { door, x, y, w, h } = spec
  // Door on top edge -> outside is above; bottom -> below; etc.
  if (door.y === y - 1) return { x: door.x, y: door.y - 1 }
  if (door.y === y + h) return { x: door.x, y: door.y + 1 }
  if (door.x === x - 1) return { x: door.x - 1, y: door.y }
  if (door.x === x + w) return { x: door.x + 1, y: door.y }
  return null
}

function isRoomWall(rooms: RoomDef[], x: number, y: number): boolean {
  for (const r of rooms) {
    if (x >= r.x - 1 && x <= r.x + r.w && y >= r.y - 1 && y <= r.y + r.h) {
      const perim =
        y === r.y - 1 || y === r.y + r.h || x === r.x - 1 || x === r.x + r.w
      if (perim) return true
    }
  }
  return false
}

function placeFurniture(rooms: RoomDef[]): FurniturePlacement[] {
  const items: FurniturePlacement[] = []

  for (const r of rooms) {
    // Room sign on the wall above the door.
    items.push({
      kind: 'roomSign',
      label: r.label,
      tile: { x: r.x, y: r.y - 1 },
      w: Math.min(r.w, 8),
      h: 1,
    })
  }

  // CEO office furniture.
  items.push({ kind: 'desk', tile: { x: 4, y: 3 }, w: 3, h: 1, face: 'down' })
  items.push({ kind: 'monitor', tile: { x: 5, y: 3 }, w: 1, h: 1 })
  items.push({ kind: 'chair', tile: { x: 5, y: 5 }, w: 1, h: 1, face: 'up' })
  items.push({ kind: 'bookshelf', tile: { x: 9, y: 3 }, w: 1, h: 3 })
  items.push({ kind: 'taskBoard', tile: { x: 9, y: 6 }, w: 1, h: 1 })
  items.push({ kind: 'plant', tile: { x: 3, y: 6 }, w: 1, h: 1 })
  items.push({ kind: 'commMonitor', tile: { x: 7, y: 3 }, w: 1, h: 1 })
  items.push({ kind: 'clock', tile: { x: 3, y: 3 }, w: 1, h: 1 })

  // Engineering: three developer desks along the top wall.
  const engX = 14
  for (let i = 0; i < 3; i++) {
    const dx = engX + 1 + i * 5
    items.push({ kind: 'desk', tile: { x: dx, y: 3 }, w: 3, h: 1, face: 'down' })
    items.push({ kind: 'monitor', tile: { x: dx + 1, y: 3 }, w: 1, h: 1 })
    items.push({ kind: 'chair', tile: { x: dx + 1, y: 5 }, w: 1, h: 1, face: 'up' })
    items.push({ kind: 'lamp', tile: { x: dx, y: 3 }, w: 1, h: 1 })
    if (i === 1) items.push({ kind: 'plant', tile: { x: dx + 2, y: 6 }, w: 1, h: 1 })
  }

  // Design / Frontend.
  items.push({ kind: 'desk', tile: { x: 34, y: 3 }, w: 3, h: 1, face: 'down' })
  items.push({ kind: 'monitor', tile: { x: 35, y: 3 }, w: 1, h: 1 })
  items.push({ kind: 'chair', tile: { x: 35, y: 5 }, w: 1, h: 1, face: 'up' })
  items.push({ kind: 'designBoard', tile: { x: 39, y: 3 }, w: 2, h: 2 })
  items.push({ kind: 'bookshelf', tile: { x: 43, y: 3 }, w: 1, h: 2 })
  items.push({ kind: 'plant', tile: { x: 33, y: 6 }, w: 1, h: 1 })

  // QA department.
  items.push({ kind: 'desk', tile: { x: 4, y: 12 }, w: 3, h: 1, face: 'down' })
  items.push({ kind: 'monitor', tile: { x: 5, y: 12 }, w: 1, h: 1 })
  items.push({ kind: 'chair', tile: { x: 5, y: 14 }, w: 1, h: 1, face: 'up' })
  items.push({ kind: 'bugBoard', tile: { x: 9, y: 12 }, w: 1, h: 2 })
  items.push({ kind: 'filingCabinet', tile: { x: 9, y: 15 }, w: 1, h: 1 })
  items.push({ kind: 'plant', tile: { x: 3, y: 16 }, w: 1, h: 1 })

  // Collaboration room.
  items.push({ kind: 'meetingTable', tile: { x: 20, y: 14 }, w: 7, h: 3 })
  items.push({ kind: 'whiteboard', tile: { x: 14, y: 12 }, w: 4, h: 1 })
  items.push({ kind: 'taskBoard', tile: { x: 30, y: 12 }, w: 2, h: 1 })
  items.push({ kind: 'rug', tile: { x: 19, y: 13 }, w: 9, h: 5 })

  // Server room.
  for (let i = 0; i < 3; i++) {
    items.push({ kind: 'serverRack', tile: { x: 4 + i * 2, y: 23 }, w: 1, h: 3 })
  }
  items.push({ kind: 'serverRack', tile: { x: 10, y: 23 }, w: 1, h: 3 })
  items.push({ kind: 'plant', tile: { x: 3, y: 27 }, w: 1, h: 1 })

  // Break area.
  items.push({ kind: 'coffeeMachine', tile: { x: 33, y: 23 }, w: 2, h: 1 })
  items.push({ kind: 'fridge', tile: { x: 36, y: 23 }, w: 1, h: 2 })
  items.push({ kind: 'breakTable', tile: { x: 39, y: 25 }, w: 4, h: 2 })
  items.push({ kind: 'plant', tile: { x: 44, y: 23 }, w: 1, h: 1 })
  items.push({ kind: 'clock', tile: { x: 33, y: 27 }, w: 1, h: 1 })

  // Windows on the outer walls (decorative, drawn over border wall).
  items.push({ kind: 'window', tile: { x: 5, y: 0 }, w: 3, h: 1 })
  items.push({ kind: 'window', tile: { x: 18, y: 0 }, w: 5, h: 1 })
  items.push({ kind: 'window', tile: { x: 36, y: 0 }, w: 4, h: 1 })
  items.push({ kind: 'window', tile: { x: 0, y: 14 }, w: 1, h: 3 })
  items.push({ kind: 'window', tile: { x: 47, y: 14 }, w: 1, h: 3 })
  items.push({ kind: 'window', tile: { x: 5, y: 31 }, w: 3, h: 1 })
  items.push({ kind: 'window', tile: { x: 36, y: 31 }, w: 4, h: 1 })

  // A couple of posters in corridors.
  items.push({ kind: 'poster', tile: { x: 12, y: 9 }, w: 1, h: 1 })
  items.push({ kind: 'poster', tile: { x: 32, y: 20 }, w: 1, h: 1 })

  return items
}

function placeWorkstations(rooms: RoomDef[]): Workstation[] {
  const stations: Workstation[] = []
  // CEO
  stations.push({
    id: 'ws-ceo',
    role: 'ceo',
    seat: { x: 5, y: 5 },
    desk: { x: 5, y: 3 },
    face: 'up',
  })
  // Engineering: backend (left), frontend (middle), spare (right)
  const engX = 14
  stations.push({
    id: 'ws-backend',
    role: 'backend',
    seat: { x: engX + 2, y: 5 },
    desk: { x: engX + 2, y: 3 },
    face: 'up',
  })
  stations.push({
    id: 'ws-frontend',
    role: 'frontend',
    seat: { x: engX + 7, y: 5 },
    desk: { x: engX + 7, y: 3 },
    face: 'up',
  })
  // Design
  stations.push({
    id: 'ws-designer',
    role: 'designer',
    seat: { x: 35, y: 5 },
    desk: { x: 35, y: 3 },
    face: 'up',
  })
  // QA
  stations.push({
    id: 'ws-qa',
    role: 'qa',
    seat: { x: 5, y: 14 },
    desk: { x: 5, y: 12 },
    face: 'up',
  })
  // DevOps (server room) — seat in the clear aisle below the racks.
  stations.push({
    id: 'ws-devops',
    role: 'devops',
    seat: { x: 5, y: 27 },
    desk: { x: 5, y: 23 },
    face: 'up',
  })
  return stations
}

function placeMeetingSeats(rooms: RoomDef[]): Vec2[] {
  // Seats around the collaboration meeting table (table at x=20..26, y=14..16).
  return [
    { x: 21, y: 13 },
    { x: 23, y: 13 },
    { x: 25, y: 13 },
    { x: 21, y: 17 },
    { x: 23, y: 17 },
    { x: 25, y: 17 },
  ]
}

export function tileToPixel(tile: Vec2): Vec2 {
  return { x: tile.x * TILE, y: tile.y * TILE }
}

export function findRoomForTile(layout: OfficeLayout, tile: Vec2): RoomDef | undefined {
  return layout.rooms.find(
    (r) =>
      tile.x >= r.x && tile.x < r.x + r.w && tile.y >= r.y && tile.y < r.y + r.h,
  )
}

export function workstationForRole(
  layout: OfficeLayout,
  role: AgentRole,
): Workstation | undefined {
  return layout.workstations.find((ws) => ws.role === role)
}
