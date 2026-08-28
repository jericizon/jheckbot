# Transactional MVP Chat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align the JheckBot chat flow with the MVP by making prompt submission atomic, restoring persistent tmux-backed Devin runs, streaming clean replayable output, and persisting assistant history.

**Architecture:** Add a transaction-aware prompt coordinator above the repositories and `AgentManager`. The coordinator locks the conversation row, writes the user prompt, prepares an interactive tmux run, writes initial state/events, and commits with compensation if the process or database fails. `AgentManager` owns one watcher per run, output normalization, lifecycle persistence, subscriptions, and startup recovery; SSE only replays/subscribes and never writes output rows itself.

**Tech Stack:** TypeScript, Express 5, Nuxt 4/Vue 3, PostgreSQL via `pg`, host-side tmux 3.4, Devin CLI v3000.4.25, Vitest, Supertest, pnpm workspaces.

**Spec:** `docs/superpowers/specifications/20260821_115932-transactional-chat.md`

## Global Constraints

- Preserve the MVP’s interactive PTY/tmux requirement; do not fall back to unmanaged direct child processes.
- Use configured `TMUX_BIN` and `DEVIN_BIN` from validated configuration.
- Keep project paths inside enabled allowed roots and verify conversation/project ownership before process creation.
- Treat PostgreSQL and the OS process as separate systems; use transaction rollback, tmux compensation, and startup reconciliation rather than claiming distributed atomicity.
- Do not expose prompts, project contents, cookies, tokens, passwords, or environment secrets in logs or QA artifacts.
- Do not add a prompt queue, a second agent provider, Cloudflare deployment, or unrelated UI redesign.
- The application server is user-managed; never start a dev, preview, watch, or application server command.
- Run focused tests after each slice and full verification before completion.

---

## Task 1: Add transactional database primitives and ordered event cursors

**Files:**
- Create: `apps/api/migrations/004_transactional_chat.sql`
- Modify: `apps/api/src/db/pool.ts`
- Modify: `apps/api/src/repositories/ConversationRepository.ts`
- Modify: `apps/api/src/repositories/MessageRepository.ts`
- Modify: `apps/api/src/repositories/AgentEventRepository.ts`
- Test: `apps/api/tests/db-transaction.test.ts`
- Test: `apps/api/tests/agent-event-repository.test.ts`

**Interfaces:**
- Produces `DbExecutor = Pick<Pool, 'query'>` and `withTransaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T>` from `db/pool.ts`.
- Produces repository methods that accept an optional `DbExecutor`, including `findByIdForUpdate`, `setAgentStatus`, `countActiveAgents`, and ordered event queries.
- Produces `AgentEventRecord.event_sequence: string` and event replay by sequence rather than UUID comparison.

- [ ] **Step 1: Write the failing transaction tests.**

```ts
it('commits a successful transaction and releases the client', async () => {
  const client = fakeClient()
  vi.mocked(pool.connect).mockResolvedValue(client as never)

  await withTransaction(async (transaction) => {
    await transaction.query('SELECT 1')
  })

  expect(client.query).toHaveBeenNthCalledWith(1, 'BEGIN')
  expect(client.query).toHaveBeenLastCalledWith('COMMIT')
  expect(client.release).toHaveBeenCalledOnce()
})

it('rolls back and rethrows the original error', async () => {
  const client = fakeClient()
  vi.mocked(pool.connect).mockResolvedValue(client as never)
  const error = new Error('database unavailable')

  await expect(withTransaction(async () => { throw error })).rejects.toBe(error)
  expect(client.query).toHaveBeenCalledWith('ROLLBACK')
  expect(client.release).toHaveBeenCalledOnce()
})
```

- [ ] **Step 2: Run the focused test to verify it fails because `withTransaction` does not exist.**

Run:

```bash
pnpm --filter @jheckbot/api exec vitest run tests/db-transaction.test.ts
```

Expected: FAIL with a missing transaction helper or equivalent implementation error.

- [ ] **Step 3: Add the transaction helper.**

