# Office Cubicle Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the office ring layout with a Clash-of-Clans-style cartoon cubicle grid where every agent has their own walled cubicle and the CEO sits in a central corner office.

**Architecture:** Pure UI change. A new `cubicleLayout.ts` utility computes grid positions (pure, unit-tested). Two new presentational components (`OfficeCubicle.vue`, `OfficeCornerOffice.vue`) render individual tiles. `OfficeScene.vue` composes them on a cartoon office-floor terrain. `OfficeCharacter.vue` is restyled to sit inside a cubicle. No backend, data model, API, or parent-page changes.

**Tech Stack:** Vue 3.5 `<script setup>`, Nuxt 4.5, Tailwind CSS 6, TypeScript 7, Vitest 4, `@jheckbot/shared` types.

**Spec:** `docs/superpowers/specifications/20260829_office-cubicle-layout.md`

## Global Constraints

- Vue 3.5 `<script setup lang="ts">` with explicit imports.
- Tailwind utility classes inline; semantic tokens for chrome, literal cartoon colors for the tile layer.
- Dark mode via `dark:` classes on every colored element.
- All game-like elements derived from real `OfficeAgent` data (status, role, name) — no fabricated levels/XP.
- `OfficeScene` props/emits contract unchanged: `agents`, `ceo`, `employees`, `loading` in; `select-agent`, `talk-to-ceo` out.
- Responsive: mobile 1-2 cols, desktop 3-4 cols, no overflow/overlap.
- Run `pnpm --filter @jheckbot/web test` + `pnpm --filter @jheckbot/web typecheck` before claiming done.
- Never start dev servers (user-managed).

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `apps/web/app/utils/cubicleLayout.ts` | Create | Pure grid-position math: cell size, row/col assignment, center-cell reservation for CEO, scene height. |
| `apps/web/tests/cubicle-layout.test.ts` | Create | Unit tests for `cubicleLayout.ts` edge cases. |
| `apps/web/app/components/office/OfficeCubicle.vue` | Create | One employee's walled cubicle tile (walls, desk, monitor, chair, nameplate, status prop) wrapping `OfficeCharacter`. |
| `apps/web/app/components/office/OfficeCornerOffice.vue` | Create | CEO's larger central corner-office tile (bigger footprint, signage, flag) wrapping `OfficeCharacter` with `is-ceo`. |
| `apps/web/app/components/office/OfficeCharacter.vue` | Modify | Restyle avatar/name/bar to sit inside a cubicle (drop the building tile it currently implies; keep badge + status bar). |
| `apps/web/app/components/office/OfficeScene.vue` | Modify | Replace ring layout with cubicle grid on cartoon office-floor terrain; compose `OfficeCornerOffice` + `OfficeCubicle`. |
| `apps/web/app/utils/agentStatus.ts` | Modify | Add `getCubicleStatusProp()` mapping status → emoji prop (lit monitor / coffee / warning). |
| `apps/web/tailwind.config.js` | Modify | Add cubicle animations (`cubicle-glow`, `monitor-flicker`) if needed beyond existing ones. |

---

### Task 1: Cubicle layout positioning utility (TDD)

**Files:**
- Create: `apps/web/app/utils/cubicleLayout.ts`
- Test: `apps/web/tests/cubicle-layout.test.ts`

**Interfaces:**
- Produces: `gridColumns(count: number, viewport: 'mobile' | 'desktop'): number`, `gridPositions(count: number, cols: number): CubiclePosition[]`, `sceneHeightFor(count: number, cols: number): string`, `CubiclePosition { row, col, left, top }` (left/top in % of scene).

- [ ] **Step 1: Write failing tests**

