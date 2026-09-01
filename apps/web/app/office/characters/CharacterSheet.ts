// Character design sheet — pure data describing the six AI employee
// archetypes (spec §2–§7, §28). No rendering logic lives here; later tasks
// consume this data to drive sprites, animation, and behavior.
//
// Role → archetype mapping (the spec combines Frontend/Designer in §4 and
// describes a separate Documentation/Research agent in §7; the codebase
// splits these into `frontend` and `designer`):
//   ceo      → CEO / Orchestrator (§2)
//   backend  → Backend Developer (§3)
//   frontend → Frontend / Designer (§4)
//   qa       → QA Engineer (§5)
//   designer → Documentation / Research Agent (§7)
//   devops   → DevOps / Infrastructure Agent (§6)

import type { AgentRole, CharacterArchetype } from '../types'

export const CHARACTER_SHEET: Record<AgentRole, CharacterArchetype> = {
  // CEO / Orchestrator — calm, deliberate, constantly monitoring (§2).
  ceo: {
    silhouette: {
      heightScale: 1.1,
      shoulderWidth: 1.1,
      headShape: 'square',
      postureOffset: -2,
    },
    accessory: 'lapel_pin',
    walk: {
      speedMultiplier: 1.0,
      stride: 'controlled',
      bounce: 'low',
    },
    idleSequence: ['check_task_board', 'look_around', 'walk', 'observe'],
    workingSequence: ['monitoring', 'task_board_read', 'communicating'],
    communicationStyle: 'Deliberate and direct; walks to recipient for important matters',
    successReaction: 'Pause, nod, return to monitoring the office',
    errorReaction: 'Stop, turn toward the source, walk decisively to respond',
  },

  // Backend Developer — focused, introverted, highly concentrated (§3).
  backend: {
    silhouette: {
      heightScale: 1.0,
      shoulderWidth: 0.95,
      headShape: 'round',
      postureOffset: 4,
    },
    accessory: 'headphones',
    walk: {
      speedMultiplier: 1.15,
      stride: 'short',
      bounce: 'medium',
    },
    idleSequence: ['type', 'pause', 'stretch', 'type'],
    workingSequence: ['typing', 'coding', 'thinking_pause', 'typing'],
    communicationStyle: 'Brief and technical; prefers async messages over conversation',
    successReaction: 'Small celebration, lean back, return to work',
    errorReaction: 'Stop typing, look around briefly, resume debugging',
  },

  // Frontend / Designer — energetic, creative, visually expressive (§4).
  frontend: {
    silhouette: {
      heightScale: 1.02,
      shoulderWidth: 1.0,
      headShape: 'oval',
      postureOffset: 0,
    },
    accessory: 'scarf',
    walk: {
      speedMultiplier: 1.25,
      stride: 'energetic',
      bounce: 'high',
    },
    idleSequence: ['stand', 'inspect_board', 'sit', 'type'],
    workingSequence: ['drawing', 'typing', 'board_check', 'drawing'],
    communicationStyle: 'Expressive and visual; gestures toward design board',
    successReaction: 'Visible excitement, small jump or arm movement',
    errorReaction: 'Frustrated gesture, re-examine design board',
  },

  // QA Engineer — methodical, observant, suspicious of everything (§5).
  qa: {
    silhouette: {
      heightScale: 0.96,
      shoulderWidth: 0.9,
      headShape: 'square',
      postureOffset: 1,
    },
    accessory: 'glasses_clipboard',
    walk: {
      speedMultiplier: 0.9,
      stride: 'cautious',
      bounce: 'low',
    },
    idleSequence: ['look_at_monitor', 'stand', 'inspect', 'return'],
    workingSequence: ['testing', 'monitoring', 'testing'],
    communicationStyle: 'Methodical and precise; reports issues with evidence',
    successReaction: 'Carefully verify again, then give approval animation',
    errorReaction: 'Freeze, look at monitor, display warning indicator',
  },

  // Documentation / Research Agent — quiet, thoughtful, curious (§7).
  // Mapped to the `designer` role in the codebase.
  designer: {
    silhouette: {
      heightScale: 0.9,
      shoulderWidth: 0.88,
      headShape: 'oval',
      postureOffset: 3,
    },
    accessory: 'notebook',
    walk: {
      speedMultiplier: 0.8,
      stride: 'relaxed',
      bounce: 'low',
    },
    idleSequence: ['read', 'write', 'think', 'read'],
    workingSequence: ['reading', 'writing', 'thinking_pause'],
    communicationStyle: 'Quiet and thoughtful; asks clarifying questions',
    successReaction: 'Subtle smile, note findings in notebook',
    errorReaction: 'Pause, look upward, re-read source material',
  },

  // DevOps / Infrastructure Agent — calm, technical, monitors infrastructure (§6).
  devops: {
    silhouette: {
      heightScale: 1.05,
      shoulderWidth: 1.05,
      headShape: 'wide',
      postureOffset: 0,
    },
    accessory: 'tool_belt',
    walk: {
      speedMultiplier: 1.3,
      stride: 'purposeful',
      bounce: 'medium',
    },
    idleSequence: ['check_monitor', 'walk_to_server', 'inspect', 'return'],
    workingSequence: ['monitoring', 'server_check', 'monitoring'],
    communicationStyle: 'Calm and technical; concise status updates',
    successReaction: 'Check monitor, nod, return to workstation',
    errorReaction: 'Stop immediately, turn toward server room, walk quickly',
  },
}