Implement `withTransaction` with `pool.connect()`, `BEGIN`, callback execution, `COMMIT`, `ROLLBACK` on error, and `client.release()` in `finally`. Do not use the global pool for queries inside the callback.

- [ ] **Step 4: Add migration `004_transactional_chat.sql`.**

The migration must:

1. convert legacy `messages.message_type = 'text'` to `prompt` for user rows, `output` for assistant rows, and `status` for system rows;
2. add a check constraint allowing only `prompt`, `output`, `error`, and `status`;
3. add a monotonic `event_sequence BIGSERIAL NOT NULL` column to `agent_events`;
4. add a unique index on `agent_events.event_sequence`;
5. add a nullable `client_message_id UUID` column to `messages` only if the implementation uses client-side idempotency, with a unique conversation-scoped index.

Do not change existing message content or delete existing event rows.

- [ ] **Step 5: Add transaction-aware repository methods.**

Use the passed `DbExecutor` for every query in the transaction. `findByIdForUpdate` must execute:

```sql
SELECT * FROM conversations WHERE id = $1 FOR UPDATE
```

`countActiveAgents` must count `starting`, `running`, and `stopping` states through the transaction executor. `findByConversation` must use `event_sequence > $2` and `ORDER BY event_sequence ASC`; when a legacy/unknown cursor is received, replay from sequence zero rather than compare UUIDs.

- [ ] **Step 6: Run focused tests and migration-safe repository tests.**

Run:

```bash
pnpm --filter @jheckbot/api exec vitest run tests/db-transaction.test.ts tests/agent-event-repository.test.ts
pnpm --filter @jheckbot/api typecheck
```

Expected: all focused tests pass and the API typecheck remains clean.

- [ ] **Step 7: Checkpoint.**

Review the migration SQL for reversibility/compatibility and run `git diff --check`. Do not apply the migration to a production database in this session.

---

## Task 2: Restore tmux-backed Devin execution and clean output normalization

**Files:**
- Create: `apps/api/src/agent/TerminalOutputNormalizer.ts`
- Modify: `apps/api/src/agent/DevinAdapter.ts`
- Modify: `apps/api/src/agent/TmuxManager.ts`
- Modify: `apps/api/src/config/env.ts`
- Test: `apps/api/tests/terminal-output-normalizer.test.ts`
- Test: `apps/api/tests/devin-adapter.test.ts`
- Test: `apps/api/tests/tmux-manager.test.ts`

**Interfaces:**
- `TerminalOutputNormalizer.normalize(lines: string[]): string[]` strips terminal controls and known Devin chrome while preserving meaningful text.
- `TerminalOutputNormalizer.delta(previous: string[], current: string[]): string[]` emits only newly meaningful lines from a normalized snapshot.
- `DevinAdapter` constructor is `new DevinAdapter(devinBin: string, tmux: TmuxManager)` and delegates session creation, output capture, liveness, stop, and force-kill to `TmuxManager`.

- [ ] **Step 1: Add failing normalizer fixtures from the observed output.**

Include input containing:

```text
\u001b[2J\u001b[H⠀⣴⣾⣶⡄
Devin CLI
❭ test
GLM-5.2 High                       Use /help to see all available slash commands
GLM-5.2 High                                    Context: 20k / 200k tokens (10%)
────────────────────────────────────────────────────────────────
Inspecting package.json...
Running pnpm test...
```

Assert the result contains `Inspecting package.json...` and `Running pnpm test...`, excludes the banner/model/context/separator/prompt lines, and preserves Unicode in meaningful lines.

- [ ] **Step 2: Run the focused normalizer test to verify it fails.**

Run:

```bash
pnpm --filter @jheckbot/api exec vitest run tests/terminal-output-normalizer.test.ts
```

Expected: FAIL because the normalizer does not exist.

- [ ] **Step 3: Implement the normalizer conservatively.**

Strip ANSI CSI/OSC/control sequences, normalize carriage-return redraws, filter only the known chrome patterns, remove empty lines, and deduplicate repeated normalized snapshots. Do not remove arbitrary lines containing user/project text.

