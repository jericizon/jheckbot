import { Application, Container, type Renderer } from 'pixi.js'
import type { EventBus } from './EventBus'
import type {
  ActivityKind,
  AgentDescriptor,
  AgentVisualState,
  Direction,
  InterruptPriority,
  MessageKind,
  OfficeEvent,
  TaskDescriptor,
  Vec2,
} from './types'
import { buildLayout, TILE, type OfficeLayout, workstationForRole } from './world/layout'
import { NavigationGrid } from './world/NavigationGrid'
import { OfficeWorld } from './world/OfficeWorld'
import { Camera } from './camera/Camera'
import { AgentEntity } from './agents/AgentEntity'
import { isWorkingVisualState } from './agents/AgentSprite'
import { OfficeEffects, type StatusIcon } from './effects/OfficeEffects'
import type { OfficeDirector } from './simulation/OfficeDirector'

export interface SelectionInfo {
  agentId: string
  name: string
  role: AgentDescriptor['role']
  state: AgentVisualState
  task?: TaskDescriptor
  provider?: string
  model?: string
}

export interface VirtualOfficeCallbacks {
  onSelect?: (info: SelectionInfo | null) => void
  onOpenCeoChat?: () => void
  onStats?: (stats: { agentsOnline: number; tasksRunning: number }) => void
}

// Top-level engine (spec §26). Owns the PIXI app, the world, the agent layer,
// the effects layer, and the camera. Implements OfficeDirector so the mock
// simulation and (later) the real runtime can drive it through one API.
export class VirtualOffice implements OfficeDirector {
  readonly app: Application
  private layout: OfficeLayout
  private nav: NavigationGrid
  private world!: OfficeWorld
  private agents = new Map<string, AgentEntity>()
  private effects!: OfficeEffects
  private camera!: Camera
  private agentLayer = new Container()
  private tasks = new Map<string, TaskDescriptor>()
  private tasksByAgent = new Map<string, string>()
  private selectedId: string | null = null
  private cb: VirtualOfficeCallbacks
  private unsubscribe?: () => void
  private destroyed = false
  private readyPromise: Promise<void>
  private pendingAgents: Array<{ agent: AgentDescriptor; tile?: Vec2 }> = []
  // Re-entrancy guard: when the director emits events for consumers, handleEvent
  // must not re-process them (that would create infinite recursion).
  private emitting = false

  constructor(
    private canvas: HTMLCanvasElement,
    width: number,
    height: number,
    private bus: EventBus,
    callbacks: VirtualOfficeCallbacks = {},
  ) {
    this.cb = callbacks
    this.app = new Application()
    this.layout = buildLayout()
    this.nav = NavigationGrid.fromLayout(this.layout)
    this.readyPromise = this.init(width, height)
  }

  get ready(): Promise<void> {
    return this.readyPromise
  }

  private get isReady(): boolean {
    return !!this.app.renderer && !!this.world
  }

  private async init(width: number, height: number): Promise<void> {
    await this.app.init({
      canvas: this.canvas,
      width,
      height,
      antialias: false,
      background: PALETTE_BG,
      resolution: Math.min(2, window.devicePixelRatio || 1),
      autoDensity: true,
      roundPixels: true,
    })
    if (this.destroyed) {
      this.app.destroy()
      return
    }
    const renderer = this.app.renderer
    this.world = new OfficeWorld(renderer, this.layout)
    this.effects = new OfficeEffects(renderer)
    this.camera = new Camera(width, height)

    // Layer order: world shell, monitor glow (above furniture, below agents),
    // agents, then effects (envelopes/notifications) on top.
    this.camera.view.addChild(this.world.view)
    this.camera.view.addChild(this.world.glow)
    this.camera.view.addChild(this.agentLayer)
    this.camera.view.addChild(this.effects.view)

    this.app.stage.addChild(this.camera.view)
    this.app.stage.interactive = true
    this.app.stage.hitArea = this.app.screen

    this.app.ticker.add((ticker) => this.tick(ticker.deltaMS / 1000, ticker.lastTime / 1000))
    this.wireInput()
    this.unsubscribe = this.bus.on((e) => this.handleEvent(e))
    // Flush any agents queued before the renderer was ready. Run the
    // introduction sequence for each (spec §26); an explicit tile bypasses it.
    for (const { agent, tile } of this.pendingAgents) {
      if (tile) this.spawnAgent(agent, tile)
      else void this.introduceAgent(agent)
    }
    this.pendingAgents = []
    this.emitStats()
  }

