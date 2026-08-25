# QA Report: Pin a Conversation

## Summary
Added an `is_pinned` flag to conversations. Pinned conversations appear at the top of the Active sidebar and can be unpinned. The change spans the database, API, and frontend sidebar.

## Acceptance Criteria Verified
- [x] `conversations` table has `is_pinned` boolean via migration `008_conversation_pin.sql`.
- [x] `GET /api/conversations/active` includes pinned conversations and sorts them first.
- [x] `PATCH /api/conversations/:id` accepts `{ isPinned: boolean }`.
- [x] Sidebar shows a pin/unpin toggle and a "Pinned" label for pinned conversations.
- [x] Pinned idle conversations appear in the Active section; the project list excludes them.
- [x] Existing active/running conversations continue to appear in Active.

## Test Results
- `pnpm --filter @jheckbot/api exec vitest run tests/agent-event-repository.test.ts` — 11 passed
- `pnpm --filter @jheckbot/api exec vitest run tests/conversation-service.test.ts tests/conversation-controller.test.ts` — 28 passed
- `pnpm --filter @jheckbot/api typecheck` — passed
- `pnpm --filter @jheckbot/web typecheck` — passed
- `pnpm --filter @jheckbot/web build` — passed
- `pnpm --filter @jheckbot/api build` — passed
- `pnpm lint` — passed (deferred)
- `pnpm test` — 421 passed across packages

## Edge Cases Considered
- Pinning an already active conversation keeps it in Active and at the top.
- Unpinning an idle conversation removes it from Active and returns it to the project list on the next refresh.
- The repository `UPDATE` preserves all existing fields and only changes `is_pinned` when supplied.
- `is_pinned` defaults to `false` for existing and new rows.

## Notes
- Manual runtime verification was not performed because the user manages runtime processes.
- The feature is additive and does not affect existing conversation creation, archiving, or deletion flows.
