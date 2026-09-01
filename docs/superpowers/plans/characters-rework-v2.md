# Plan — Character & Animation Differentiation Pass (v2)

**Spec:** `docs/recreate-virtual-office-v2.md`
**Branch:** `feature/characters-rework`
**Engine root:** `apps/web/app/office/`

## Goal

Redesign the six agent characters so each has a distinct silhouette, walking style, idle behavior tree, working animation, communication style, and reaction to events. Add micro-animations to the environment, an interrupt system, return-to-task memory, and richer agent-to-agent interactions. No recoloring pass — this is a behavioral animation redesign.

## Global Constraints

- Procedural `PIXI.Graphics` only — no binary image assets.
- TypeScript strict mode (`pnpm -r typecheck` must pass).
- All existing tests must pass (`pnpm --filter @jheckbot/web test`).
- Production build must pass (`pnpm --filter @jheckbot/web build`).
- Do not start dev servers / watch processes.
- Preserve the live realtime integration (no demo button).
- Characters must be recognizable by silhouette alone, not color.
- No two characters may share identical idle behavior trees.
- No two characters may share identical walking animations.
- Movement must be goal-directed, not random wandering.
- Agents must remember and resume previous activities after interruptions.
- The office must remain alive when no task is running (idle behaviors).

## Tasks

### Task 1 — Character design sheet + extended types

Create `apps/web/app/office/characters/CharacterSheet.ts` documenting all six characters as data: name, role, silhouette params (height scale, shoulder width, head shape, posture offset), accessory type, walk params (speed multiplier, stride, bounce), idle behavior sequence, working behavior sequence, communication style, success reaction, error reaction. Extend `types.ts` with `CharacterArchetype`, `WalkParams`, `IdleBehavior`, `ActivityKind`, and an `interruptedBy` field on the agent state machine. No rendering yet — pure data + types.

**Files:** `apps/web/app/office/characters/CharacterSheet.ts` (new), `apps/web/app/office/types.ts` (extend)
**Tests:** `apps/web/tests/character-sheet.test.ts` (new) — verify all six roles have distinct silhouettes, walk params, and idle sequences; no two idle sequences are identical.

### Task 2 — Distinct silhouettes + scale variation in AgentSprite

Rewrite `drawCharacter` in `AgentSprite.ts` so each role draws a genuinely different silhouette: CEO (tall, upright, broad shoulders, tie + lapel), Backend (medium, hunched, hoodie + headphones), Frontend/Designer (tall, energetic, spiky hair + bright scarf), QA (medium, slim, glasses + clipboard), DevOps (broad, work vest + tool belt), Research (slim, short, notebook + reading posture). Apply per-role scale from the character sheet (§11). Accessories must read at 16px. No recoloring — shape differences first.

**Files:** `apps/web/app/office/agents/AgentSprite.ts` (rewrite draw), `apps/web/app/office/Palette.ts` (extend ROLE_COLORS with accessory colors)
**Tests:** extend `apps/web/tests/office-pixi.test.ts` — verify each role produces a non-empty texture set and the silhouette hash (pixel sum over a down-state frame) differs between every pair of roles.

### Task 3 — Unique walking animations per character

Rewrite the walk frame generation so each role has its own stride length, bounce amplitude, arm swing, and posture offset per the character sheet (§9). CEO = controlled/low bounce, Backend = short stride/medium bounce/hunched, Designer = energetic/high bounce, QA = cautious/low bounce/frequent micro-stops, DevOps = purposeful/medium bounce, Research = relaxed/low bounce. Add a 3rd walk frame for roles that need it. Speed variation flows through `AgentMovement` via the per-role speed multiplier.

**Files:** `apps/web/app/office/agents/AgentSprite.ts` (walk frames), `apps/web/app/office/agents/AgentMovement.ts` (per-role speed + micro-stop for QA), `apps/web/app/office/agents/AgentEntity.ts` (pass walk params)
**Tests:** extend `office-pixi.test.ts` — verify walk frame counts and that walk textures differ from idle textures per role.

### Task 4 — Per-role idle behavior trees

Implement an `IdleBehaviorRunner` that cycles each role through its unique idle sequence from the character sheet (§8): CEO (check task board → look around → walk → observe), Backend (type → pause → stretch → type), Designer (stand → inspect board → sit → type), QA (look at monitor → stand → inspect → return), DevOps (check monitor → walk to server → inspect → return), Research (read → write → think → read). Each step has a weighted duration range (§22). The runner drives `AgentEntity` to move/pose locally without leaving their workstation zone. Only runs when the agent is in `idle`/`waiting` and not moving.