  // ---- OfficeDirector implementation ----

  createAgent(agent: AgentDescriptor, tile?: Vec2): void {
    if (this.agents.has(agent.id)) return
    // Queue if the renderer isn't ready yet (app.init is async).
    if (!this.app.renderer) {
      this.pendingAgents.push({ agent, tile })
      return
    }
    // An explicit tile overrides the introduction sequence — spawn directly
    // where the caller asked (e.g. a runtime-supplied position). Otherwise run
    // the door → look around → walk to workstation intro (spec §26).
    if (tile) {
      this.spawnAgent(agent, tile)
    } else {
      void this.introduceAgent(agent)
    }
  }

  // Character introduction sequence (spec §26): the agent enters through the
  // office door, looks around briefly, walks to their workstation seat, then
  // sits down. Runs asynchronously and does not block other agents or the tick
  // loop. The agent is spawned synchronously at the entrance first so it exists
  // in the map for any concurrent calls.
  private async introduceAgent(agent: AgentDescriptor, tile?: Vec2): Promise<void> {
    const spawn = tile ?? this.layout.entrance
    this.spawnAgent(agent, spawn)
    const entity = this.agents.get(agent.id)
    if (!entity) return
    const ws = workstationForRole(this.layout, agent.role)
    await runIntroduction(this.lifecycleAgent(entity, agent.id), {
      entrance: spawn,
      workstationSeat: ws?.seat,
      workstationFace: ws?.face as Direction | undefined,
    }, (s) => this.delay(s))
    if (!this.agents.has(agent.id)) return
    this.emit({ type: 'agent.idle', agentId: agent.id })
  }

  private spawnAgent(agent: AgentDescriptor, tile?: Vec2): void {
    if (this.agents.has(agent.id)) return
    const spawn = tile ?? this.layout.spawns[agent.role] ?? { x: 2, y: 2 }
    const entity = new AgentEntity(this.app.renderer, agent, this.layout, this.nav, spawn)
    this.agents.set(agent.id, entity)
    this.agentLayer.addChild(entity.view)
    this.emit({ type: 'agent.created', agent, tile: spawn })
    this.emitStats()
  }

  async walk(agentId: string, tile: Vec2): Promise<void> {
    const agent = this.agents.get(agentId)
    if (!agent) return
    this.emit({ type: 'agent.walking', agentId, to: tile })
    await agent.walkTo(tile)
    this.emit({ type: 'agent.arrived', agentId, tile })
  }

  async workAt(agentId: string, state: AgentVisualState = 'working'): Promise<void> {
    const agent = this.agents.get(agentId)
    if (!agent) return
    this.resumeIfInterrupted(agentId)
    const ws = workstationForRole(this.layout, agent.descriptor.role)
    if (ws) {
      await agent.walkTo(ws.seat)
      agent.face(ws.face)
    }
    agent.setState(state)
    // Only light up the monitor for active work states, not idle/seated.
    const isActive = state === 'working' || state === 'coding' || state === 'testing' || state === 'reviewing'
    if (this.isReady && isActive) this.world.setMonitorGlow(ws?.desk ?? agent.currentTile, true)
    this.emit({ type: stateEvent(state), agentId } as OfficeEvent)
  }

  setState(agentId: string, state: AgentVisualState): void {
    const agent = this.agents.get(agentId)
    if (!agent) return
    // Normal state transitions clear any active interrupt first (spec §20).
    this.resumeIfInterrupted(agentId)
    agent.setState(state)
    if (this.isReady && state !== 'working' && state !== 'coding' && state !== 'testing' && state !== 'reviewing') {
      const ws = workstationForRole(this.layout, agent.descriptor.role)
      if (ws) this.world.setMonitorGlow(ws.desk, false)
    }
    this.emit({ type: stateEvent(state), agentId } as OfficeEvent)
  }

