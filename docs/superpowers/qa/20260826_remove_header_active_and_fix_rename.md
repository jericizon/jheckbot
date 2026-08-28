# QA Report: Remove Header Active/Process Time and Fix Conversation Rename

**Date:** 2026-08-26
**Type:** Bug Fix (UI)
**Classification:** BUGFIX / UPDATE

## Summary

Removed the `Active · {{ elapsedLabel }}` status indicator from the conversation
page header and fixed the conversation title edit button, which was incorrectly
disabled whenever the agent was running.

## Acceptance Criteria

| # | Criterion | Status |
|---|-----------|--------|
| 1 | Header no longer shows "Active" or elapsed process time | Pass |
| 2 | Conversation title is editable while the agent is running | Pass |
| 3 | Conversation title is still editable when the agent is idle | Pass |
| 4 | Title changes persist to the sidebar and backend | Pass |

## Implementation

- **Edited:** `apps/web/app/pages/conversations/[id].vue`
  - Removed the `<span v-if="agentRunning">…Active · {{ elapsedLabel }}</span>`
    block from the `#subtitle` slot inside `ProjectHeader`.
  - Removed `:disabled="agentRunning"` from the conversation title button so
    the input can be activated at any time.
  - Removed the `if (agentRunning.value) return` guard in `startEditTitle()`.

## Validation

- `pnpm --filter @jheckbot/web test` — Pass, 32/32 tests across 6 files.
- `pnpm --filter @jheckbot/web typecheck` — Pass (exit 0).
- `pnpm --filter @jheckbot/web build` — Pass (exit 0, no errors).
- Manual browser validation on the running dev server:
  - Active conversation header no longer renders "Active · 1:56".
  - Clicking the conversation title on an active conversation opens the edit
    input, accepts a new title, and saves it via the API.
  - Sidebar entry updates to reflect the new title.
  - Title editing on idle conversations continues to work (regression check).

## Edge Cases Considered

- **Agent running while user renames:** the API `PATCH` only updates title
  metadata and does not interfere with the agent run.
- **Empty title input:** `saveTitle()` trims, cancels, and reverts to the
  original title if the draft is empty.
- **Unchanged title:** `saveTitle()` short-circuits and skips the API call when
  the title is identical.
- **Blur vs. Enter save:** both `@blur` and `@keydown.enter` handlers call
  `saveTitle()`; the guard `if (!editingTitle.value) return` prevents double
  submission when Enter unmounts the input and triggers a blur.

## Regressions

None observed. The `elapsedLabel` computed and `agentTimer` are still used by
 the live-output "Processing · {{ elapsedLabel }}" indicator, so agent-run
timing feedback is preserved in the message stream. All other `agentRunning`
behaviors (stop button, input placeholder, queued messages) are unchanged.
