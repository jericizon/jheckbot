# Task 3 Implementation Report

## Scope

Implemented Task 3 of the approved transactional MVP chat plan: one manager-owned watcher per active run, normalized buffered output persistence, terminal history/status persistence, lock release, subscriptions, and startup recovery. No application server, watch process, or real Devin/tmux session was started. `.env` files were not edited, and no subagents/reviewers were dispatched.

## Changes

- `apps/api/src/agent/AgentManager.ts:13-47` adds the run/preparation/stream-event contracts. Run state now carries the user message ID, complete clean output buffer, and normalized snapshot.
- `apps/api/src/agent/AgentManager.ts:78-224` adds `PreparedAgentRun`, synchronous `prepareRun`, pending process state, idempotent `commit()`, and compensating `rollback()` through `forceKill`. Preparation is not added to active runs or watched until commit succeeds.
- `apps/api/src/agent/AgentManager.ts:545-757` adds one unref'd manager interval per committed/recovered run. It normalizes snapshots, computes deltas, retains the full transcript, flushes output after 500 ms or 4 KiB, publishes only after the repository write resolves, and prevents overlapping callbacks while a write is pending.
- `apps/api/src/agent/AgentManager.ts:303-394, 619-715` adds terminal handling for natural completion, non-zero exit failure, stop, and stale in-memory runs. Final output is flushed before the terminal transition; successful non-empty transcripts become one assistant/output message, failures/stops become a visible system/error message, the terminal status event is persisted, then `agent_status` is set to `idle` and the in-memory lock/watcher is released.
- `apps/api/src/agent/AgentManager.ts:402-410` adds `subscribe(conversationId, listener)` with idempotent unsubscribe. Subscribers are independent of the single run watcher.
- `apps/api/src/agent/AgentManager.ts:423-458` adds asynchronous startup reconciliation. It loads active DB conversations, compares exact deterministic names (`jheckbot-{projectSlug}-{conversationId}`), rebuilds matching runs, seeds their normalized scrollback baseline, and starts one watcher. Missing exact sessions are reconciled to a failed status event/error message followed by `idle`; unknown tmux sessions are not attached.
- `apps/api/src/repositories/ConversationRepository.ts:146-161` adds active-agent conversation lookup using the existing `DbExecutor` pattern (plus compatibility aliases for callers that use the longer repository names).
- `apps/api/src/agent/DevinAdapter.ts:100-103` exposes the existing `TmuxManager.listSessions()` boundary to manager instances constructed without a directly injected tmux manager. Production wiring still injects the configured `TmuxManager` explicitly.
- `apps/api/src/app.ts:73-86` injects the message/event repositories into `AgentManager`, uses explicit `TmuxManager` wiring, and exposes the manager through `app.locals` for startup recovery.
- `apps/api/src/server.ts:22-30` awaits `agentManager.recoverSessions()` after migrations/seeding and before `app.listen()`.
- `apps/api/tests/agent-manager.test.ts:261-475` adds focused lifecycle coverage for prepare/commit watcher timing, rollback compensation, completed assistant persistence, failure persistence/lock release, 4 KiB flushing, exact-session recovery/reconciliation, and persisted subscription delivery.

`MessageRepository.create()` and `AgentEventRepository.create()` already had the Task 1 transaction-aware executor/message-type/ordered-event contracts needed by the manager, so those two files required no additional implementation change. Terminal writes call those repository methods rather than bypassing them with SQL.

## TDD and validation evidence

### Red

Ran before implementing the Task 3 behavior:

```text
pnpm --filter @jheckbot/api exec vitest run tests/agent-manager.test.ts
```

Result: FAIL, 21 tests failed. The newly added lifecycle suite could not construct the required session-listing boundary (`listSessions` was missing), and the manager had no prepare/watcher/persistence/recovery implementation.

### Green

Focused lifecycle verification:

```text
pnpm --filter @jheckbot/api exec vitest run tests/agent-manager.test.ts
```

Result: PASS, 24 tests passed.

Task 1/2 regression-focused verification:

```text
pnpm --filter @jheckbot/api exec vitest run tests/agent-manager.test.ts tests/agent-event-repository.test.ts tests/devin-adapter.test.ts tests/tmux-manager.test.ts tests/terminal-output-normalizer.test.ts
```

Result: PASS, 5 test files and 63 tests passed.

API package verification:

```text
pnpm --filter @jheckbot/api test
pnpm --filter @jheckbot/api typecheck
pnpm --filter @jheckbot/api build
```

Results: 13 test files and 124 tests passed; typecheck passed; build passed.

Workspace regression verification:

```text
pnpm test
pnpm typecheck
```

Results: shared (9), web (2), and API (124) tests passed; shared/API/web typechecks passed.

Additional checks:

```text
git diff --check
```

Passed. No server/watch process or real external session was used by validation.

## Commit

- `0b0ab24 feat(agent): persist watched run lifecycle`

Only Task 3 implementation/support files were staged for this commit. Existing unrelated worktree changes remain unstaged and untouched, including the existing controller/routes/web changes and `tasks/todo.md`/other superpowers documents.

## Decisions and concerns

1. **tmux exit-code limitation:** `DevinAdapter.getExitCode()` currently returns `null` because tmux does not retain a reliable pane exit code after the session disappears. The manager therefore treats a natural disappearance with `null` as `completed`, treats an available non-zero code as `failed`, and treats an explicit stop as `stopped`. This preserves normal successful Devin completion and is the explicit fallback decision; revisit it if the runner exposes a durable completion/error marker.
2. The existing `AgentController.streamEvents` still contains the pre-Task-5 per-client polling/event-write path, and its stop endpoint still writes its compatibility status event. The manager subscription API is ready, but Task 5 must migrate SSE to replay/subscribe and remove controller-side output/terminal event writes to achieve the final single-event SSE behavior.
3. Startup recovery is wired through `app.locals.agentManager` because `createApp()` currently constructs its dependencies internally. Recovery is awaited before listening, but runtime recovery requires the configured PostgreSQL database and tmux server when the real API is run; those were intentionally not started or exercised here.
4. `prettier --check` was not made a gating requirement because the repository already contains unrelated formatting changes/warnings in the touched legacy files; `git diff --check`, focused tests, package tests, build, and typechecks are clean.
