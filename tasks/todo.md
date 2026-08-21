# Transactional MVP Chat Work Items

- [x] Task 1: Add transactional database primitives and ordered event cursors
  - Acceptance: `withTransaction`, row-lock repository methods, message-type migration, and monotonic event replay compile and pass focused tests.
  - Verify: `pnpm --filter @jheckbot/api exec vitest run tests/db-transaction.test.ts tests/agent-event-repository.test.ts`; API typecheck — 9 focused tests, API 111 tests, and typecheck passed.
  - Dependencies: None.

- [x] Task 2: Restore tmux-backed Devin execution and clean output normalization
  - Acceptance: DevinAdapter delegates to TmuxManager; normalizer removes observed TUI chrome and preserves meaningful output.
  - Verify: normalizer, adapter, and tmux tests — 33 focused tests and API typecheck passed; review fix round addressed environment escaping and snapshot deduplication.
  - Dependencies: Task 1 migration/contract review only.

- [x] Task 3: Implement one watcher per run, lifecycle persistence, and startup recovery
  - Acceptance: one watcher per active run, assistant/error persistence, terminal lock release, and API restart recovery.
  - Verify: agent-manager focused tests (24/24); API typecheck passed. Review `task-3-review.md` approved with findings (3 important deferred to Task 4/8, 4 minor).
  - Dependencies: Tasks 1 and 2.

- [x] Task 4: Add the atomic prompt command and API integration
  - Acceptance: one message request owns validation, row lock, prompt persistence, tmux preparation, initial state, commit, and compensation.
  - Verify: prompt-execution (8) and conversation-controller (7) tests; API 139 tests; typecheck and build passed. Review `task-4-review.md` approved with findings (2 important deferred, 3 minor).
  - Dependencies: Tasks 1 and 3.

- [x] Task 5: Replace per-client SSE polling with ordered replay and subscriptions
  - Acceptance: ordered cursor replay, one manager watcher, no controller-side event writes, no duplicate reconnect output.
  - Verify: SSE replay tests (6/6); API 145 tests; typecheck passed. Review `task-5-review.md` approved with findings (2 important deferred to Task 7/8, 2 minor).
  - Dependencies: Tasks 1 and 3.

- [x] Task 6: Align the Nuxt chat UI with the atomic API and SSR reconnection
  - Acceptance: one send request, server-ID reconciliation, visible errors, terminal message refresh, authenticated SSR refresh.
  - Verify: web chat tests (5/5); web 7 tests; workspace 161 tests; typecheck passed. Review `task-6-review.md` approved with findings (2 important deferred to Task 8, 3 minor).
  - Dependencies: Tasks 4 and 5.

- [x] Task 7: Add API integration coverage and security/health corrections
  - Acceptance: auth, isolation, concurrency, history, rate limiting, and readiness checks are covered and pass.
  - Verify: integration (9) + health (5) tests; API 158 tests; workspace 174 tests; typecheck and build passed. Review `task-7-review.md` approved with findings (2 important deferred to Task 8, 2 minor).
  - Fixed: duplicate stop event, JSON.parse try/catch, health readiness probes.
  - Dependencies: Tasks 4–6.

- [x] Task 8: Full verification, runtime QA, and QA report
  - Acceptance: full tests/build/typecheck/lint pass and dedicated headless real-user QA reports every acceptance criterion.
  - Verify: 174 tests pass; typecheck, build, lint pass; QA report at `docs/superpowers/qa/20260821_115932-transactional-chat.md`.
  - Runtime QA: not executed (rules prohibit starting servers). 9 manual verification items documented for the user.
  - Fixed: POST-only rate limiting, safe live output clearing.
  - Verify: `pnpm test`; `pnpm typecheck`; `pnpm build`; `pnpm lint`; runtime QA report.
  - Dependencies: Tasks 1–7.

## Checkpoints

- [ ] After Tasks 1–3: database, tmux, normalizer, watcher, recovery, and API typecheck are green.
- [ ] After Tasks 4–6: atomic API, SSE, frontend chat, and both package typechecks are green.
- [ ] Complete: full verification, QA report, final code review, simplification, and evidence-backed completion report.
