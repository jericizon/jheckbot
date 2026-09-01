import type { AgentDescriptor, AgentVisualState, MessageKind, TaskDescriptor, Vec2 } from '../types'

// High-level orchestration API the simulation/runtime uses to drive the
// office. Each method emits the corresponding EventBus events (spec §27) AND
// returns a promise that resolves when the visual completes — so a scripted
// demo can sequence steps without overlapping movement (spec §29).
//
// The real agent runtime (Phase 8) will later call these without awaiting, or
// emit raw events directly; the director stays the single translation layer
// from intent -> visual + event.
export interface OfficeDirector {
  // Spawn an agent at its role's spawn tile (or a given tile).
  createAgent(agent: AgentDescriptor, tile?: Vec2): void
  // Walk an agent to a tile; resolves on arrival.
  walk(agentId: string, tile: Vec2): Promise<void>
  // Walk to the agent's workstation and begin a working-state pose.
  workAt(agentId: string, state?: AgentVisualState): Promise<void>
  // Set an agent's visual state in place.
  setState(agentId: string, state: AgentVisualState): void
  // Send a message envelope from -> to; resolves when the envelope lands.
  message(fromId: string, toId: string, kind: MessageKind): Promise<void>
  // Conveniences for the demo workflow.
  think(agentId: string): void
  review(agentId: string): Promise<void>
  succeed(agentId: string): void
  fail(agentId: string): void
  idle(agentId: string): void
  // Task board plumbing (Phase 6).
  createTask(task: TaskDescriptor): void
  updateTask(task: TaskDescriptor): void
  // Resolve a role -> agentId (the demo uses role-based scripting).
  agentIdForRole(role: AgentDescriptor['role']): string | undefined
  // Tile helpers for scripting (e.g. meeting seats, workstation seats).
  meetingSeat(index: number): Vec2
  workstationSeat(role: AgentDescriptor['role']): Vec2 | undefined
  // Show a speech bubble above an agent for a short chit-chat beat.
  chat(agentId: string, durationSec?: number): void
  // Show a larger animated chat bubble above an agent for group conversations.
  groupChat(agentId: string, durationSec?: number): void
  // Fire a confetti celebration burst at a pixel/tile position (or an agent).
  confetti(at: Vec2): void
}