  async message(fromId: string, toId: string, kind: MessageKind): Promise<void> {
    const from = this.agents.get(fromId)
    const to = this.agents.get(toId)
    if (!from || !to) return
    // Emergency kinds trigger a physical conversation instead of an envelope
    // (spec §13: emergency = agent physically walks to recipient).
    if (isPhysicalMessageKind(kind)) {
      await this.physicalConversation(fromId, toId, kind)
      return
    }
    from.interrupt('MEDIUM', 'communicating')
    const messageId = `msg_${Math.random().toString(36).slice(2, 9)}`
    this.emit({ type: 'agent.message.sent', from: fromId, to: toId, messageId, kind })
    if (!this.isReady) return
    const fromHead = from.headPixelPosition()
    const toHead = to.headPixelPosition()
    await new Promise<void>((resolve) => {
      this.effects.sendEnvelope(fromHead, toHead, kind, () => {
        this.emit({ type: 'agent.message.received', messageId, to: toId })
        this.effects.popNotification(toHead, kind)
        resolve()
      })
    })
    // Message complete — resume if still MEDIUM-interrupted (spec §20).
    if (from.interruptedBy === 'MEDIUM') from.resume()
  }

  // Physical conversation (spec §14): the sender walks to a tile adjacent to
  // the recipient, both turn to face each other, both enter `communicating`,
  // speech bubbles appear, then the sender walks back and the recipient resumes.
  async physicalConversation(fromId: string, toId: string, kind: MessageKind): Promise<void> {
    const from = this.agents.get(fromId)
    const to = this.agents.get(toId)
    if (!from || !to) return
    const messageId = `msg_${Math.random().toString(36).slice(2, 9)}`
    this.emit({ type: 'agent.message.sent', from: fromId, to: toId, messageId, kind })

    const senderHome = { ...from.currentTile }
    const recipientTile = to.currentTile
    const approach = conversationApproachTile(this.nav, recipientTile)
    if (!approach) return

    // Interrupt both agents for the conversation.
    from.interrupt('HIGH', 'communicating')
    to.interrupt('HIGH', 'communicating')

    // Sender walks to the tile adjacent to the recipient.
    await this.walk(fromId, approach)

    // Both face each other.
    from.face(faceDirection(from.currentTile, to.currentTile))
    to.face(faceDirection(to.currentTile, from.currentTile))
    from.setState('communicating')
    to.setState('communicating')

    // Speech indicators above both heads for the conversation duration.
    if (this.isReady) {
      const duration = 2 + Math.random() * 2 // 2-4 seconds
      this.effects.speechBubble(from.headPixelPosition(), duration)
      this.effects.speechBubble(to.headPixelPosition(), duration)
      await new Promise<void>((resolve) => setTimeout(resolve, duration * 1000))
    }

    // Sender walks back to their previous position.
    await this.walk(fromId, senderHome)

    // Both resume their previous activities (spec §20).
    from.resume()
    to.resume()
    this.emit({ type: 'agent.message.received', messageId, to: toId })
  }

  think(agentId: string): void {
    this.setState(agentId, 'thinking')
    this.popStatus(agentId, 'thinking')
  }

  async review(agentId: string): Promise<void> {
    await this.workAt(agentId, 'reviewing')
    this.popStatus(agentId, 'review')
  }

  succeed(agentId: string): void {
    this.resumeIfInterrupted(agentId)
    this.setState(agentId, 'success')
    this.popStatus(agentId, 'success')
  }

  fail(agentId: string): void {
    const agent = this.agents.get(agentId)
    if (!agent) return
    agent.interrupt('CRITICAL', 'error')
    this.popStatus(agentId, 'error')
    this.emit({ type: 'agent.error', agentId })
    // A crash freezes the agent then dims it offline (spec §27).
    void this.exitAgent(agentId, true)
  }

  idle(agentId: string): void {
    this.setState(agentId, 'idle')
  }

  // Brief chit-chat beat: a speech bubble pops above the agent's head while
  // they are in the communicating state. Used by the collaboration timeline.
  chat(agentId: string, durationSec = 1.2): void {
    const agent = this.agents.get(agentId)
    if (!agent) return
    agent.interrupt('MEDIUM', 'communicating')
    if (this.isReady) {
      this.effects.speechBubble(agent.headPixelPosition(), durationSec)
    }
    this.emit({ type: 'agent.communicating', agentId })
  }

  // Larger animated chat bubble for group conversations (collaboration room).
  // Sets the agent to communicating and shows a bigger, animated bubble.
  groupChat(agentId: string, durationSec = 2): void {
    const agent = this.agents.get(agentId)
    if (!agent) return
    agent.interrupt('MEDIUM', 'communicating')
    if (this.isReady) {
      this.effects.chatBubble(agent.headPixelPosition(), durationSec)
    }
    this.emit({ type: 'agent.communicating', agentId })
  }

