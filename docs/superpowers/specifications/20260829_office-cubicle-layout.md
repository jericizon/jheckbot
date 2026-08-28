# Specification: Office Cubicle Layout (Clash-of-Clans-style preview)

## Objective

Redesign the JheckBot Office scene so every agent has their own distinct,
bounded personal workspace (a cubicle), rendered in a colorful, stylized
cartoon aesthetic inspired by Clash of Clans' village preview — but adapted
to an office theme. The CEO occupies a larger central corner office;
employees occupy individual cubicle tiles arranged in a grid around it.

**User story:** As an office viewer, I want to see each agent in their own
clearly-bounded cubicle with their desk, status, and role visible at a
glance, presented in a playful cartoon tile-game style, so the office feels
like a real workspace village rather than a flat list.

**Why:** The current ring layout gives agents shared positions with no
personal space. Cubicles make each agent's space legible and distinct while
keeping the engaging CoC-style cartoon presentation.

## Tech Stack

- Vue 3.5 (`<script setup lang="ts">`) + Nuxt 4.5
- Tailwind CSS 6 (via `@nuxtjs/tailwindcss`), `darkMode: 'class'`
- TypeScript 7
- Vitest 4 (unit tests)
- `@jheckbot/shared` types (`OfficeAgent`, `AgentStatus`)
- No new runtime dependencies. No backend/API/data-model changes.

## Commands

```bash
# From repo root
pnpm --filter @jheckbot/web test        # run web unit tests
pnpm --filter @jheckbot/web typecheck   # tsc --noEmit
pnpm --filter @jheckbot/web lint        # lint (currently deferred/no-op)
pnpm dev                                # start dev servers (user-managed)
```

## Project Structure

Files in scope (all under `apps/web/app/`):

```
components/office/
  OfficeScene.vue        → MODIFY: replace ring layout with cubicle grid
  OfficeCharacter.vue    → MODIFY: restyle for inside-cubicle presentation
  OfficeCubicle.vue      → CREATE: a single agent's walled cubicle tile
  OfficeCornerOffice.vue → CREATE: the CEO's larger central office tile
utils/
  cubicleLayout.ts       → CREATE: grid positioning math (pure, testable)
  agentStatus.ts         → MODIFY: extend status prop mapping (cubicle prop)
tailwind.config.js       → MODIFY: add cubicle-themed animations/keyframes
tests/
  cubicle-layout.test.ts → CREATE: unit tests for positioning math
  office.test.ts         → KEEP GREEN: existing composable/util tests
```

Out of scope: `OfficeTaskPanel.vue`, `OfficeActivityPanel.vue`,
`OfficeChatButton.vue`, `CEOChat.vue`, `OfficeStatusBadge.vue`, the parent
page (`pages/office/index.vue`), composables, API, shared package.

## Code Style

Follow existing conventions in `apps/web/app/components/office/`:

- `<script setup lang="ts">` with explicit `import` statements.
- Props via `defineProps<{ ... }>()`; emits via `defineEmits<{ ... }>()`.
- Composables/utilities are pure functions in `utils/`, unit-tested.
- Tailwind utility classes inline; semantic color tokens (`surface`,
  `content`, `border`, `accent`) for chrome, literal cartoon colors
  (emerald/amber/sky) for the playful tile layer — matches the current
  CoC reskin convention.
- Dark-mode variants via `dark:` classes (existing pattern).
- Comments: 1-2 lines, say what + why, no backstory.

Example of the positioning utility style:

```ts
// utils/cubicleLayout.ts
export interface CubiclePosition {
  row: number
  col: number
  left: number  // % of scene
  top: number   // % of scene
}

// Grid cells around a reserved center cell for the CEO.
export function gridPositions(count: number, cols: number): CubiclePosition[] { ... }
```

## Testing Strategy

- **Unit (Vitest):** Pure layout math in `utils/cubicleLayout.ts` —
  grid sizing, cell positions, center-cell reservation, edge cases
  (0, 1, many agents, overflow). New file `tests/cubicle-layout.test.ts`.
- **Typecheck:** `pnpm typecheck` must pass (template + script compile).
- **Existing tests:** `tests/office.test.ts` (20 tests) must stay green —
  it covers composables/utils, not rendering, so it should be unaffected.
- **Manual visual QA:** Documented in the QA report — verify responsive
  breakpoints, dark mode, empty/loading states, and large headcount.
- No E2E added (no E2E harness exists for web per `package.json`).

## Boundaries

- **Always do:** Run `pnpm test` + `pnpm typecheck` before claiming done;
  keep existing tests green; follow existing component conventions; derive
  all game-like elements from real `OfficeAgent` data; support dark mode
  and responsive breakpoints.
- **Ask first:** Adding new runtime dependencies; changing the
  `OfficeScene` props/emits contract (would touch the parent page); editing
  `.env` or local env override files.
- **Never do:** Fabricate agent data (levels/XP) not present in the model;
  modify the parent page, composables, API, or shared package; start dev
  servers (user-managed per project rules); commit secrets.

## Success Criteria

1. **Every agent has a distinct, bounded cubicle tile** with visible
   partition walls — no two agents share a tile, and each tile is clearly
   delimited from its neighbors.
2. **CEO occupies a larger central corner office** tile, visually distinct
   from employee cubicles (bigger, different roof/signage).
3. **CoC-style cartoon aesthetic, office-adapted:** bright colors, rounded
   shapes, drop shadows, playful idle animations, tile-grid floor — but
   props read as office furniture (desk, monitor, chair, nameplate), not
   medieval huts.
4. **Each cubicle shows:** agent avatar, name, role nameplate, a status
   indicator prop (lit monitor / coffee / warning), and the existing
   status dot + activity bar.
5. **Responsive:** layout reflows cleanly on mobile (1-2 cols) and desktop
   (3-4 cols); no overflow or overlap at any breakpoint.
6. **Dark mode** renders correctly (existing `dark:` convention).
7. **Empty + loading states** preserved (existing branches kept).
8. **No regressions:** `pnpm test` (65+ tests) and `pnpm typecheck` pass.
9. **New unit tests** for `cubicleLayout.ts` pass and cover edge cases.
10. **Scene height scales** with headcount so all cubicles fit inside the
    frame without clipping.

## Open Questions

None blocking. Direction chosen (per user request + best judgment):
cartoon office floor, CEO central corner office, employee cubicle grid,
each cubicle with desk props + partition walls + status prop + role
nameplate. If the user wants a different arrangement (concentric rings,
L/U-shape) or terrain (grass vs office floor), the spec updates before
implementation.