- [ ] **Step 4: Write the failing tmux-backed adapter tests.**

Assert that `DevinAdapter.start()` calls `tmux.createSession()` with an interactive Devin command, model flags, `--resume` when present, and the validated `cwd`; assert that `captureOutput`, `isRunning`, `stop`, and `forceKill` delegate to tmux.

- [ ] **Step 5: Run adapter tests to verify the current direct-child-process implementation fails the tmux expectations.**

Run:

```bash
pnpm --filter @jheckbot/api exec vitest run tests/devin-adapter.test.ts
```

Expected: FAIL because the current adapter calls `spawn()` directly and does not use tmux.

- [ ] **Step 6: Restore the DevinAdapter/TmuxManager boundary.**

Remove direct `spawn()` and `execSync('devin list ...')` from `DevinAdapter`. Build the Devin interactive command with safe argument escaping, call `TmuxManager.createSession`, and expose tmux-backed output/liveness/termination methods. Update capture to include scrollback needed for reconnect and preserve session names exactly as `jheckbot-{projectSlug}-{conversationId}`.

- [ ] **Step 7: Run the focused adapter, tmux, and normalizer tests.**

Run:

```bash
pnpm --filter @jheckbot/api exec vitest run tests/terminal-output-normalizer.test.ts tests/devin-adapter.test.ts tests/tmux-manager.test.ts
pnpm --filter @jheckbot/api typecheck
```

Expected: all focused tests pass.

- [ ] **Step 8: Checkpoint.**

Verify tmux is available via the configured `TMUX_BIN`; do not create a real Devin session during unit verification.

---

## Task 3: Implement one watcher per run, lifecycle persistence, and startup recovery

**Files:**
- Modify: `apps/api/src/agent/AgentManager.ts`
- Modify: `apps/api/src/repositories/ConversationRepository.ts`
- Modify: `apps/api/src/repositories/MessageRepository.ts`
- Modify: `apps/api/src/repositories/AgentEventRepository.ts`
- Modify: `apps/api/src/server.ts`
- Test: `apps/api/tests/agent-manager.test.ts`

**Interfaces:**
- `AgentManager.prepareRun(options): PreparedAgentRun` creates the tmux session but does not register a watcher until commit succeeds.
- `PreparedAgentRun.commit(): AgentRun` registers the run and starts exactly one watcher.
- `PreparedAgentRun.rollback(): void` force-kills the newly-created tmux session and removes pending process state.
- `AgentManager.subscribe(conversationId, listener): () => void` subscribes to persisted `AgentStreamEvent` objects.
- `AgentManager.recoverSessions(): Promise<void>` reconciles active DB conversations with matching tmux sessions.

- [ ] **Step 1: Add failing lifecycle tests.**

Cover these behaviors:

```ts
it('does not register a watcher until the transaction commits', () => { /* prepare, assert no active run */ })
it('rollback kills the prepared tmux session', () => { /* prepare, rollback */ })
it('persists one assistant message when a run completes', async () => { /* emit clean output, session disappears */ })
it('releases the DB-backed run state after failure or stop', async () => { /* terminal transition */ })
it('recovers a matching active tmux session after manager construction', async () => { /* DB active row + tmux session */ })
```

- [ ] **Step 2: Run the focused lifecycle tests to verify failure.**

Run:

```bash
pnpm --filter @jheckbot/api exec vitest run tests/agent-manager.test.ts
```

Expected: FAIL for missing preparation, watcher, assistant persistence, and recovery behavior.

- [ ] **Step 3: Add run state and subscription lifecycle.**

Track `conversationId`, `projectSlug`, `sessionName`, `userMessageId`, `status`, `startedAt`, `outputBuffer`, normalized snapshot, and watcher handle. Ensure one watcher exists per conversation regardless of SSE client count.

- [ ] **Step 4: Implement buffered output watching.**

Use one manager-level interval per run to capture tmux output, normalize it, compute deltas, append to the run buffer, and flush an output event when either 500ms has elapsed since the last flush or the buffer reaches 4KB. Publish only after the event is persisted. Ensure watcher callbacks cannot overlap when a database write is slow.