  // Fire a confetti celebration burst at a tile position (task completion).
  confetti(at: Vec2): void {
    if (!this.isReady) return
    const px = { x: at.x * TILE + TILE / 2, y: at.y * TILE + TILE / 2 }
    this.effects.confetti(px)
  }

  // Agent exit sequence (spec §27). For a graceful offline, the agent stands
  // up, walks to the office entrance/door, then disappears. For a crash, the
  // walk is skipped: the agent freezes in the error pose, then after a beat
  // transitions to the dimmed offline state. Runs asynchronously and does not
  // block other agents or the tick loop.
  private async exitAgent(agentId: string, crashed: boolean): Promise<void> {
    const agent = this.agents.get(agentId)
    if (!agent) return
    // Turn off the workstation monitor glow on either path.
    if (this.isReady) {
      const ws = workstationForRole(this.layout, agent.descriptor.role)
      if (ws) this.world.setMonitorGlow(ws.desk, false)
    }
    await runExit(this.lifecycleAgent(agent, agentId), this.layout.entrance, crashed, (s) => this.delay(s))
    this.emitStats()
  }

  // Build a LifecycleAgent controller around an AgentEntity so the intro/exit
  // orchestration can be driven by pure, renderer-free helpers (and tested
  // with a fake). walkTo routes through this.walk so walking/arrived events
  // fire as they do for any other movement.
  private lifecycleAgent(agent: AgentEntity, agentId: string): LifecycleAgent {
    const alive = (): boolean => this.agents.has(agentId)
    return {
      face: (dir) => { if (alive()) agent.face(dir) },
      setState: (state) => { if (alive()) agent.setState(state) },
      walkTo: (tile) => (alive() ? this.walk(agentId, tile) : Promise.resolve()),
      setOffline: () => { if (alive()) agent.setOffline() },
      hide: () => { if (alive()) agent.view.visible = false },
    }
  }

  // Resume the agent's previous activity after an interrupt resolves (§20).
  resumeAgent(agentId: string): void {
    const agent = this.agents.get(agentId)
    if (!agent) return
    agent.resume()
  }

  // Clear any active interrupt before a normal state transition (§20).
  private resumeIfInterrupted(agentId: string): void {
    const agent = this.agents.get(agentId)
    if (agent && agent.isInterrupted) agent.resume()
  }

  // Route a priority interrupt to the agent (spec §19). Emits the state event
  // for consumers. Lower-or-equal priorities are ignored by the agent.
  private interruptAgent(
    agentId: string,
    priority: InterruptPriority,
    state: AgentVisualState,
    activity?: Parameters<AgentEntity['interrupt']>[2],
  ): void {
    const agent = this.agents.get(agentId)
    if (!agent) return
    if (!agent.interrupt(priority, state, activity)) return
    if (this.isReady && state !== 'working' && state !== 'coding' && state !== 'testing' && state !== 'reviewing') {
      const ws = workstationForRole(this.layout, agent.descriptor.role)
      if (ws) this.world.setMonitorGlow(ws.desk, false)
    }
    this.emit({ type: stateEvent(state), agentId } as OfficeEvent)
  }

  createTask(task: TaskDescriptor): void {
    this.tasks.set(task.id, task)
    if (task.assignedAgentId) this.tasksByAgent.set(task.assignedAgentId, task.id)
    this.emit({ type: 'task.created', task })
    this.emitStats()
  }

  updateTask(task: TaskDescriptor): void {
    this.tasks.set(task.id, task)
    if (task.assignedAgentId) this.tasksByAgent.set(task.assignedAgentId, task.id)
    this.emit({ type: 'task.updated', task })
    this.emitStats()
    if (this.selectedId) this.emitSelection()
  }

  agentIdForRole(role: AgentDescriptor['role']): string | undefined {
    for (const a of this.agents.values()) {
      if (a.descriptor.role === role) return a.descriptor.id
    }
    return undefined
  }

  meetingSeat(index: number): Vec2 {
    const seat = this.layout.meetingSeats[index % this.layout.meetingSeats.length]
    return seat ?? { x: 23, y: 13 }
  }

  workstationSeat(role: AgentDescriptor['role']): Vec2 | undefined {
    return workstationForRole(this.layout, role)?.seat
  }

  // ---- EventBus -> director (for the real runtime, Phase 8) ----

