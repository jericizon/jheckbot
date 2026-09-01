import type { AgentRole, TaskDescriptor, Vec2 } from '../types'
import type { OfficeDirector } from './OfficeDirector'

// Scripted collaboration choreography triggered by a prompt.
//
// Uses ONLY the existing (already-spawned) characters — no new agents are
// created. Participating roles: CEO, Engineering (backend + frontend), and QA.
//
// Flow:
//   1. Existing CEO/Eng/QA characters gather in the COLLABORATION room for a chit-chat.
//   2. Everyone returns to their respective rooms/workstations.
//   3. Engineering agents work in parallel; QA works last (reviewing).
//   4. QA walks to the CEO office to report.
//   5. Confetti celebrates the completed task.
//
// Drives the office purely through the OfficeDirector API, so it is fully
// testable with a recording fake (no PIXI renderer required).

// Only these roles participate in the collaboration.
const PARTICIPATING_ROLES: AgentRole[] = ['ceo', 'backend', 'frontend', 'qa']

const COLLAB_TASK: TaskDescriptor = {
  id: 'task-collab-1',
  title: 'Ship the new feature',
  description: 'Collaborate, build, then QA before reporting to the CEO',
  status: 'queued',
  priority: 'high',
}

// Role -> working visual state for the parallel work phase. CEO and QA are
// excluded (CEO waits in their office; QA works last).
const WORK_STATE: Partial<Record<AgentRole, 'coding' | 'working' | 'reviewing' | 'testing'>> = {
  backend: 'coding',
  frontend: 'coding',
}

// A walkable tile inside the CEO office for QA to stand at when reporting.
const CEO_OFFICE_REPORT_TILE = { x: 7, y: 6 }

// The collaboration room door — everyone gathers here before dispersing so
// they visually leave the room together rather than trickling out one by one.
const COLLAB_DOOR_TILE = { x: 23, y: 11 }

// Tiles just outside the collaboration room door where agents wait for the
// group before heading to their workstations. Staggered so they don't overlap.
const EXIT_STAGING_TILES: Vec2[] = [
  { x: 23, y: 10 },
  { x: 22, y: 10 },
  { x: 24, y: 10 },
  { x: 23, y: 9 },
]

export interface CollaborationTimelineOptions {
  speed?: number
}

export class CollaborationTimeline {
  private running = false
  private cancelled = false
  private speed = 1
  // Resolved participant ids (role -> agentId), discovered from the director.
  private participants: AgentRole[] = []

  constructor(private director: OfficeDirector, options: CollaborationTimelineOptions = {}) {
    this.speed = options.speed ?? 1
  }

  get isRunning(): boolean {
    return this.running
  }

  cancel(): void {
    this.cancelled = true
  }

  async run(): Promise<void> {
    if (this.running) return
    this.running = true
    this.cancelled = false
    try {
      this.discoverParticipants()
      if (this.participants.length === 0) return
      this.director.createTask(COLLAB_TASK)
      await this.delay(300)
      await this.workflow()
    } finally {
      this.running = false
    }
  }

  // Find which participating roles actually have live agents in the office.
  private discoverParticipants(): void {
    this.participants = PARTICIPATING_ROLES.filter((role) =>
      this.director.agentIdForRole(role) !== undefined,
    )
  }

  private idForRole(role: AgentRole): string | undefined {
    return this.director.agentIdForRole(role)
  }