- [ ] **Step 5: Implement terminal transitions and assistant persistence.**

When tmux disappears:

- capture and flush the final delta;
- classify exit as `completed` or `failed` using the available runner state;
- persist the final clean transcript as `role='assistant', message_type='output'` when non-empty;
- persist a `message_type='error'`/`status` record for a visible failure or stop;
- persist the terminal status event;
- update conversation status to `idle` after terminal event persistence;
- release the run lock and clear the watcher.

- [ ] **Step 6: Implement startup recovery.**

Before the API listens, load active conversation rows, list tmux sessions, match exact deterministic session names, rebuild runs, and start watchers. For active DB rows with no matching session, persist `failed`/`idle` reconciliation and leave no in-memory lock. Do not attach unknown sessions to a conversation.

- [ ] **Step 7: Run focused lifecycle tests and typecheck.**

Run:

```bash
pnpm --filter @jheckbot/api exec vitest run tests/agent-manager.test.ts
pnpm --filter @jheckbot/api typecheck
```

Expected: all lifecycle tests pass and the manager compiles without direct-child-process APIs.

---

## Task 4: Add the atomic prompt command and API integration

**Files:**
- Create: `apps/api/src/services/PromptExecutionService.ts`
- Modify: `apps/api/src/controllers/ConversationController.ts`
- Modify: `apps/api/src/controllers/AgentController.ts`
- Modify: `apps/api/src/routes/conversation.routes.ts`
- Modify: `apps/api/src/app.ts`
- Test: `apps/api/tests/prompt-execution.test.ts`
- Test: `apps/api/tests/conversation-controller.test.ts`

**Interfaces:**
- `PromptExecutionService.send(input: { conversationId: string; prompt: string; model?: string }): Promise<{ message: MessageRecord; run: AgentRun }>`.
- The service owns transaction ordering, row locking, global active-session limit, ownership validation, `prepareRun`, initial status/event writes, commit, and compensation.
- `ConversationController.createMessage` calls `PromptExecutionService.send` with a user-only request body and returns HTTP `202`.
- `AgentController.start` either delegates to the same service for compatibility or is removed from the user-facing route; no frontend path may bypass the atomic coordinator.

- [ ] **Step 1: Write failing service tests for the atomic contract.**

Required cases:

```ts
it('persists one prompt and starts one run in the same accepted command', async () => { /* assert query order and 202 result */ })
it('rolls back the prompt and calls prepared.rollback when tmux startup fails', async () => { /* assert no accepted message */ })
it('returns 409 for a live active conversation before creating a process', async () => { /* assert no createSession */ })
it('rejects a conversation/project mismatch before process creation', async () => { /* assert no createSession */ })
it('returns 429 when the global active run count is three', async () => { /* assert no createSession */ })
```

- [ ] **Step 2: Run the focused service tests to verify failure.**

Run:

```bash
pnpm --filter @jheckbot/api exec vitest run tests/prompt-execution.test.ts
```

Expected: FAIL because no atomic prompt service exists.

- [ ] **Step 3: Implement service transaction ordering.**

Inside `withTransaction`:

1. acquire a PostgreSQL advisory transaction lock for the global active-run count;
2. load the conversation with `FOR UPDATE`;
3. load the referenced project and validate enabled ownership/path;
4. inspect/reconcile an existing matching tmux session;
5. reject a live active run with `AgentManagerError(409)`;
6. enforce the maximum of three active database runs;
7. insert the user message with `message_type='prompt'`;
8. mark the conversation `starting`;
9. call `AgentManager.prepareRun`;
10. insert the initial status event;
11. allow `withTransaction` to commit;
12. call `prepared.commit()` only after commit succeeds.

On any error, call `prepared.rollback()` if preparation occurred, release locks through transaction rollback, and return a controlled error.

- [ ] **Step 4: Wire the single endpoint.**