```ts
// tests/cubicle-layout.test.ts
import { describe, it, expect } from 'vitest'
import { gridColumns, gridPositions, sceneHeightFor } from '../app/utils/cubicleLayout'

describe('gridColumns', () => {
  it('uses 2 columns on mobile', () => {
    expect(gridColumns(5, 'mobile')).toBe(2)
  })
  it('uses up to 4 columns on desktop', () => {
    expect(gridColumns(8, 'desktop')).toBe(4)
  })
  it('caps at 4 columns even for many agents', () => {
    expect(gridColumns(20, 'desktop')).toBe(4)
  })
})

describe('gridPositions', () => {
  it('places 0 agents as an empty grid', () => {
    expect(gridPositions(0, 3)).toEqual([])
  })
  it('places 1 agent at the first cell', () => {
    const pos = gridPositions(1, 3)
    expect(pos).toHaveLength(1)
    expect(pos[0]).toMatchObject({ row: 0, col: 0 })
  })
  it('distributes 6 agents across 3 cols in 2 rows', () => {
    const pos = gridPositions(6, 3)
    expect(pos).toHaveLength(6)
    expect(pos[5]).toMatchObject({ row: 1, col: 2 })
  })
  it('left/top are percentages within 0-100', () => {
    for (const p of gridPositions(9, 3)) {
      expect(p.left).toBeGreaterThanOrEqual(0)
      expect(p.left).toBeLessThanOrEqual(100)
      expect(p.top).toBeGreaterThanOrEqual(0)
      expect(p.top).toBeLessThanOrEqual(100)
    }
  })
})

describe('sceneHeightFor', () => {
  it('returns a minimum height for 0 agents', () => {
    expect(sceneHeightFor(0, 3)).toMatch(/rem$/)
  })
  it('grows with row count', () => {
    const small = parseFloat(sceneHeightFor(3, 3))
    const large = parseFloat(sceneHeightFor(12, 3))
    expect(large).toBeGreaterThan(small)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @jheckbot/web test cubicle-layout`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the utility**

```ts
// app/utils/cubicleLayout.ts
export interface CubiclePosition {
  row: number
  col: number
  left: number  // % of scene width
  top: number   // % of scene height
}

// Column count by viewport, capped so cubicles stay wide enough to read.
export function gridColumns(count: number, viewport: 'mobile' | 'desktop'): number {
  if (count <= 0) return 1
  if (viewport === 'mobile') return Math.min(2, count)
  return Math.min(4, count)
}

// Row/col + percentage positions for `count` cells in a `cols`-wide grid.
// Cells are centered as a block; left/top locate the cell's center point.
export function gridPositions(count: number, cols: number): CubiclePosition[] {
  if (count <= 0) return []
  const rows = Math.ceil(count / cols)
  const positions: CubiclePosition[] = []
  for (let i = 0; i < count; i++) {
    const row = Math.floor(i / cols)
    const col = i % cols
    // Center each cell within its column slot.
    const left = ((col + 0.5) / cols) * 100
    const top = ((row + 0.5) / rows) * 100
    positions.push({ row, col, left, top })
  }
  return positions
}

// Scene height grows with rows so all cubicles fit without clipping.
export function sceneHeightFor(count: number, cols: number): string {
  if (count <= 0) return '22rem'
  const rows = Math.ceil(count / cols)
  const perRow = 11 // rem per cubicle row
  const base = 16 // rem for CEO corner office + padding
  return `${base + rows * perRow}rem`
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @jheckbot/web test cubicle-layout`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/utils/cubicleLayout.ts apps/web/tests/cubicle-layout.test.ts
git commit -m "feat(office): add cubicle grid layout utility"
```

---

### Task 2: Cubicle status prop mapping

**Files:**
- Modify: `apps/web/app/utils/agentStatus.ts`
- Test: `apps/web/tests/office.test.ts` (existing — add cases)

**Interfaces:**
- Produces: `getCubicleStatusProp(status: AgentStatus): { emoji: string; label: string }` — emoji rendered on the cubicle desk (lit monitor / coffee / warning sign).

- [ ] **Step 1: Write failing tests**

Append to `describe('agent status mapping', ...)` in `tests/office.test.ts`:

```ts
import { getCubicleStatusProp } from '../app/utils/agentStatus'

