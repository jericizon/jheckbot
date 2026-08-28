# Implementation Plan: Pin a Conversation

## Overview
Add an `is_pinned` flag to conversations so users can keep selected conversations in the Active sidebar, with the ability to unpin.

## Architecture Decisions
- Add `is_pinned BOOLEAN NOT NULL DEFAULT FALSE` to the `conversations` table via migration.
- Active list query returns rows where `is_pinned = TRUE` or `agent_status` is active, ordered by `is_pinned DESC, updated_at ASC` so pinned items stay at the top.
- Reuse the existing `PATCH /api/conversations/:id` endpoint for pinning; no new route.
- Sidebar adds a pin toggle to each conversation item and excludes pinned conversations from the project list to avoid duplication.

## Task List

### Phase 1: Backend
- [ ] Add migration `008_conversation_pin.sql`.
- [ ] Update `ConversationRecord` and `ConversationRepository` for `is_pinned`.
- [ ] Update `ConversationService.update` input and pass `isPinned` to the repository.
- [ ] Update `ConversationController.update` to accept `req.body.isPinned`.
- [ ] Add unit tests for pinning in `conversation-service.test.ts` and `conversation-controller.test.ts`.

### Phase 2: Frontend
- [ ] Add `is_pinned` to `Conversation` and `ActiveConversation` types in `useConversations.ts` and `useActiveConversations.ts`.
- [ ] Add pin toggle UI to `ConversationSidebar.vue` for both active and project lists.
- [ ] Wire `@pin` event in `pages/conversations/[id].vue` and `pages/projects/[id].vue` to call `convApi.update` and refresh lists.

### Phase 3: Validation
- [ ] Run `pnpm typecheck`.
- [ ] Run `pnpm test`.
- [ ] Run `pnpm build`.
- [ ] Write QA report in `docs/superpowers/qa/20260826_pin-conversation.md`.

## Risks and Mitigations
| Risk | Impact | Mitigation |
|------|--------|------------|
| Active list sort change breaks existing tests | Low | Update tests to include `is_pinned` expectations and verify ordering. |
| Sidebar duplicates pinned conversations | Low | Exclude pinned rows from the project list. |

## Open Questions
- None; design approved by user.