  private handleEvent(event: OfficeEvent): void {
    // Skip events the director itself emitted (prevents infinite recursion).
    if (this.emitting) return
    switch (event.type) {
      case 'agent.created':
        this.createAgent(event.agent, event.tile)
        break
      case 'agent.offline': {
        void this.exitAgent(event.agentId, false)
        break
      }
      case 'agent.walking':
        void this.walk(event.agentId, event.to)
        break
      case 'agent.working':
        void this.workAt(event.agentId, 'working')
        break
      case 'agent.coding':
        void this.workAt(event.agentId, 'coding')
        break
      case 'agent.thinking':
        this.think(event.agentId)
        break
      case 'agent.testing':
        void this.workAt(event.agentId, 'testing')
        break
      case 'agent.reviewing':
        void this.workAt(event.agentId, 'reviewing')
        break
      case 'agent.communicating':
        this.interruptAgent(event.agentId, 'MEDIUM', 'communicating')
        break
      case 'agent.waiting':
        this.setState(event.agentId, 'waiting')
        break
      case 'agent.blocked':
        this.interruptAgent(event.agentId, 'CRITICAL', 'blocked')
        this.popStatus(event.agentId, 'blocked')
        break
      case 'agent.success':
        this.succeed(event.agentId)
        break
      case 'agent.error':
        this.fail(event.agentId)
        break
      case 'agent.idle':
        this.idle(event.agentId)
        break
      case 'agent.message.sent':
        void this.message(event.from, event.to, event.kind)
        break
      case 'agent.task.assigned':
        this.createTask(event.task)
        this.interruptAgent(event.agentId, 'HIGH', 'working')
        break
      case 'agent.task.completed':
        this.resumeAgent(event.agentId)
        break
      case 'agent.task.failed':
        this.interruptAgent(event.agentId, 'CRITICAL', 'error')
        this.popStatus(event.agentId, 'error')
        break
      case 'task.created':
      case 'task.updated':
        this.updateTask(event.task)
        break
      default:
        break
    }
  }

  // ---- Selection / input ----

  private wireInput(): void {
    const stage = this.app.stage
    stage.addEventListener('pointerdown', (e) => {
      this.camera.beginDrag(e.globalX, e.globalY)
      this.dragMoved = false
    })
    stage.addEventListener('pointermove', (e) => {
      if (this.camera.isDragging()) {
        this.camera.drag(e.globalX, e.globalY)
        this.dragMoved = true
      }
    })
    stage.addEventListener('pointerup', () => {
      this.camera.endDrag()
    })
    stage.addEventListener('pointerupoutside', () => this.camera.endDrag())
    stage.addEventListener('wheel', (e) => {
      e.preventDefault()
      if (e.deltaY < 0) this.camera.zoomIn()
      else this.camera.zoomOut()
    }, { passive: false })
    stage.addEventListener('click', (e) => {
      if (this.dragMoved) return
      this.handleClick(e.globalX, e.globalY)
    })
  }

  private dragMoved = false

  private handleClick(screenX: number, screenY: number): void {
    const tile = this.camera.screenToTile(screenX, screenY)
    // Find the nearest agent within ~1 tile of the click.
    let nearest: AgentEntity | null = null
    let bestDist = Infinity
    for (const a of this.agents.values()) {
      const at = a.currentTile
      const d = Math.hypot(at.x - tile.x, at.y - tile.y)
      if (d < bestDist) {
        bestDist = d
        nearest = a
      }
    }
    if (nearest && bestDist <= 1.2) {
      this.select(nearest.descriptor.id)
    } else if (nearest?.descriptor.role === 'ceo' && bestDist <= 1.5) {
      this.select(nearest.descriptor.id)
    } else {
      this.select(null)
    }
  }

  select(agentId: string | null): void {
    this.selectedId = agentId
    if (agentId === null) {
      this.cb.onSelect?.(null)
      return
    }
    const a = this.agents.get(agentId)
    if (!a) return
    if (a.descriptor.role === 'ceo') {
      this.cb.onOpenCeoChat?.()
    }
    this.emitSelection()
  }

  private emitSelection(): void {
    if (!this.selectedId) return
    const a = this.agents.get(this.selectedId)
    if (!a) return
    const taskId = this.tasksByAgent.get(this.selectedId)
    const task = taskId ? this.tasks.get(taskId) : undefined
    this.cb.onSelect?.({
      agentId: a.descriptor.id,
      name: a.descriptor.name,
      role: a.descriptor.role,
      state: a.currentState,
      task,
      provider: a.descriptor.provider,
      model: a.descriptor.model,
    })
  }