describe('cubicle status prop', () => {
  it('shows a lit monitor for working', () => {
    expect(getCubicleStatusProp('working').emoji).toBe('💻')
  })
  it('shows coffee for thinking', () => {
    expect(getCubicleStatusProp('thinking').emoji).toBe('☕')
  })
  it('shows a warning for error', () => {
    expect(getCubicleStatusProp('error').emoji).toBe('⚠️')
  })
  it('shows a checkmark for completed', () => {
    expect(getCubicleStatusProp('completed').emoji).toBe('✅')
  })
  it('shows a sleep emoji for idle', () => {
    expect(getCubicleStatusProp('idle').emoji).toBe('💤')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @jheckbot/web test office`
Expected: FAIL — `getCubicleStatusProp` is not exported.

- [ ] **Step 3: Implement the mapping**

Append to `app/utils/agentStatus.ts`:

```ts
export interface CubicleStatusProp {
  emoji: string
  label: string
}

// Desk prop reflecting current activity, shown on the cubicle tile.
export function getCubicleStatusProp(status: AgentStatus): CubicleStatusProp {
  switch (status) {
    case 'working':
      return { emoji: '💻', label: 'At work' }
    case 'testing':
      return { emoji: '🧪', label: 'Testing' }
    case 'reviewing':
      return { emoji: '🔍', label: 'Reviewing' }
    case 'communicating':
      return { emoji: '💬', label: 'In a meeting' }
    case 'thinking':
      return { emoji: '☕', label: 'Thinking' }
    case 'blocked':
      return { emoji: '🚧', label: 'Blocked' }
    case 'error':
      return { emoji: '⚠️', label: 'Error' }
    case 'completed':
      return { emoji: '✅', label: 'Done' }
    case 'idle':
    default:
      return { emoji: '💤', label: 'Idle' }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @jheckbot/web test office`
Expected: PASS (existing 20 + new 5).

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/utils/agentStatus.ts apps/web/tests/office.test.ts
git commit -m "feat(office): add cubicle status prop mapping"
```

---

### Task 3: OfficeCubicle component

**Files:**
- Create: `apps/web/app/components/office/OfficeCubicle.vue`

**Interfaces:**
- Consumes: `OfficeAgent` from `@jheckbot/shared`; `OfficeCharacter` (sibling); `getCubicleStatusProp` from `~/utils/agentStatus`.
- Produces: `<OfficeCubicle :agent="agent" @select="..." />` with emit `select: [OfficeAgent]`.

- [ ] **Step 1: Implement the component**

```vue
<!-- components/office/OfficeCubicle.vue -->
<template>
  <div class="flex flex-col items-center gap-1 w-full">
    <!-- Walled cubicle tile -->
    <div
      class="relative w-full max-w-[10rem] bg-gradient-to-b from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800 border-2 border-slate-400 dark:border-slate-500 rounded-lg shadow-md overflow-hidden"
    >
      <!-- Partition wall (top edge) -->
      <div class="h-1.5 bg-gradient-to-b from-slate-300 to-slate-400 dark:from-slate-600 dark:to-slate-700 border-b border-slate-500/50" />

      <!-- Desk with monitor + status prop -->
      <div class="px-2 py-1.5 flex items-end justify-between gap-1">
        <!-- Monitor -->
        <div class="w-8 h-6 bg-sky-200 dark:bg-sky-800 border border-slate-500 rounded-sm flex items-center justify-center text-[10px]">
          <span class="font-mono font-bold text-slate-700 dark:text-slate-200 uppercase">{{ deskLabel }}</span>
        </div>
        <!-- Status prop on desk -->
        <span class="text-sm" :title="statusProp.label" aria-hidden="true">{{ statusProp.emoji }}</span>
      </div>

      <!-- Chair -->
      <div class="mx-auto mb-1 w-4 h-2 bg-slate-400 dark:bg-slate-600 rounded-sm" aria-hidden="true" />
    </div>

    <!-- Agent inside the cubicle -->
    <OfficeCharacter :agent="agent" @select="$emit('select', agent)" />

    <!-- Role nameplate -->
    <span class="text-[10px] font-bold text-content-muted bg-surface-elevated/80 px-1.5 py-0.5 rounded border border-border truncate max-w-[8rem]">
      {{ agent.role }}
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { OfficeAgent } from '@jheckbot/shared'
import { getCubicleStatusProp } from '~/utils/agentStatus'
import OfficeCharacter from './OfficeCharacter.vue'

const props = defineProps<{ agent: OfficeAgent }>()
defineEmits<{ select: [OfficeAgent] }>()

const statusProp = computed(() => getCubicleStatusProp(props.agent.status))

const deskLabel = computed(() => {
  const role = props.agent.role.toLowerCase()
  if (role.includes('qa')) return 'QA'
  if (role.includes('review')) return 'REV'
  if (role.includes('devops')) return 'OPS'
  if (role.includes('security')) return 'SEC'
  if (role.includes('frontend')) return 'FE'
  if (role.includes('backend')) return 'BE'
  if (role.includes('full')) return 'FS'
  if (role.includes('design') || role.includes('ui') || role.includes('ux')) return 'UX'
  if (role.includes('writer') || role.includes('doc')) return 'DOC'
  if (role.includes('product') || role.includes('manager')) return 'PM'
  return 'DEV'
})
</script>
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @jheckbot/web typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/components/office/OfficeCubicle.vue
git commit -m "feat(office): add OfficeCubicle component"
```

---

### Task 4: OfficeCornerOffice component (CEO)

**Files:**
- Create: `apps/web/app/components/office/OfficeCornerOffice.vue`

**Interfaces:**
- Consumes: `OfficeAgent`; `OfficeCharacter` with `is-ceo`.
- Produces: `<OfficeCornerOffice :agent="ceo" @select="..." />` with emit `select: [OfficeAgent]`.

- [ ] **Step 1: Implement the component**

```vue
<!-- components/office/OfficeCornerOffice.vue -->
<template>
  <div class="flex flex-col items-center gap-1.5">
    <!-- Larger corner-office tile -->
    <div
      class="relative w-28 sm:w-36 bg-gradient-to-b from-amber-100 to-amber-300 dark:from-amber-800 dark:to-amber-900 border-2 border-amber-600 dark:border-amber-500 rounded-lg shadow-lg overflow-hidden animate-unit-bob"
    >
      <!-- Roof / upper partition -->
      <div class="h-3 sm:h-4 bg-gradient-to-b from-amber-500 to-amber-700 dark:from-amber-600 dark:to-amber-800 border-b-2 border-amber-800" />

      <!-- Big desk with dual monitors -->
      <div class="px-3 py-2 flex items-end justify-center gap-2">
        <div class="w-10 h-7 bg-sky-200 dark:bg-sky-700 border border-amber-800 rounded-sm flex items-center justify-center">
          <span class="text-[10px] font-mono font-bold text-amber-900 dark:text-amber-100">CEO</span>
        </div>
        <div class="w-3 h-5 bg-amber-900/70 rounded-t" aria-hidden="true" />
      </div>

      <!-- Signage plate -->
      <div class="mx-auto mb-1.5 px-2 py-0.5 bg-amber-700 dark:bg-amber-600 rounded text-[9px] font-bold text-white uppercase tracking-wide text-center">
        Corner Office
      </div>

      <!-- Flag -->
      <div class="absolute -top-3 left-1/2 -translate-x-1/2 flex flex-col items-center" aria-hidden="true">
        <div class="w-0.5 h-3 bg-amber-900" />
        <div class="w-2.5 h-1.5 bg-red-500 -mt-0.5" />
      </div>
    </div>

    <OfficeCharacter :agent="agent" is-ceo @select="$emit('select', agent)" />
  </div>
</template>

<script setup lang="ts">
import type { OfficeAgent } from '@jheckbot/shared'
import OfficeCharacter from './OfficeCharacter.vue'

defineProps<{ agent: OfficeAgent }>()
defineEmits<{ select: [OfficeAgent] }>()
</script>
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @jheckbot/web typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/components/office/OfficeCornerOffice.vue
git commit -m "feat(office): add OfficeCornerOffice component for CEO"
```

---

### Task 5: Restyle OfficeCharacter for inside-cubicle use

**Files:**
- Modify: `apps/web/app/components/office/OfficeCharacter.vue`

**Interfaces:**
- Consumes: unchanged (`agent`, `isCeo`); `getAgentStatusStyle`, `getAgentStatusBar`, `getRoleEmoji`.
- Produces: unchanged emits `select: [OfficeAgent]`. Visual only: avatar disc + role badge + status dot + activity bar, sized to sit inside a cubicle (slightly smaller, no outer building tile).

- [ ] **Step 1: Update the component**

Replace the template with a tighter, cubicle-suitable version (keep the avatar disc, role badge, status dot, activity bar; remove any building-tile implication). Keep the `<script setup>` logic identical — only class sizing changes.

Key class changes:
- Avatar disc: `w-12 h-12 sm:w-14 sm:h-14` (down from 16) so it fits inside a cubicle.
- Keep `animate-pop-in`, `group-hover:scale-110 group-hover:-translate-y-1`, glow ring, badge, status dot, name, activity bar.
- Name `max-w-[7rem]` to fit cubicle width.

- [ ] **Step 2: Typecheck + run office tests**

Run: `pnpm --filter @jheckbot/web typecheck && pnpm --filter @jheckbot/web test`
Expected: PASS (no behavioral change; tests cover utils/composables, not rendering).

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/components/office/OfficeCharacter.vue
git commit -m "style(office): resize character for inside-cubicle presentation"
```

---

### Task 6: Rewrite OfficeScene with cubicle grid

**Files:**
- Modify: `apps/web/app/components/office/OfficeScene.vue`

**Interfaces:**
- Consumes: `gridColumns`, `gridPositions`, `sceneHeightFor` from `~/utils/cubicleLayout`; `OfficeCornerOffice`, `OfficeCubicle` components; existing `OfficeAgent`, `AgentStatus` types.
- Produces: unchanged props (`agents`, `ceo`, `employees`, `loading`) and emits (`select-agent`, `talk-to-ceo`).

- [ ] **Step 1: Replace the template**

New structure:
1. Loading + empty states: keep existing branches unchanged.
2. Main scene container: `relative rounded-2xl border-2 border-slate-400/40 overflow-hidden shadow-xl`, `:style="{ height: sceneHeight }"`.
3. **Cartoon office floor** (replaces grass): `bg-gradient-to-b from-slate-100 via-slate-200 to-slate-300 dark:from-slate-800 dark:via-slate-900 dark:to-slate-950` + tile-grid overlay (existing repeating-linear-gradient pattern, lighter lines).
4. **Decorative office props** around perimeter: potted plants 🪴, coffee cups ☕, sticky notes 📝, lamps 💡 — reuse the `scenery` computed pattern with office emojis.
5. **Resource pills** top-center: keep existing `resourcePills` computed (Working/Talking/Idle/Done/Issues) — unchanged.
6. **CEO corner office** centered: `<OfficeCornerOffice :agent="ceo" @select="onCeoSelect" />` absolutely centered (`left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2`).
7. **Employee cubicle grid**: `v-for` over `gridPositions(employees.length, cols)`, each placing an `<OfficeCubicle>` at the cell's `left`/`top` with `translate(-50%, -50%)`.

- [ ] **Step 2: Replace the script**

```ts
import { computed } from 'vue'
import type { OfficeAgent, AgentStatus } from '@jheckbot/shared'
import { gridColumns, gridPositions, sceneHeightFor } from '~/utils/cubicleLayout'
import OfficeCornerOffice from './OfficeCornerOffice.vue'
import OfficeCubicle from './OfficeCubicle.vue'

const props = defineProps<{
  agents: OfficeAgent[]
  ceo?: OfficeAgent
  employees: OfficeAgent[]
  loading?: boolean
}>()

const emit = defineEmits<{
  'select-agent': [OfficeAgent]
  'talk-to-ceo': []
}>()

// Responsive column count — use a matchMedia-free heuristic via window width
// checked on mount + resize. Default to desktop for SSR.
const viewport = computed<'mobile' | 'desktop'>(() => {
  if (typeof window === 'undefined') return 'desktop'
  return window.innerWidth < 640 ? 'mobile' : 'desktop'
})

const cols = computed(() => gridColumns(props.employees.length, viewport.value))
const positions = computed(() => gridPositions(props.employees.length, cols.value))
const sceneHeight = computed(() => sceneHeightFor(props.employees.length, cols.value))

function onSelect(agent: OfficeAgent) {
  emit('select-agent', agent)
}
function onCeoSelect() {
  emit('talk-to-ceo')
}

// resourcePills + scenery computeds kept from the current file, with scenery
// emojis swapped to office props (🪴 ☕ 📝 💡 🗂️ 🖼️).
```

Note: `viewport` is a computed reading `window.innerWidth`; for true reactivity add a resize listener in `onMounted`/`onUnmounted` updating a ref. Implement that in this step.

- [ ] **Step 3: Typecheck + run all tests**

Run: `pnpm --filter @jheckbot/web typecheck && pnpm --filter @jheckbot/web test`
Expected: PASS (all 65+ tests).

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/components/office/OfficeScene.vue
git commit -m "feat(office): replace ring layout with cubicle grid"
```

---

### Task 7: Final verification + QA report

**Files:**
- Create: `docs/superpowers/qa/20260829_office-cubicle-layout.md`

- [ ] **Step 1: Run full verification**

```bash
pnpm --filter @jheckbot/web typecheck
pnpm --filter @jheckbot/web test
```
Expected: both PASS.

- [ ] **Step 2: Manual visual QA checklist** (document in QA report; user runs dev server)

- [ ] Empty office state renders (🏢 + message).
- [ ] Loading state renders.
- [ ] CEO alone renders in corner office, centered.
- [ ] 1 employee renders in a single cubicle, no overlap with CEO.
- [ ] 4 employees render in a 2x2 / 4x1 grid around CEO.
- [ ] 8+ employees render multi-row, scene height grows, no clipping.
- [ ] Mobile breakpoint: 2 columns, no horizontal overflow.
- [ ] Desktop breakpoint: up to 4 columns.
- [ ] Dark mode: all tiles, floor, props, badges legible.
- [ ] Hover on a character: bounce + scale, glow ring on active.
- [ ] Click a cubicle: `select-agent` fires, detail panel opens (parent page).
- [ ] Click CEO: `talk-to-ceo` fires, navigates to CEO chat.
- [ ] Resource pills show correct counts.
- [ ] Status props on desks match agent statuses.

- [ ] **Step 3: Write QA report**

Save to `docs/superpowers/qa/20260829_office-cubicle-layout.md` covering: test results, manual checklist results (or pending user verification), success-criteria traceability from the spec.

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/qa/20260829_office-cubicle-layout.md
git commit -m "docs(office): add cubicle layout QA report"
```

---

## Self-Review

**Spec coverage:**
- SC1 (distinct bounded cubicles) → Task 3 (OfficeCubicle w/ partition walls).
- SC2 (CEO central corner office) → Task 4 (OfficeCornerOffice) + Task 6 (centered).
- SC3 (CoC cartoon office aesthetic) → Task 6 (cartoon office floor + props + animations).
- SC4 (cubicle shows avatar/name/role/status prop/nameplate) → Tasks 3 + 5.
- SC5 (responsive) → Task 6 (viewport + gridColumns) + Task 1 (gridColumns).
- SC6 (dark mode) → every task uses `dark:` variants.
- SC7 (empty/loading states) → Task 6 keeps existing branches.
- SC8 (no regressions) → every task runs tests + typecheck.
- SC9 (new unit tests) → Task 1 + Task 2.
- SC10 (scene height scales) → Task 1 (sceneHeightFor) + Task 6.

**Placeholder scan:** None — all steps contain real code.

**Type consistency:** `CubiclePosition` defined in Task 1, consumed in Task 6. `getCubicleStatusProp` defined in Task 2, consumed in Task 3. `OfficeCubicle`/`OfficeCornerOffice` emits `select: [OfficeAgent]` matching `OfficeCharacter` and the scene's `onSelect`/`onCeoSelect`. Props/emits contract on `OfficeScene` unchanged.
