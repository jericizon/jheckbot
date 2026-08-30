# QA Report: Conversation Office Panel

**Spec:** `docs/superpowers/specifications/20260829_conversation_office_panel.md`
**Plan:** `docs/superpowers/plans/20260829_conversation_office_panel.md`
**Date:** 20260829

## Summary

Implemented a side office panel on the conversation page. The panel shows the project’s office agents (CEO + employees) in a compact `OfficeScene` and makes the characters visibly move while the conversation is busy.

## Verification Results

### Automated Checks

| Command | Result |
|---|---|
| `pnpm --filter @jheckbot/web typecheck` | ✅ Passed |
| `pnpm --filter @jheckbot/web test` | ✅ 86 tests passed |
| `pnpm --filter @jheckbot/api typecheck` | ✅ Passed |
| `pnpm --filter @jheckbot/api test` | ✅ 724 tests passed |
| `pnpm --filter @jheckbot/web build` | ✅ Built successfully |

### Manual / Code Review

- **Layout:** `pages/conversations/[id].vue` now wraps the chat and a right-side `<aside>` in a `flex` row. The panel is `hidden xl:flex w-80` so the chat remains full-width below `xl:`.
- **Data flow:** `ConversationOfficePanel` fetches the project office via `GET /api/projects/:projectId/office`, computes `ceo`/`employees`, and subscribes to office events for live refresh.
- **Animation:**
  - All characters now have a subtle `animate-unit-bob` idle motion in `OfficeMiniFigure`.
  - When `busy` (conversation `agentRunning || agentStarting`) or the agent status is `working/thinking/communicating/reviewing/testing`, the character uses `animate-busy-bob` or `animate-walk-bounce`.
  - A speech bubble (`...` when busy, `💬` when communicating/thinking) appears above the character.
  - The mouth animates (`animate-talk-mouth`) when `talking`.
- **Dark mode:** All new elements use semantic CSS variables (`bg-surface-elevated`, `border-border`, `text-content`) and existing `dark:` patterns from the project.
- **Accessibility:** Decorative face/animation elements are `aria-hidden`; the character button retains its `aria-label`; the panel `aside` has `aria-label="Project office"`.

### Limitations / Out of Scope

- Mobile (`< xl:`) hides the office panel; no toggle/drawer in this first version.
- The `busy` state is a UI-only visual cue; it does not mutate real agent statuses.
- No automated component test was added because the workspace does not include `@vue/test-utils`. Existing unit and integration tests pass without regression.

### Files Changed

- `apps/web/app/components/office/ConversationOfficePanel.vue` (new)
- `apps/web/app/components/office/OfficeScene.vue` (compact + busy props)
- `apps/web/app/components/office/OfficeCharacter.vue` (movement, speech bubble)
- `apps/web/app/components/office/OfficeMiniFigure.vue` (busy/talking, mouth animation, default idle bob)
- `apps/web/app/components/office/OfficeCubicle.vue` (forward busy)
- `apps/web/app/components/office/OfficeCornerOffice.vue` (forward busy)
- `apps/web/app/components/office/OfficeConferenceRoom.vue` (forward busy)
- `apps/web/app/pages/conversations/[id].vue` (split layout + panel)
- `apps/web/tailwind.config.js` (new `talk-bubble`, `talk-mouth`, `busy-bob` keyframes)
- `docs/superpowers/specifications/20260829_conversation_office_panel.md` (new)
- `docs/superpowers/plans/20260829_conversation_office_panel.md` (new)

## Conclusion

All verification commands pass and the code review confirms the feature meets the acceptance criteria. The conversation page now renders a live office panel on large screens with visibly moving characters.
