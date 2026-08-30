# QA Report: Conversation Sidebar Mobile Toggle & Overlay

**Date:** 20260830

## Summary

Fixed the conversation page on mobile preview so the sidebar conversation list can be opened and closed from the office view and the dim overlay is visible behind the sidebar on small screens.

## Root Cause

- The office panel header (`ConversationOfficePanel.vue`) only showed the "Office" title and had no sidebar toggle, so there was no way to open the conversation list when the mobile chat drawer was closed.
- The sidebar overlay in `ConversationSidebar.vue` used `z-30` while the mobile full-screen chat drawer used the same `z-30`. When both were open the chat drawer painted on top of the overlay, so the dark backdrop did not appear.

## Changes

- `apps/web/app/components/office/ConversationOfficePanel.vue`
  - Added a hamburger toggle button in the office panel header, visible below the `xl:` breakpoint (`xl:hidden`) where the chat is not a persistent rail.
  - Uses `useSidebar().toggle` to open/close the conversation sidebar.
  - Toggle has `aria-label="Toggle sidebar"`, `title`, and a `44px` touch target.

- `apps/web/app/components/ConversationSidebar.vue`
  - Raised the mobile sidebar backdrop from `z-30` to `z-40` so it sits above the full-screen chat drawer.
  - Raised the sidebar panel from `z-40` to `z-50` so it stays above its own backdrop.
  - Changed the overlay `div` to a `<button type="button" aria-label="Close sidebar">` so it is keyboard accessible and clearly dismissible.

## Verification Results

### Automated Checks

| Command | Result |
|---|---|
| `pnpm --filter @jheckbot/web typecheck` | Passed |
| `pnpm --filter @jheckbot/web test` | 86 tests passed |
| `pnpm --filter @jheckbot/web build` | Built successfully |
| `pnpm --filter @jheckbot/api typecheck` | Passed |
| `pnpm --filter @jheckbot/api test` | 726 tests passed |

### Manual / Code Review

- **Mobile / tablet (`< xl:`):** The office panel header now shows a hamburger icon that toggles the conversation sidebar.
- **Sidebar open on mobile:** The dim overlay (`bg-black/40`, `z-40`) now appears above the mobile chat drawer (`z-30`) and office content, and clicking it closes the sidebar.
- **Sidebar panel on mobile:** Renders at `z-50` so it stays above the backdrop and chat drawer.
- **Desktop (`>= xl:`):** The toggle is hidden; the existing desktop sidebar and chat rail layouts are unchanged.
- **Accessibility:** The overlay is now a real button with an accessible label; the toggle button has `aria-label`/`title` and a minimum `44px` touch target.
- **Visual style:** Uses existing semantic tokens (`bg-surface`, `bg-surface-subtle`, `text-content`, `text-content-subtle`, `border-border`).

### Known Limitations

- Manual visual testing in a real mobile viewport was not performed because a live preview/dev server was not started in this session.
- No focus trap is applied to the sidebar; users can close it by clicking the overlay or the existing close path.

## Files Changed

- `apps/web/app/components/office/ConversationOfficePanel.vue`
- `apps/web/app/components/ConversationSidebar.vue`
- `docs/superpowers/qa/20260830_conversation_sidebar_mobile_toggle.md` (new)

## Conclusion

All automated verification passes. The conversation page now has a reachable mobile sidebar toggle and the sidebar overlay correctly covers the underlying content, including the mobile chat drawer.
