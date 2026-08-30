# QA Report: Conversation Office Relayout

**Spec:** `docs/superpowers/specifications/20260829_conversation_office_panel.md`  
**Plan:** `docs/superpowers/plans/20260829_conversation_office_panel.md`  
**Date:** 20260829

## Summary

Relayout of the conversation page so the virtual office is the large central workspace and the chat becomes a narrow right-side panel, similar to YouTube live comments next to a video.

## Verification Results

### Automated Checks

| Command | Result |
|---|---|
| `pnpm --filter @jheckbot/web typecheck` | Passed |
| `pnpm --filter @jheckbot/web test` | 86 tests passed |
| `pnpm --filter @jheckbot/api typecheck` | Passed |
| `pnpm --filter @jheckbot/api test` | 724 tests passed |
| `pnpm --filter @jheckbot/web build` | Built successfully |

### What Changed

- `apps/web/app/components/office/OfficeCharacter.vue`
  - Removed the rounded card-like button padding/hover surface; the agent is now just the character.
  - Moved the agent name from below the character to a small name tag above the head, like a game.
  - Speech bubble still appears above the head when the agent is talking.

- `apps/web/app/components/office/OfficeCubicle.vue`
  - Removed the cubicle room card wrapper; it now renders only the `OfficeCharacter`.

- `apps/web/app/components/office/OfficeCornerOffice.vue`
  - Removed the CEO office room card wrapper; it now renders only the CEO `OfficeCharacter`.

- `apps/web/app/components/office/OfficeConferenceRoom.vue`
  - Removed the conference room card wrapper and "Conference Room" / "Planning..." nameplate.
  - Now renders only the meeting participants as a compact cluster of `OfficeCharacter`s, or nothing when empty.

- `apps/web/app/pages/conversations/[id].vue`
  - Split layout now shows the office in the center (`flex-1`) and the conversation chat in a right-side `aside` (`hidden xl:flex`).
  - Chat panel uses a raised surface and left border (`bg-surface-elevated border-l border-border`) like a side comments rail.
  - Chat panel is now resizable: drag the 1px vertical strip on its left edge to change the width; it is clamped between `260px` and `480px`.
  - Conversation messages and input drop the centered `max-w-3xl` constraint so they fit the narrow panel.
  - The old right-side office panel was removed; the office now lives in the main content area.

- `apps/web/app/components/office/ConversationOfficePanel.vue`
  - No longer a side panel: removed `border-l` and `bg-surface-elevated`.
  - Removed forced `compact` mode.
  - Added `p-4` framing and a full-height scene container.

- `apps/web/app/components/office/OfficeScene.vue`
  - New `fullHeight` prop. When true, the scene section and the inner stage both fill the available height, so the office uses the full central area.
  - Existing non-full behavior is preserved for the standalone project/office pages.

### Manual / Code Review

- **Layout:** The conversation page is now a three-column desktop view: conversation list sidebar, central office, right-side chat.
- **Responsive:** Chat panel is hidden below `xl:`; the office and conversation sidebar adapt to the available width.
- **Data flow:** Unchanged. `ConversationOfficePanel` still loads the project office and subscribes to office events for live agent movement.
- **Visual style:** Characters now appear directly on the office surface without individual cubicle/room cards, and each agent has a name tag above its head.
- **Animation:** All live agent movement, speech bubbles, busy bob, and mouth animations continue to work because the same `OfficeScene` / `OfficeCharacter` chain is used.
- **Chat interactions:** Message list, input, model picker, skills picker, voice input, queue, live logs, and modals remain in the chat panel and are unchanged in behavior.
- **Accessibility:** The office section keeps `aria-label="Project office"`; the chat aside uses `aria-label="Conversation chat"`.
- **Dark mode / tokens:** All surfaces use existing semantic tokens (`bg-surface`, `bg-surface-elevated`, `border-border`, `text-content`).

### Known Limitations

- Mobile (`< xl:`) hides the chat panel. There is no mobile toggle/drawer yet, so the user cannot view the chat while the office is open on small screens.
- The conference room is no longer rendered as a room card. When no meeting participants exist, the conference area is empty.
- No automated UI layout tests were added; the workspace does not include `@vue/test-utils`.

### Files Changed

- `apps/web/app/pages/conversations/[id].vue`
- `apps/web/app/components/office/ConversationOfficePanel.vue`
- `apps/web/app/components/office/OfficeScene.vue`
- `apps/web/app/components/office/OfficeCharacter.vue`
- `apps/web/app/components/office/OfficeCubicle.vue`
- `apps/web/app/components/office/OfficeCornerOffice.vue`
- `apps/web/app/components/office/OfficeConferenceRoom.vue`
- `docs/superpowers/qa/20260829_conversation_office_relayout.md` (new)

## Conclusion

All verification commands pass. The conversation page now places the office as the dominant central workspace and the chat as a compact right-side comments panel, matching the requested YouTube-live-comments layout while preserving the existing live agent behavior and conversation functionality.