  private popStatus(agentId: string, icon: StatusIcon): void {
    const a = this.agents.get(agentId)
    if (!a || !this.isReady) return
    this.effects.showStatus(a.headPixelPosition(), icon, 2)
  }

  private emitStats(): void {
    let online = 0
    let running = 0
    for (const a of this.agents.values()) {
      if (a.currentState !== 'offline') online++
    }
    for (const t of this.tasks.values()) {
      if (t.status === 'in_progress' || t.status === 'review' || t.status === 'planning' || t.status === 'assigned') {
        running++
      }
    }
    this.cb.onStats?.({ agentsOnline: online, tasksRunning: running })
  }

  // ---- Lifecycle ----

  resize(width: number, height: number): void {
    if (!this.app.renderer) return
    this.app.renderer.resize(width, height)
    this.camera?.setViewportSize(width, height)
  }

  resetCamera(): void {
    this.camera?.reset()
  }

  zoomIn(): void {
    this.camera?.zoomIn()
  }

  zoomOut(): void {
    this.camera?.zoomOut()
  }

  private tick(dt: number, t: number): void {
    this.world?.update(t)
    for (const a of this.agents.values()) a.update(dt, t)
    this.effects?.update(dt)
    this.camera?.update(this.app.ticker)
    this.updateContextualReactions(dt)
    this.syncActivityBubbles()
    if (this.selectedId) {
      // Live state refresh for the panel.
      const a = this.agents.get(this.selectedId)
      if (a && a.currentState !== this.lastSelectedState) {
        this.lastSelectedState = a.currentState
        this.emitSelection()
      }
    }
  }

  // Sync persistent activity bubbles (spec §16 visibility) above each agent
  // so a viewer can see at a glance what everyone is doing. Working visual
  // states show the current activity icon; thinking shows a thought cloud;
  // communicating shows a speech bubble. All other states hide the bubble.
  private syncActivityBubbles(): void {
    if (!this.effects) return
    for (const [id, agent] of this.agents) {
      const state = agent.currentState
      let activity: ActivityKind | null = null
      if (isWorkingVisualState(state)) {
        activity = agent.currentActivity ?? 'coding'
      } else if (state === 'thinking') {
        activity = 'thinking_pause'
      } else if (state === 'communicating') {
        activity = 'communicating'
      }
      // Offset above the head so the bubble tail doesn't overlap the sprite.
      const head = agent.headPixelPosition()
      this.effects.setActivityBubble(id, { x: head.x, y: head.y - 10 }, activity)
    }
  }

  private lastSelectedState: AgentVisualState | null = null
  // Accumulator for the throttled contextual-reaction scan (spec §18).
  private reactionScanAccum = 0

  // Contextual reactions (spec §18): when an agent is walking, nearby seated
  // agents briefly turn to look at them. Scanned at most every ~0.5s to avoid
  // excessive calls. CEO walkers also catch the eye of nearby developers.
  private updateContextualReactions(dt: number): void {
    this.reactionScanAccum += dt
    if (this.reactionScanAccum < REACTION_SCAN_INTERVAL) return
    this.reactionScanAccum = 0
    const agents = [...this.agents.values()]
    for (const walker of agents) {
      if (walker.currentState !== 'walking') continue
      const wTile = walker.currentTile
      for (const other of agents) {
        if (other === walker) continue
        if (!other.isSeated) continue
        const oTile = other.currentTile
        const dist = Math.hypot(oTile.x - wTile.x, oTile.y - wTile.y)
        if (dist <= REACTION_RADIUS) {
          other.reactToNearbyWalker(wTile, walker.descriptor.role)
        }
      }
    }
  }

  destroy(): void {
    this.destroyed = true
    this.unsubscribe?.()
    this.unsubscribe = undefined
    this.effects?.clear()
    for (const a of this.agents.values()) a.view.destroy({ children: true })
    this.agents.clear()
    this.app.destroy()
  }

  // Emit an event for consumers (Vue layer, logs) without triggering handleEvent.
  private emit(event: OfficeEvent): void {
    this.emitting = true
    try {
      this.bus.emit(event)
    } finally {
      this.emitting = false
    }
  }

  // Promise-based delay used by the intro/exit sequences. Resolved on the next
  // macrotask so it never blocks the PIXI ticker.
  private delay(seconds: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, seconds * 1000))
  }
}