  private async workflow(): Promise<void> {
    const d = this.director
    const ids = this.participants
      .map((r) => this.idForRole(r))
      .filter((id): id is string => id !== undefined)
    const qaId = this.idForRole('qa')
    const ceoId = this.idForRole('ceo')

    // 1. Everyone gathers in the collaboration room.
    await this.gather(ids)
    this.director.updateTask({ ...COLLAB_TASK, status: 'planning' })
    await this.delay(300)

    // 2. Chit-chat: round-robin speech bubbles around the table.
    await this.chitChat(ids)
    await this.delay(200)

    // 3. Everyone leaves the collaboration room together and heads to their
    //    respective workstations. Engineering agents start working immediately
    //    upon arrival; CEO and QA go idle at their stations.
    this.director.updateTask({ ...COLLAB_TASK, status: 'in_progress' })
    const workerIds = ids.filter((id) => {
      const role = this.roleFor(id)
      return role === 'backend' || role === 'frontend'
    })
    await this.disperseAndWork(ids, workerIds)
    await this.delay(600)

    // 5. QA works last (reviewing).
    if (qaId) {
      await d.workAt(qaId, 'reviewing')
      this.director.updateTask({ ...COLLAB_TASK, status: 'review' })
      await this.delay(900)
      d.succeed(qaId)
    }

    // 6. QA walks to the CEO office to report.
    if (qaId) {
      await d.walk(qaId, CEO_OFFICE_REPORT_TILE)
      if (ceoId) await d.message(qaId, ceoId, 'success')
      this.director.updateTask({ ...COLLAB_TASK, status: 'completed' })
      await this.delay(300)
    }

    // 7. Confetti celebrates the completed task.
    d.confetti(CEO_OFFICE_REPORT_TILE)
    if (ceoId) d.succeed(ceoId)
    await this.delay(600)

    // Settle everyone back to idle.
    for (const id of ids) d.idle(id)
  }

  // Walk every agent to a meeting seat in the collaboration room.
  private async gather(ids: string[]): Promise<void> {
    await Promise.all(
      ids.map((id, index) => this.director.walk(id, this.director.meetingSeat(index))),
    )
  }

  // Group chit-chat: overlapping animated chat bubbles so the collaboration
  // room feels like a real conversation. Each round, a few agents "talk" at
  // once with the larger groupChat bubble, then the next batch overlaps in
  // before the previous fades — so multiple bubbles are visible simultaneously.
  private async chitChat(ids: string[]): Promise<void> {
    if (ids.length === 0) return
    const rounds = 3
    for (let round = 0; round < rounds; round++) {
      // Each round, pick a rotating "lead" speaker and 1-2 responders so the
      // bubble pattern shifts and feels organic rather than mechanical.
      const lead = ids[round % ids.length]!
      const responders = ids.filter((id) => id !== lead)
      // Lead speaks with a longer bubble.
      if (this.cancelled) return
      this.director.groupChat(lead, 1.8)
      // Responders chime in slightly staggered so bubbles overlap visually.
      for (let i = 0; i < responders.length; i++) {
        if (this.cancelled) return
        await this.delay(220)
        // Alternate between group chat and quick chat for variety.
        const useGroup = i < responders.length - 1
        if (useGroup) this.director.groupChat(responders[i]!, 1.4)
        else this.director.chat(responders[i]!, 1.0)
      }
      // Let the round breathe before the next lead picks up.
      await this.delay(500)
    }
  }

  // Two-phase exit so everyone leaves together:
  //   Phase 1: all participants walk to staging tiles just outside the collab
  //            door and wait for everyone to arrive.
  //   Phase 2: all participants walk to their workstations simultaneously and
  //            transition to work/idle upon arrival.
  private async disperseAndWork(allIds: string[], workerIds: string[]): Promise<void> {
    const workerSet = new Set(workerIds)

    // Phase 1: gather at the door so the group exits together.
    await Promise.all(
      allIds.map((id, i) => {
        const tile = EXIT_STAGING_TILES[i % EXIT_STAGING_TILES.length]!
        return this.director.walk(id, tile)
      }),
    )
    if (this.cancelled) return
    // Brief beat so the group reads as "leaving together" before splitting.
    await this.delay(150)

    // Phase 2: disperse to workstations in parallel.
    await Promise.all(
      allIds.map((id) => {
        const role = this.roleFor(id)
        const seat = role ? this.director.workstationSeat(role) : undefined
        if (!seat) return Promise.resolve()
        return this.director.walk(id, seat).then(() => {
          if (this.cancelled) return
          if (workerSet.has(id)) {
            const state = (role && WORK_STATE[role]) || 'working'
            return this.director.workAt(id, state)
          }
          this.director.idle(id)
          return Promise.resolve()
        })
      }),
    )
  }

  private roleFor(id: string): AgentRole | undefined {
    return this.participants.find((r) => this.idForRole(r) === id)
  }

  private async delay(ms: number): Promise<void> {
    if (this.cancelled) return
    await new Promise((r) => setTimeout(r, ms / this.speed))
    if (this.cancelled) return
  }
}

export function collaborationTask(): TaskDescriptor {
  return { ...COLLAB_TASK }
}