Change `POST /api/conversations/:id/messages` to accept `{ content, model }`, reject empty/oversized content and client-supplied roles, call the service, and return `{ message, run }` with `202`. Keep `GET /messages` unchanged except for the new persisted message types.

- [ ] **Step 5: Add project ownership and input validation tests at the controller boundary.**

Assert invalid UUIDs return `400`, missing/blank content returns `400`, mismatch returns `400`/`404` as defined by the service, active run returns `409`, and unexpected errors reach the existing generic error handler without stack traces.

- [ ] **Step 6: Run API focused tests.**

Run:

```bash
pnpm --filter @jheckbot/api exec vitest run tests/prompt-execution.test.ts tests/conversation-controller.test.ts tests/message-service.test.ts tests/agent-manager.test.ts
pnpm --filter @jheckbot/api typecheck
```

Expected: all focused tests pass.

---

## Task 5: Replace per-client SSE polling with ordered replay and subscriptions

**Files:**
- Modify: `apps/api/src/controllers/AgentController.ts`
- Modify: `apps/api/src/repositories/AgentEventRepository.ts`
- Modify: `apps/api/src/agent/AgentManager.ts`
- Modify: `apps/api/src/routes/conversation.routes.ts`
- Test: `apps/api/tests/agent-controller.test.ts`
- Test: `apps/api/tests/sse-replay.test.ts`

**Interfaces:**
- SSE event IDs are monotonic `event_sequence` values emitted for status and output events.
- `AgentManager.subscribe()` returns an unsubscribe function and emits only already-persisted events.
- `AgentEventRepository.findByConversation(conversationId, lastEventId?)` returns ordered events after the cursor.

- [ ] **Step 1: Write failing SSE tests.**

Cover:

```ts
it('replays events after a monotonic Last-Event-ID without UUID ordering', async () => { /* assert SQL/cursor result */ })
it('does not create database rows from an SSE GET request', async () => { /* assert eventRepo.create not called */ })
it('delivers queued live events after replay without duplication', async () => { /* connect, emit, assert once */ })
it('sends exactly one terminal status event and closes', async () => { /* complete run */ })
```

- [ ] **Step 2: Run SSE tests to verify failure.**

Run:

```bash
pnpm --filter @jheckbot/api exec vitest run tests/agent-controller.test.ts tests/sse-replay.test.ts
```

Expected: FAIL because current SSE polls per connection, writes output rows itself, and uses UUID cursors.

- [ ] **Step 3: Implement replay-before-live subscription safely.**

Subscribe before querying replay, buffer events received during replay, send database replay in sequence order, then flush only buffered events with a sequence greater than the replay watermark. Write each event ID and event payload once. Unsubscribe and close the response on request close or terminal status.

- [ ] **Step 4: Remove controller-side output persistence and interval polling.**

`AgentController.streamEvents` may read/replay and subscribe, but it must not call `AgentEventRepository.create` for output and must not start a watcher per client.

- [ ] **Step 5: Run focused SSE tests and typecheck.**

Run:

```bash
pnpm --filter @jheckbot/api exec vitest run tests/agent-controller.test.ts tests/sse-replay.test.ts
pnpm --filter @jheckbot/api typecheck
```

Expected: all SSE tests pass.

---

## Task 6: Align the Nuxt chat UI with the atomic API and SSR reconnection

**Files:**
- Modify: `apps/web/app/composables/useAuth.ts`
- Modify: `apps/web/app/composables/useConversations.ts`
- Modify: `apps/web/app/pages/conversations/[id].vue`
- Modify: `apps/web/app/composables/useSSE.ts`
- Test: `apps/web/tests/conversation-chat.test.ts`

**Interfaces:**
- `useConversations.sendMessage(id, content, model?)` makes exactly one `POST /api/conversations/:id/messages` call and returns `{ message, run }`.
- `useAuth.fetchUser()` forwards the SSR request cookie using `useRequestHeaders(['cookie'])` when running on the server.
- SSE status/output handling treats `completed`, `failed`, `stopped`, and `idle` as terminal/reconciliation states.

- [ ] **Step 1: Write failing web tests for the user-visible contract.**