// ---- Pure helpers for physical conversations (spec §14) ----

// Minimal controller the intro/exit orchestration helpers drive. Extracted so
// the sequences are testable without a PIXI renderer (tests pass a fake that
// records walkTo targets and state changes).
export interface LifecycleAgent {
  face(dir: Direction): void
  setState(state: AgentVisualState): void
  walkTo(tile: Vec2): Promise<void>
  setOffline(): void
  hide(): void
}

export interface IntroductionPlan {
  entrance: Vec2
  workstationSeat?: Vec2
  workstationFace?: Direction
}

// Character introduction sequence (spec §26), pure orchestration. The agent
// faces into the office, pauses to "look around", walks to its workstation
// seat, faces the desk, and sits down (idle).
export async function runIntroduction(
  agent: LifecycleAgent,
  plan: IntroductionPlan,
  delay: (seconds: number) => Promise<void>,
): Promise<void> {
  agent.face('down')
  agent.setState('idle')
  await delay(INTRO_LOOK_SECONDS)
  if (plan.workstationSeat) {
    await agent.walkTo(plan.workstationSeat)
    if (plan.workstationFace) agent.face(plan.workstationFace)
  }
  agent.setState('idle')
}

// Agent exit sequence (spec §27), pure orchestration. A graceful exit walks to
// the entrance then disappears; a crash freezes in the error pose, then dims
// to offline after a beat.
export async function runExit(
  agent: LifecycleAgent,
  entrance: Vec2,
  crashed: boolean,
  delay: (seconds: number) => Promise<void>,
): Promise<void> {
  if (crashed) {
    agent.setState('error')
    await delay(CRASH_FREEZE_SECONDS)
    agent.setOffline()
    return
  }
  await agent.walkTo(entrance)
  agent.setOffline()
  agent.hide()
}

// Kinds that trigger a physical walk instead of a traveling envelope.
export function isPhysicalMessageKind(kind: MessageKind): boolean {
  return kind === 'emergency'
}

// Find a walkable tile adjacent to the recipient for the sender to stand on.
// Falls back to the nearest walkable tile if no direct neighbor is walkable.
export function conversationApproachTile(nav: NavigationGrid, recipientTile: Vec2): Vec2 | null {
  const dirs: Array<[number, number]> = [
    [0, -1],
    [0, 1],
    [-1, 0],
    [1, 0],
  ]
  for (const [dx, dy] of dirs) {
    const t = { x: recipientTile.x + dx, y: recipientTile.y + dy }
    if (nav.isWalkable(t.x, t.y)) return t
  }
  return nav.nearestWalkable(recipientTile)
}

// Direction one agent should face to look at another, based on tile positions.
export function faceDirection(from: Vec2, to: Vec2): Direction {
  const dx = to.x - from.x
  const dy = to.y - from.y
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'right' : 'left'
  return dy > 0 ? 'down' : 'up'
}

const PALETTE_BG = '#1c1c22'

// Intro/exit sequence timings (spec §26/§27).
const INTRO_LOOK_SECONDS = 0.5 // "look around" pause after entering
const CRASH_FREEZE_SECONDS = 1.0 // freeze in error pose before dimming offline
// Contextual-reaction scan cadence (spec §18): check for nearby walkers at
// most twice per second to avoid excessive reactToNearbyWalker calls.
const REACTION_SCAN_INTERVAL = 0.5
// A seated agent reacts to walkers within this tile radius (spec §18).
const REACTION_RADIUS = 2

function stateEvent(state: AgentVisualState): OfficeEvent['type'] {
  switch (state) {
    case 'working':
      return 'agent.working'
    case 'coding':
      return 'agent.coding'
    case 'thinking':
      return 'agent.thinking'
    case 'testing':
      return 'agent.testing'
    case 'reviewing':
      return 'agent.reviewing'
    case 'reading':
      return 'agent.reading'
    case 'communicating':
      return 'agent.communicating'
    case 'meeting':
      return 'agent.meeting'
    case 'waiting':
      return 'agent.waiting'
    case 'blocked':
      return 'agent.blocked'
    case 'success':
      return 'agent.success'
    case 'error':
      return 'agent.error'
    case 'idle':
      return 'agent.idle'
    case 'offline':
      return 'agent.offline'
    default:
      return 'agent.idle'
  }
}
