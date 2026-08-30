# Plan: Conversation Office Panel

**Spec:** `docs/superpowers/specifications/20260829_conversation_office_panel.md`
**Branch:** `feat/interactive`
**Date:** 20260829

## Architecture

```
┌──────────────────────────────────────────────┐
│            apps/web (Nuxt)                   │
│                                              │
│  pages/conversations/[id].vue                │
│    ├─ ConversationSidebar (left)             │
│    ├─ Chat area (center)                     │
│    └─ ConversationOfficePanel (right, xl:)   │
│         ├─ useOffices().getOrCreateByProject │
│         ├─ useOfficeEvents (live refresh)    │
│         └─ OfficeScene (compact mode)        │
│              ├─ OfficeCornerOffice           │
│              └─ OfficeCubicle                │
│                   └─ OfficeCharacter         │
│                        └─ OfficeMiniFigure   │
└──────────────────────────────────────────────┘
```

## Tasks

### Task 1: Tailwind animation tokens

- **Files:** `apps/web/tailwind.config.js`
- **Acceptance:** New `animate-talk` and `animate-busy-bob` keyframes exist.
- **Notes:**
  - `talk`: slight scale + translateY pop on a 1.2s loop.
  - `busy-bob`: faster unit-bob with a subtle side-to-side sway.

### Task 2: OfficeMiniFigure talking/busy animation

- **Files:** `apps/web/app/components/office/OfficeMiniFigure.vue`
- **Acceptance:**
  - New `talking` and `busy` props.
  - `talking` opens/closes the mouth on a loop.
  - `busy` adds a faster walk-bounce + sway.
- **Notes:** Keep decorative face elements `aria-hidden`.

### Task 3: OfficeCharacter speech bubble and movement

- **Files:** `apps/web/app/components/office/OfficeCharacter.vue`
- **Acceptance:**
  - Computes `walking` from `working/thinking/communicating/reviewing/testing` statuses.
  - Computes `talking` from `communicating/thinking` statuses.
  - Adds a small speech bubble above the character when `talking`.
  - Forwards `busy` to `OfficeMiniFigure`.
- **Notes:** Speech bubble uses `💬` or `...` and is hidden from screen readers.

### Task 4: OfficeCubicle and OfficeConferenceRoom forward busy

- **Files:** `apps/web/app/components/office/OfficeCubicle.vue`, `apps/web/app/components/office/OfficeConferenceRoom.vue`
- **Acceptance:** Both components accept and forward a `busy` prop to `OfficeCharacter`.

### Task 5: OfficeScene compact and busy modes

- **Files:** `apps/web/app/components/office/OfficeScene.vue`
- **Acceptance:**
  - New `compact` prop reduces scene height and padding for a side panel.
  - New `busy` prop is forwarded to all `OfficeCharacter` / `OfficeConferenceRoom` instances.
- **Notes:** Compact mode keeps the same layout math but uses smaller cell sizes.

### Task 6: ConversationOfficePanel component

- **Files:** `apps/web/app/components/office/ConversationOfficePanel.vue`
- **Acceptance:**
  - Props: `projectId: string`, `busy?: boolean`.
  - Fetches office + agents on mount via `useOffices().getOrCreateByProject`.
  - Subscribes to office events for live refresh.
  - Computes `ceo` and `employees` using `findCeo` / `findEmployees` from `useOffice.ts`.
  - Renders a compact `OfficeScene` with the `busy` prop.
  - Shows loading and empty states.

### Task 7: Conversation page split layout

- **Files:** `apps/web/app/pages/conversations/[id].vue`
- **Acceptance:**
  - Wraps main chat area + office panel in a `flex` row.
  - Office panel is `hidden xl:flex w-80`.
  - `busy` prop to office panel is `agentRunning || agentStarting`.
  - Existing chat `max-w-3xl` is kept; it auto-shrinks when panel is visible.
  - Mobile unchanged.

### Task 8: Tests and typecheck

- **Files:** `apps/web/tests/conversation-office-panel.test.ts`, `apps/web/app/components/office/ConversationOfficePanel.vue`
- **Acceptance:**
  - New component test for loading, empty, and agent rendering.
  - `pnpm --filter @jheckbot/web test` passes.
  - `pnpm --filter @jheckbot/web typecheck` passes.

### Task 9: QA report

- **Files:** `docs/superpowers/qa/20260829_conversation_office_panel.md`
- **Acceptance:** Document manual verification of split layout, animations, dark mode, and test results.

## Verification

- `pnpm --filter @jheckbot/web test`
- `pnpm --filter @jheckbot/web typecheck`
- `pnpm --filter @jheckbot/api test` (regression)
- `pnpm --filter @jheckbot/api typecheck` (regression)