Test the extracted request/state behavior with a mocked API:

```ts
it('sends one atomic request and replaces the temporary user message with the server message', async () => { /* assert one call and UUID reconciliation */ })
it('removes the temporary message and shows an error when atomic send fails', async () => { /* assert rollback */ })
it('reloads persisted messages after a terminal SSE event', async () => { /* assert refresh */ })
```

- [ ] **Step 2: Run web tests to verify failure.**

Run:

```bash
pnpm --filter @jheckbot/web exec vitest run tests/conversation-chat.test.ts
```

Expected: FAIL because the current page makes separate message/start calls, leaves `temp-*` messages unreconciled, swallows errors, and does not refresh completed history.

- [ ] **Step 3: Change the composable to the atomic send contract.**

Remove the frontend `startAgent` call from the user turn. Send `{ content, model }` through the message endpoint and return the server message/run pair. Retain stop/status/message-history methods needed by the page.

- [ ] **Step 4: Fix page state reconciliation.**

Keep the optimistic user bubble only until the server response arrives, replace its temporary ID with the persisted message ID, remove it on failure, and show a visible error with retry affordance. On terminal status, reload messages and clear the transient live output. Keep the send button/Enter handler disabled while active.

- [ ] **Step 5: Fix SSR auth and reconnect state.**

Forward the incoming cookie during server-side `fetchUser`. On page load, use the persisted conversation status plus agent endpoint result, connect SSE for an active recovered run, and handle `idle` as a terminal state instead of leaving stale running UI.

- [ ] **Step 6: Run web tests and typecheck.**

Run:

```bash
pnpm --filter @jheckbot/web exec vitest run tests/conversation-chat.test.ts tests/smoke.test.ts
pnpm --filter @jheckbot/web typecheck
```

Expected: all web tests pass.

---

## Task 7: Add API integration coverage and security/health corrections

**Files:**
- Modify: `apps/api/src/app.ts`
- Modify: `apps/api/src/routes/conversation.routes.ts`
- Modify: `apps/api/src/middleware/rateLimiter.ts`
- Modify: `apps/api/src/services/MessageService.ts`
- Modify: `apps/api/src/repositories/MessageRepository.ts`
- Test: `apps/api/tests/chat-api.integration.test.ts`
- Test: `apps/api/tests/health.test.ts`

- [ ] **Step 1: Write failing integration tests.**

Use controller/service fakes and Supertest to assert:

- unauthenticated messages/events return `401`;
- one atomic message request returns `202`;
- two simultaneous sends create one run and one `409`;
- a project/conversation mismatch creates no process;
- completed assistant history is returned by `GET /messages`;
- message route rate limiting is actually mounted;
- health reports database, tmux, and Devin readiness accurately.

- [ ] **Step 2: Run the integration tests to verify missing behavior.**

Run:

```bash
pnpm --filter @jheckbot/api exec vitest run tests/chat-api.integration.test.ts tests/health.test.ts
```

Expected: FAIL for the currently missing atomic route, persisted assistant history, isolation check, limiter placement, and readiness checks.

- [ ] **Step 3: Fix route mounting and message validation.**

Mount `messageLimiter` on the nested message router before registering message routes. Validate role/message type at the service/repository boundary and use the MVP types only.

- [ ] **Step 4: Implement accurate health readiness.**

Use a lightweight database query and `TmuxManager.isAvailable()`/Devin availability. Report `available`, `missing`, or `unknown` based on actual checks without claiming agent readiness from the Devin binary alone.

- [ ] **Step 5: Run integration tests and API typecheck.**

Run:

```bash
pnpm --filter @jheckbot/api exec vitest run tests/chat-api.integration.test.ts tests/health.test.ts
pnpm --filter @jheckbot/api typecheck
```

Expected: all integration tests pass.

---

## Task 8: Full verification, runtime QA, and QA report

**Files:**
- Create: `docs/superpowers/qa/20260821_115932-transactional-chat.md`
- Create/update: reusable E2E spec only after the live objective passes, following the QA skill’s artifact rules.

