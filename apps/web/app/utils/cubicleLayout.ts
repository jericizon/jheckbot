export interface CubiclePosition {
  row: number
  col: number
  left: number  // % of scene width
  top: number   // % of scene height
}

export interface SeatPosition {
  left: number
  top: number
}

// A room box drawn in the scene with a label.
export interface RoomBox {
  id: string
  label: string
  left: number   // % of scene width
  top: number    // % of scene height
  width: number  // % of scene width
  height: number // % of scene height
}

// A road segment connecting two points (used for decorative corridors).
export interface RoadSegment {
  id: string
  // Horizontal road: left → right at a fixed top
  left: number
  top: number
  width: number
  height: number
}

// Column count by viewport, capped so cubicles stay wide enough to read.
export function gridColumns(count: number, viewport: 'mobile' | 'desktop'): number {
  if (count <= 0) return 1
  if (viewport === 'mobile') return Math.min(2, count)
  return Math.min(4, count)
}

// Layout zones (percentages of scene height):
//   roomsZone:  0% – roomsEnd       (2 vacant rooms on top)
//   hallway0:   roomsEnd – topZoneStart
//   topZone:    topZoneStart – topZoneEnd   (cubicles)
//   hallway1:   topZoneEnd – midZoneStart
//   midZone:    midZoneStart – midZoneEnd   (CEO office + thinking room + road)
//   hallway2:   midZoneEnd – bottomZoneStart
//   bottomZone: bottomZoneStart – 100%      (cubicles)
const HALLWAY = 5          // % gap for each hallway
const ROOMS_END = 16       // vacant rooms band ends here
const TOP_ZONE_START = ROOMS_END + HALLWAY            // 21
const TOP_ZONE_END = 40   // top cubicles end here
const MID_ZONE_START = TOP_ZONE_END + HALLWAY         // 45
const MID_ZONE = 32       // % height of the middle band (rooms + road)
const MID_ZONE_END = MID_ZONE_START + MID_ZONE        // 77
const BOTTOM_ZONE_START = MID_ZONE_END + HALLWAY      // 82

const MID_CENTER = (MID_ZONE_START + MID_ZONE_END) / 2 // 61

// Row/col + percentage positions for `count` cells in a `cols`-wide grid.
// Cubicles are split between top and bottom zones with a hallway gap.
export function gridPositions(count: number, cols: number): CubiclePosition[] {
  if (count <= 0) return []
  const rows = Math.ceil(count / cols)
  const positions: CubiclePosition[] = []
  const topRows = Math.ceil(rows / 2)
  const bottomRows = rows - topRows

  for (let i = 0; i < count; i++) {
    const row = Math.floor(i / cols)
    const col = i % cols
    const left = ((col + 0.5) / cols) * 100

    let top: number
    if (row < topRows) {
      // Top cubicles sit below the vacant-rooms band + its hallway.
      top = TOP_ZONE_START + ((row + 0.5) / topRows) * (TOP_ZONE_END - TOP_ZONE_START)
    } else {
      const bottomRow = row - topRows
      top = BOTTOM_ZONE_START + ((bottomRow + 0.5) / bottomRows) * (100 - BOTTOM_ZONE_START)
    }

    positions.push({ row, col, left, top })
  }
  return positions
}

// Scene height grows with rows; taller to accommodate the top vacant rooms,
// hallways, and mid-zone.
export function sceneHeightFor(count: number, cols: number): string {
  if (count <= 0) return '28rem'
  const rows = Math.ceil(count / cols)
  const perRow = 13
  const base = 28
  return `${base + rows * perRow}rem`
}

// Positions for the CEO office and thinking room within the mid-zone.
// CEO is on the left, thinking room centered on screen.
export function midZoneLayout(): { ceo: SeatPosition; conference: SeatPosition } {
  return {
    ceo: { left: 12, top: MID_CENTER },
    conference: { left: 50, top: MID_CENTER },
  }
}

// Room boxes drawn as bordered areas in the scene.
// QA and Support rooms sit in a single line directly above the thinking room;
// the CEO office is on the left, thinking room is centered.
export function roomLayout(): RoomBox[] {
  return [
    {
      id: 'qa-office',
      label: 'QA',
      left: 38,
      top: 2,
      width: 11,
      height: ROOMS_END - 4,
    },
    {
      id: 'support-office',
      label: 'Support',
      left: 51,
      top: 2,
      width: 11,
      height: ROOMS_END - 4,
    },
    {
      id: 'ceo-office',
      label: 'CEO Office',
      left: 2,
      top: MID_ZONE_START + 1,
      width: 20,
      height: MID_ZONE - 2,
    },
    {
      id: 'thinking-room',
      label: '',
      left: 38,
      top: MID_ZONE_START + 1,
      width: 24,
      height: MID_ZONE - 2,
    },
  ]
}

// Walk paths connecting all rooms.
export function roadLayout(): RoadSegment[] {
  return [
    // CEO Office ↔ Thinking Room (horizontal corridor in the mid-zone)
    {
      id: 'ceo-to-thinking',
      left: 22,
      top: MID_CENTER - 2.5,
      width: 16,
      height: 5,
    },
    // QA Office ↔ Thinking Room (vertical path on the left side)
    {
      id: 'qa-to-thinking',
      left: 41,
      top: ROOMS_END,
      width: 5,
      height: MID_ZONE_START - ROOMS_END,
    },
    // Support Office ↔ Thinking Room (vertical path on the right side)
    {
      id: 'support-to-thinking',
      left: 54,
      top: ROOMS_END,
      width: 5,
      height: MID_ZONE_START - ROOMS_END,
    },
  ]
}

// Seat positions inside the thinking room for agents gathering.
// Arranged around the table in a small oval.
export function conferenceSeats(count: number): SeatPosition[] {
  if (count <= 0) return []
  const center = midZoneLayout().conference
  const seats: SeatPosition[] = []
  const radiusX = 8  // % horizontal spread
  const radiusY = 6  // % vertical spread

  for (let i = 0; i < count; i++) {
    const angle = (i / Math.max(count, 1)) * Math.PI * 2 - Math.PI / 2
    seats.push({
      left: center.left + Math.cos(angle) * radiusX,
      top: center.top + Math.sin(angle) * radiusY,
    })
  }
  return seats
}

// Hallway Y positions for decorative hallway strips.
export function hallwayPositions(): { top: number; height: number }[] {
  return [
    { top: ROOMS_END, height: HALLWAY },
    { top: TOP_ZONE_END, height: HALLWAY },
    { top: MID_ZONE_END, height: HALLWAY },
  ]
}