**Files:** `apps/web/app/office/agents/IdleBehaviorRunner.ts` (new), `apps/web/app/office/agents/AgentEntity.ts` (wire runner), `apps/web/app/office/VirtualOffice.ts` (tick the runner)
**Tests:** `apps/web/tests/idle-behavior.test.ts` (new) — verify each role has a unique sequence, the runner advances steps on tick, and it does not run while the agent is walking/working.

### Task 5 — Per-role working animations

Differentiate the seated/working frames per role (§16): Backend = rapid typing + occasional thinking pause + secondary monitor glance, Designer = drawing motion + standing + board check, QA = rapid test interaction + pause + examine + retest, DevOps = monitoring + server check + walk between racks, Research = reading + writing + thinking, CEO = monitoring + task board reading + communicating. Add role-specific working sub-frames so `working`/`coding`/`testing`/`reviewing`/`reading` each have distinct animations per role where applicable.

**Files:** `apps/web/app/office/agents/AgentSprite.ts` (per-role working frames), `apps/web/app/office/agents/AgentEntity.ts` (sub-activity cycling)
**Tests:** extend `office-pixi.test.ts` — verify working frame sets differ between roles and between activity kinds.

### Task 6 — Interrupt system + return-to-task memory

Add an interrupt priority system (§19) to `AgentEntity`: LOW (idle activity), MEDIUM (normal message), HIGH (task assignment), CRITICAL (server failure). A higher-priority event interrupts the current animation, stores `previousState` + `previousActivity`, and the agent resumes after the interrupt resolves (§20). Implement `interrupt(priority, event)` and `resume()` . The idle behavior runner yields to interrupts. `VirtualOffice` routes `agent.error`/`agent.blocked` as CRITICAL, `agent.task.assigned` as HIGH, messages as MEDIUM.

**Files:** `apps/web/app/office/agents/AgentEntity.ts` (interrupt state), `apps/web/app/office/VirtualOffice.ts` (priority routing), `apps/web/app/office/agents/IdleBehaviorRunner.ts` (yield)
**Tests:** `apps/web/tests/interrupt.test.ts` (new) — verify a CRITICAL interrupt overrides a MEDIUM one, previous state is restored on resume, and the idle runner pauses during an interrupt.

### Task 7 — Richer agent-to-agent interactions + message kinds

Differentiate message envelope visuals by `MessageKind` (§13): normal = small floating icon, urgent = fast pulsing icon, bug report = warning icon, approval = checkmark, meeting request = calendar icon, emergency = agent physically walks to recipient instead of sending an envelope. Implement physical conversations (§14): sender walks to recipient, both turn to face each other, speech indicators appear, then sender leaves and recipient resumes. Add the physical-walk path for `emergency` kind in `VirtualOffice.message()`.

**Files:** `apps/web/app/office/effects/OfficeEffects.ts` (per-kind envelope visuals), `apps/web/app/office/VirtualOffice.ts` (physical conversation + emergency walk)
**Tests:** extend `office-pixi.test.ts` — verify each message kind produces a distinct envelope texture; verify emergency kind triggers a walk instead of an envelope.

### Task 8 — Environmental micro-animations

Add subtle ambient animations to `OfficeWorld` (§17): coffee steam on the break room machine, monitor flicker on occupied desks, server LED blink cycle, clock hand movement, plant sway, notification bounce on the task board. These run on the world `update(t)` tick and are purely cosmetic. Keep them subtle — 1-2px motion, slow cycles.

**Files:** `apps/web/app/office/world/OfficeWorld.ts` (micro-animation layer)
**Tests:** extend `office-pixi.test.ts` — verify the world update tick does not throw and the micro-animation containers are populated.

### Task 9 — Contextual reactions + character introduction/exit

Implement contextual reactions (§18): when an agent walks past a seated agent, the seated agent briefly turns toward the walker. When CEO enters a room, nearby developers stop typing and look. Implement character introduction (§26): new agents enter through the door, look around, then walk to their workstation. Implement exit (§27): offline agents walk to the exit door then disappear; crashed agents freeze + dim.

**Files:** `apps/web/app/office/agents/AgentEntity.ts` (reaction + intro/exit states), `apps/web/app/office/VirtualOffice.ts` (intro/exit orchestration), `apps/web/app/office/agents/AgentSprite.ts` (intro/exit frames if needed)
**Tests:** extend `office-pixi.test.ts` — verify intro state moves the agent from door to workstation; verify exit state moves toward the door; verify contextual reaction turns the agent toward a nearby walker.

### Task 10 — Final verification + QA report

Run `pnpm -r typecheck`, `pnpm --filter @jheckbot/web test`, `pnpm --filter @jheckbot/web build`. Fix any failures. Write QA report to `docs/superpowers/qa/20260902_characters_rework_v2.md` documenting what was changed, what was verified, and known limitations (e.g., browser visual QA not performed per dev-server restriction).

**Files:** QA report (new)
**Tests:** all existing + new tests must pass.