- [ ] **Step 1: Run the complete automated suite.**

Run:

```bash
pnpm test
pnpm typecheck
pnpm build
pnpm lint
```

Expected: exit code `0` for each command. Record exact test counts and any deferred-lint output.

- [ ] **Step 2: Capture the runtime baseline without starting servers.**

Record branch/worktree state, runtime versions, `/health`, tmux availability, database readiness, and a disposable fixture project path. Do not include credentials, cookies, tokens, or full sensitive project contents.

- [ ] **Step 3: Run the dedicated headless real-user QA pass.**

The QA owner will exercise:

1. three realistic sequential turns;
2. clean output and terminal status;
3. refresh after completion;
4. browser disconnect/reconnect during an active run;
5. stop and failure recovery;
6. simultaneous/double submission;
7. project isolation and invalid IDs;
8. global active-session limit;
9. console/network errors and SSE cursor replay.

Use the evidence bundle defined in the specification and save screenshots/transcripts under `docs/qa-artifacts/<timestamp>_transactional-chat/` if the runner supports them.

- [ ] **Step 4: For each QA defect, reproduce with a regression test before fixing.**

Record the exact input, HTTP status/body, request payload, runtime state, root cause, owner layer, fix, and rerun result. Keep the implementation-to-QA loop at three cycles maximum; escalate if still blocked.

- [ ] **Step 5: Write the QA report.**

Mark every acceptance criterion Pass/Fail/Blocked, include automated evidence, runtime evidence, limitations, cleanup status, and why the previous tests missed each fixed defect.

- [ ] **Step 6: Run the final quality gate.**

Apply `code-review-and-quality`, `code-simplification`, cleanup of only clearly safe in-scope dead code, and `verification-before-completion`. Review the final diff and run the complete verification commands again after any cleanup.

---

## Checkpoint: After Tasks 1–3

- [ ] Transaction helper and ordered event migration compile.
- [ ] Tmux adapter and output normalizer tests pass.
- [ ] AgentManager watcher/recovery tests pass.
- [ ] API typecheck passes.
- [ ] No direct `spawn()` or `devin list` process handling remains in the adapter.

## Checkpoint: After Tasks 4–6

- [ ] Atomic message endpoint tests pass.
- [ ] SSE replay/subscription tests pass.
- [ ] Web chat tests pass.
- [ ] API and web typechecks pass.
- [ ] No frontend user-turn path calls separate message and agent-start requests.

## Checkpoint: Complete

- [ ] Full automated verification passes.
- [ ] Real-user QA objective passes or limitations are explicitly reported.
- [ ] Assistant history survives reload and recovered active runs are visible.
- [ ] No known blocking correctness, security, architecture, or performance findings remain.
- [ ] QA report exists under `docs/superpowers/qa/`.

## Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Interactive TUI capture cannot be losslessly normalized | High | Isolate parser, use real output fixtures, stop and surface limitation if information is lost. |
| tmux starts before PostgreSQL commit and the process exits during the commit window | High | Track prepared session, rollback/kill on error, reconcile unknown sessions on startup. |
| Two API instances race across the same conversation | High | PostgreSQL row lock plus persisted status; do not rely on in-memory state. |
| SSE replay/live subscription race | High | Subscribe before replay, queue live events, flush past replay watermark only. |
| Existing browser sends legacy Last-Event-ID UUIDs | Medium | Treat unknown/legacy cursors as sequence zero and replay safely. |
| API restart leaves stale DB `running` rows | Medium | Startup recovery reconciles every active row against exact tmux session names. |
| The current worktree contains an uncommitted direct-child-process refactor | Medium | Reconcile edits deliberately; never reset or checkout over user changes. |
| Insufficient disk space | Medium | Avoid large artifacts, check available disk before QA/browser installation, and report if insufficient. |

## Execution order

Tasks are sequential because the prompt coordinator depends on transaction primitives and tmux lifecycle interfaces; SSE depends on the watcher; the frontend depends on the atomic API response. Unit tests are written and run red before each implementation slice, then focused green verification runs before advancing.
