# Spec: Pin a Conversation

## Objective
Allow users to pin a conversation so it always appears at the top of the **Active** sidebar, even when the agent is idle. Users can unpin it. This keeps important conversations reachable without depending on recent activity or an active agent run.

## Acceptance Criteria
- The `conversations` table stores an `is_pinned` boolean (default `false`).
- `GET /api/conversations/active` returns pinned conversations and currently active (starting/running/stopping) conversations, with pinned ones sorted first.
- `PATCH /api/conversations/:id` accepts `{ isPinned: boolean }` and updates the pin state.
- The sidebar shows a pin/unpin toggle for each conversation.
- Pinned conversations appear in the Active section; unpinned idle conversations fall back to the project list.
- Existing active/running conversations continue to appear in Active.

## Commands
- API unit tests: `pnpm --filter @jheckbot/api exec vitest run tests/conversation-service.test.ts tests/conversation-controller.test.ts`
- Workspace typecheck: `pnpm typecheck`
- Workspace build: `pnpm build`
- Workspace lint: `pnpm lint`

## Project Structure
- Migration: `apps/api/migrations/`
- Repository / service / controller: `apps/api/src/{repositories,services,controllers}/Conversation{Repository,Service,Controller}.ts`
- Frontend API client: `apps/web/app/composables/useConversations.ts`
- Sidebar UI: `apps/web/app/components/ConversationSidebar.vue`
- Page handlers: `apps/web/app/pages/conversations/[id].vue`, `apps/web/app/pages/projects/[id].vue`

## Code Style
- Use `is_pinned` in SQL / repository records and `isPinned` in camel-cased service/controller/API payloads.
- Keep changes additive; do not rename existing columns or change existing sort behavior outside the Active section.
- Add `aria-label` to icon-only pin toggle buttons.

## Testing Strategy
- TDD for service and controller changes using the existing Vitest + mocking setup.
- Assert `listActive` returns pinned conversations and the repository receives the `isPinned` flag.
- Run `pnpm test` and `pnpm typecheck` after both backend and frontend changes.

## Boundaries
- **Always:** run tests before declaring done, validate inputs, follow existing patterns.
- **Ask first:** changing DB schema beyond the `is_pinned` column, adding dependencies.
- **Never:** commit secrets, expose stack traces, remove failing tests without fixing them.

## Success Criteria
- `pnpm test` and `pnpm typecheck` pass.
- A conversation can be pinned and appears at the top of the Active sidebar.
- Unpinning removes it from Active (when idle) and returns it to the project list.
