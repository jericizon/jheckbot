# QA Report: Projects Page Office UI

**Date:** 2026-08-29
**Scope:** Verify the cleaned-up office UI (zoom, seated brainstorm, speech bubbles, walk paths) is applied to the projects detail page (`/projects/[id]`).

## Changes Validated

- `apps/web/app/pages/projects/[id].vue`
  - Removed dead `@select-agent` / `@talk-to-ceo` emits and their handler functions (`onSelectAgent`, `talkToCeo`).
  - Added `agentMessages` ref wired to `AGENT_MESSAGE` events via `handleLiveEvent`.
  - Added `pruneIdleMessages` helper called from `loadOffice` to clear stale bubbles when agents go idle.
  - Passed `:agent-messages="agentMessages"` to `OfficeScene`.

## Validation

### Static

- Typecheck: `tsc --noEmit` — passed (exit 0)
- Web tests: 86 passed across 10 files (exit 0)
- Web build: Nuxt build complete (exit 0)

### Live Browser QA (Playwright MCP)

Base URL: `http://localhost:8800`
Artifacts: `docs/qa-artifacts/20260829_195602_projects_page_office_ui/`

| Screenshot | State |
| ---------- | ----- |
| 001_projects_list.png | Projects list page renders cleanly with 4 projects |
| 002_project_detail_office.png | Project detail page with idle office scene (CEO, QA, Support, Thinking room, walk paths) |
| 003_meeting_active_zoomed.png | Active meeting — scene zoomed (scale 2.4), CEO + Jordan Park communicating |
| 004_meeting_with_bubbles.png | Speech bubbles visible during meeting ("QA, please verify..." / "I'll verify...") |
| 005_idle_after_meeting.png | Idle state after meeting — bubbles pruned, no stale messages |

### Verified Behaviors

1. **Office scene renders on projects page** — Virtual office region present (864×448px), all rooms visible (CEO Office, Thinking room, QA, Support), 18 aria-hidden walk-path/hallway elements.
2. **Zoom on meeting** — When CEO + employee enter `communicating` status, the inner scene transform applies `matrix(2.4, 0, 0, 2.4, ...)` (scale 2.4), zooming to the thinking room.
3. **CEO joins meeting** — CEO status transitions to `communicating` during the meeting (not left in corner office).
4. **Staggered employee arrival** — First employee (Jordan Park) called in while others remain idle, matching the staggered orchestration.
5. **Speech bubbles render** — `AGENT_MESSAGE` events produce visible bubbles with actual message text (not generic placeholders).
6. **Bubble pruning** — After meeting ends and all agents return to idle, `bubbleCount: 0` (no stale messages linger).
7. **No click handlers** — Office characters are display-only; removed `@select-agent` / `@talk-to-ceo` emits cause no runtime errors.

### Console

- 0 blocking errors.
- 1 transient error: stale Nuxt HMR module fetch (`Failed to load module script: ...entry.js?t=...`). This is a known HMR artifact from prior edits and does not block rendering or functionality. Resolved by a dev server restart (user-managed).
- 78 warnings: SSE reconnection noise from the events stream (expected during polling).

## Result

**PASS** — The projects detail page now uses the same cleaned-up office UI as the conversation page. Zoom, seated brainstorming visuals, CEO participation, staggered arrivals, message-driven speech bubbles, and bubble pruning all work correctly.
