# QA Report — Pixi.js Virtual Office Recreation

**Date:** 2026-09-01
**Spec:** `docs/recreate-virual-office.md`
**Scope:** Phases 1–7 (World, Agents, State Machine, Communication, Tasks, CEO Orchestrator) + deterministic demo mode
**Branch:** `feature/characters-rework`

## What was built

A new Pixi.js v8 engine under `apps/web/app/office/` replaces the previous DOM/CSS office (`OfficeScene.vue` + cubicle/room components) on both the project page and the conversation office panel.

### Architecture (spec §26)

```
apps/web/app/office/
├── types.ts                 # events, agent/task state, message kinds
├── EventBus.ts              # typed pub/sub (spec §27)
├── Palette.ts               # limited color system + per-role colors (§22/§10)
├── VirtualOffice.ts         # PIXI app, layers, ticker, director, input, selection
├── world/
│   ├── layout.ts            # 48x32 tile layout, rooms, furniture, workstations (pure)
│   ├── NavigationGrid.ts    # walkable grid + A* pathfinding (pure)
│   └── OfficeWorld.ts       # floors, walls, doors, furniture, decor, monitor glow
├── camera/Camera.ts         # pan/zoom/focus, integer-snap, crisp pixels
├── agents/
│   ├── AgentSprite.ts       # procedural pixel characters + frame animations
│   ├── AgentMovement.ts     # smooth tile path-following
│   └── AgentEntity.ts       # sprite + movement + state machine
├── effects/OfficeEffects.ts # envelopes, notifications, status icons
└── simulation/
    ├── OfficeDirector.ts    # high-level intent → visual + event API
    └── DemoTimeline.ts       # scripted CEO→Dev→QA workflow (§29/§36)
```

`OfficePixi.vue` mounts the canvas, owns the pixel-art UI overlay (top bar, controls, selected-agent panel), maps live backend `OfficeAgent` state into the engine, and exposes a DEMO toggle.

### Spec coverage

- §3 Camera: pan (drag), zoom (wheel + buttons), center/reset, integer-snap scaling, `antialias:false`, `roundPixels`.
- §4/§30 Pixel art: all artwork drawn pixel-by-pixel with flat `Graphics` fills; no static background, no emoji, no placeholder rectangles.
- §5 Grid: 16px logical tiles, everything snapped to grid.
- §6/§7 Rooms: CEO, Engineering, Design/Frontend, QA, Collaboration, Server Room, Break Area — each with distinct floor + furniture.
- §8/§9 Walls/floors: perimeter walls with doors, windows, posters, room signs; per-room floor materials.
- §10/§11 Characters: per-role colors (CEO/backend/frontend/qa/designer/devops), idle/walk(4-dir)/seated/thinking/talking/success/error/offline frames.
- §12/§13 States + movement: 15 visual states; A* pathfinding on a walkable grid with smooth interpolation; obstacles block movement.
- §14 Communication: traveling envelopes with kind-specific icons + colors, arc trajectory, receiver notification pop.
- §15/§16/§29 CEO orchestrator + demo: scripted workflow (think → walk to dev → assign → dev codes → QA request → review → warn → fix → re-review → approve → CEO success), task status transitions queued→…→completed.
- §17 Tasks: task descriptors with status/priority/assignment, surfaced in the selected-agent panel.
- §20/§21 UI overlay: pixel-styled top bar (agents online, tasks running), bottom controls (zoom/center/demo), selected-agent panel, hard borders / square corners / chunky buttons.
- §27/§28 Event-driven + simulation/runtime separation: renderer consumes `EventBus`; mock demo drives via `OfficeDirector`; real runtime can emit raw events later (Phase 8 hook).
- §33 Performance: static world rendered once; textures baked once per role; event-driven updates; Pixi rendering kept separate from Vue state.

## Verification

| Check | Command | Result |
|-------|---------|--------|
| Typecheck (web) | `pnpm --filter @jheckbot/web typecheck` | PASS |
| Typecheck (all packages) | `pnpm typecheck` | PASS (shared, api, web) |
| Unit tests (web) | `pnpm --filter @jheckbot/web test` | 100/100 PASS |
| Production build (web) | `pnpm --filter @jheckbot/web build` | PASS (client + server + nitro) |

### Unit test coverage (`tests/office-pixi.test.ts`, 14 new tests)

- `buildLayout`: grid size, outer-border walls, workstation seats walkable + desks blocked, workstations for every demo role, walkable meeting seats.
- `NavigationGrid`: straight-line path, blocked target returns null, single-tile path, corridor routing around walls into a room interior (every step walkable), nearest-walkable to a blocked target.
- `DemoTimeline` (against a recording fake director): seeds all demo agents + the initial task; runs the full CEO→Backend→QA acceptance workflow (think, task_assignment envelope, coding, approval_request, reviewing, warning, fail, success envelope, CEO succeed); task status sequence queued→planning→…→blocked→review→completed; all workflow agents return to idle.

## Limitations / not covered this session

- **Runtime visual QA not performed.** Per repo rules, dev servers are not started by the agent. The engine is verified by typecheck, unit tests, and a production build, but the live Pixi render (canvas/WebGL) has not been observed in a browser. To validate the acceptance test visually, run `pnpm dev`, open a project page or `/conversations/<id>`, and click **DEMO** (or pass `:demo="true"`). Expected: the scripted CEO→Dev→QA workflow plays out with walking agents and traveling envelopes.
- **Phases 8–10** (real AI runtime wiring, terminal session exposure, mobile-specific UX) are out of scope for this session by decision. The `OfficeDirector` + `EventBus` are the integration points for Phase 8.
- **Meetings (§16):** meeting seats and a `meetingSeat()` director method are provided, but the demo workflow does not convene a multi-agent meeting. A `meeting.started`/`meeting.ended` event path exists in the type system but is not exercised.
- **Audio (§32):** hooks not added; deemed optional by the spec.
- **Live-mode message routing** maps `agentMessages` to a single recipient heuristic; full agent-to-agent routing awaits the real runtime.

## Files changed

New: `apps/web/app/office/**` (engine), `apps/web/app/components/office/OfficePixi.vue`, `apps/web/tests/office-pixi.test.ts`.
Modified: `apps/web/app/components/office/ConversationOfficePanel.vue`, `apps/web/app/pages/projects/[id].vue`, `apps/web/package.json` (added `pixi.js@^8.20.1`).
The previous DOM office components (`OfficeScene.vue`, `OfficeCubicle.vue`, etc.) are no longer referenced but were intentionally left in place to avoid deleting potentially-shared code without confirmation.
