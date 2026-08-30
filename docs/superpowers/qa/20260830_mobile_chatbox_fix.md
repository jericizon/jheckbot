# QA Report: Mobile Chatbox Fix

**Date:** 20260830

## Summary

Fixed the missing chatbox on mobile preview for the project and conversation pages.

- On `projects/[id].vue`, the conversation starter is now a sticky bottom footer so it is always reachable on small screens.
- On `conversations/[id].vue`, the chat panel is now a full-screen mobile drawer that opens by default below the `xl:` breakpoint. It can be closed to view the virtual office and reopened via a floating chat toggle.

## Verification Results

### Automated Checks

| Command | Result |
|---|---|
| `pnpm --filter @jheckbot/web typecheck` | Passed |
| `pnpm --filter @jheckbot/web test` | 86 tests passed |
| `pnpm --filter @jheckbot/web build` | Built successfully |
| `pnpm --filter @jheckbot/api typecheck` | Passed |
| `pnpm --filter @jheckbot/api test` | 726 tests passed |

### What Changed

- `apps/web/app/components/ProjectHeader.vue`
  - Added an `extra-actions` slot after the default project agents and settings actions so pages can inject contextual controls (e.g., a mobile chat close button).

- `apps/web/app/pages/conversations/[id].vue`
  - Added `mobileChatOpen` and `chatViewportReady` state to switch between the desktop chat rail and a full-screen mobile chat drawer.
  - The chat `aside` now renders as `fixed inset-0 z-30 w-full` when `mobileChatOpen` is true, and as the original right-side resizable rail (`hidden xl:flex`) on desktop.
  - The resize handle is hidden on mobile with `hidden xl:block`.
  - A floating chat toggle button (`fixed bottom-4 right-4`) appears on mobile when the drawer is closed, with `aria-label="Open chat"` and a chat bubble icon.
  - A close button is injected through `ProjectHeader`'s new `extra-actions` slot when the mobile drawer is open, with `aria-label="Close chat"`.
  - On mobile, the chat drawer opens automatically on mount and closes automatically when the viewport is resized to `xl:` or wider.

- `apps/web/app/pages/projects/[id].vue`
  - Moved the conversation starter out of the scrollable content and into a `shrink-0` bottom footer (`border-t border-border bg-surface`) so it is always visible on mobile.
  - The footer uses `pb-[calc(1rem+env(safe-area-inset-bottom))]` for mobile safe areas.
  - `newConversation()` no longer calls `scrollIntoView` because the input is already in view.

### Manual / Code Review

- **Desktop (`>= xl:`):** Conversation page keeps the resizable right-side chat rail; project page keeps the bottom conversation starter footer. Neither desktop layout is disrupted.
- **Mobile (`< xl:`):** Conversation page shows the full-screen chat drawer first, with the virtual office accessible after closing. Project page always shows the chat input at the bottom.
- **Responsive state:** `updateViewport()` runs on mount and on window resize, and `mobileChatOpen` is SSR-safe (defaults to `false`, then opens on client after viewport is measured to avoid hydration mismatches).
- **Accessibility:** Icon-only buttons have `aria-label` and `title` attributes. The chat aside keeps `aria-label="Conversation chat"`.
- **Touch targets:** The floating toggle is `48px`, and the header close button uses `p-1.5` plus a `w-5 h-5` icon, giving a comfortably tappable hit area.
- **Visual style:** New UI uses existing semantic tokens (`bg-surface`, `bg-surface-elevated`, `border-border`, `text-content`, `text-content-subtle`).
- **Data flow:** Conversation message sending, live output, logs, model picker, skills picker, and queued messages are unchanged. Project `sendMessage()` is unchanged.

### Known Limitations

- No swipe or drag-to-dismiss gesture was added; users must tap the close button or the floating toggle.
- No focus trap is applied to the mobile chat drawer, but the close button is reachable and the office remains accessible when the drawer is closed.
- Manual visual testing was not performed because a live preview server was not started in this session.

### Files Changed

- `apps/web/app/components/ProjectHeader.vue`
- `apps/web/app/pages/conversations/[id].vue`
- `apps/web/app/pages/projects/[id].vue`
- `docs/superpowers/qa/20260830_mobile_chatbox_fix.md` (new)

## Conclusion

All automated verification passes. The chatbox is now reachable on mobile for both the project and conversation pages while preserving the existing desktop right-side chat rail and project office layouts.
