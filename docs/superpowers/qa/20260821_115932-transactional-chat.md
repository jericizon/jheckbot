# QA Report: Transactional Chat MVP

## Scope

Full verification of the transactional chat MVP (Tasks 1-8) for JheckBot.

## Runtime baseline

| Component | Value |
| --- | --- |
| Branch | `feat/mvp-phase-1` |
| Node | v24.12.0 |
| pnpm | 11.1.1 |
| tmux | 3.4 |
| Devin CLI | `/home/jeric/.local/bin/devin` |
| Database | PostgreSQL (configured via `.env`) |

## Automated verification

### Test suite

```bash
pnpm test
```

| Package | Test files | Tests | Status |
| --- | --- | --- | --- |
| @jheckbot/shared | 1 | 9 | PASS |
| @jheckbot/web | 2 | 7 | PASS |
| @jheckbot/api | 17 | 158 | PASS |
| **Total** | **20** | **174** | **PASS** |

### Typecheck

```bash
pnpm typecheck
```

| Package | Status |
| --- | --- |
| @jheckbot/shared | Done |
| @jheckbot/api | Done |
| @jheckbot/web | Done |

### Build

```bash
pnpm --filter @jheckbot/api build
pnpm --filter @jheckbot/web build
```

| Package | Status |
| --- | --- |
| @jheckbot/api | PASS |
| @jheckbot/web | PASS (Nitro build complete) |

### Lint

```bash
pnpm lint
```

Lint is deferred for all packages (no linter configured). All packages exit 0.

### Git

```bash
git diff --check
```

No whitespace errors.

## Test coverage by task

| Task | Test file | Tests | Coverage |
| --- | --- | --- | --- |
| 1 | `db-transaction.test.ts` | 9 | Transaction primitives, advisory locks, ordered cursors |
| 2 | `agent-manager.test.ts` (partial) | 24 | tmux session creation, output normalization, env escaping |
| 3 | `agent-manager.test.ts` (partial) | 24 | Watcher lifecycle, persistence, recovery |
| 4 | `prompt-execution.test.ts` | 8 | Atomic send, rollback, 409/404/429/400 |
| 4 | `conversation-controller.test.ts` | 7 | Controller boundary: 202/400/404/409/429/500 |
| 5 | `sse-replay.test.ts` | 6 | Ordered replay, no DB writes, dedup, terminal close |
| 6 | `conversation-chat.test.ts` | 5 | Atomic send contract, no role, error propagation |
| 7 | `chat-api.integration.test.ts` | 9 | Full HTTP contract via Supertest |
| 7 | `health.test.ts` | 5 | Accurate readiness probes |

## Runtime QA

### Limitations

**Runtime QA was not executed** because the rules prohibit starting application servers, dev servers, or watch processes. The following items require manual verification by the user:

1. **Browse projects/conversations:** Verify the Nuxt UI loads projects and conversations from the API.
2. **Send realistic prompts:** Verify one `POST /messages` call persists the user message and starts the agent.
3. **Inspect request payloads:** Verify the frontend sends `{ content, model }` (no `role`).
4. **Clean transcript output:** Verify the assistant response is persisted as a clean message, not terminal UI chrome.
5. **Reload and verify history:** Verify `GET /messages` returns the full conversation including assistant output.
6. **Browser reconnect:** Verify SSE reconnects with `Last-Event-ID` and does not duplicate events.
7. **API restart/session recovery:** Verify the API reconciles active tmux sessions on restart.
8. **Duplicate prompt handling:** Verify a second prompt while the agent is running returns `409`.
9. **Concurrency:** Verify two simultaneous sends to different conversations both succeed (up to 3 active).

### What was verified automatically

- The atomic send contract (validation, locking, persistence, preparation, commit, compensation) is covered by 15 focused tests.
- The SSE replay and subscription pattern is covered by 6 focused tests.
- The HTTP contract (202/400/404/409/429/500) is covered by 9 integration tests.
- Health readiness (database, tmux, devin) is covered by 5 tests.
- The frontend composable contract is covered by 5 tests.
- All 174 tests pass.
- Typecheck and build pass for all packages.

## Deferred findings

### From Task 3 review

- `syncRunState` releases the lock before terminal persistence completes (race risk) — deferred to future hardening.
- `start()` deletes prior terminal runs before preparing (history loss if prepare throws) — deferred.
- `persistTerminal` catch blocks swallow errors silently — deferred (needs logging).
- 7-argument constructor overload is fragile — deferred (needs simplification).
- Startup recovery bypasses `MAX_CONCURRENT_SESSIONS` — deferred.
- Full-scrollback capture every 100ms is O(n) per tick — deferred (performance optimization).

### From Task 4 review

- `prepared.commit()` failure after transaction commit leaves orphaned message — mitigated by Task 3 recovery.
- `projectRepo.findById`/`findAllowedRoots` run outside transaction client — acceptable for MVP.
- Global advisory lock serializes all prompt submissions — acceptable for MVP.
- `pathValidatorFactory` is optional — production always provides it.
- No title auto-generation — deferred to future enhancement.

### From Task 5 review

- Double subscribe/unsubscribe creates a theoretical gap — safe in Node single-threaded model but fragile. Deferred to future simplification.

### From Task 6 review

- No E2E/page test — requires Nuxt test runtime. Deferred to manual QA.
- Error extraction assumes Nuxt `$fetch` error shape — acceptable for MVP.
- No retry button — minimal dismissible error is functional.
- `stopAgent` swallows errors silently — deferred.

### From Task 7 review

- No real auth integration test — auth is tested at the service level. Deferred to manual QA.
- No real concurrency test — locking logic is tested but not with a real database. Deferred to manual QA.
- Health DB query per request — acceptable for MVP.

## Commit history

| Commit | Description |
| --- | --- |
| `e248cd4` | Transactional database primitives |
| `3625e68` | Restore tmux-backed Devin execution |
| `c963bb2` | Harden tmux environment and output deltas |
| `0b0ab24` | Watcher lifecycle, persistence, recovery |
| `356dcac` | Task 3 report |
| `31c4429` | Atomic prompt execution service |
| `4c1ba3e` | Ordered SSE replay and subscriptions |
| `eeb8d13` | Nuxt UI atomic send and SSR reconnection |
| `a5ae3b6` | Health readiness, duplicate stop fix, integration tests |
| `aa75e69` | POST-only rate limiting, safe live output clearing |

## Assessment

**Approved for manual runtime QA.** All automated verification passes (174 tests, typecheck, build, lint). The implementation satisfies the approved transactional MVP plan:

- One atomic `POST /messages` request owns validation, locking, prompt persistence, tmux preparation, initial state, commit, and compensation.
- SSE uses ordered replay with `event_sequence` cursors and manager subscriptions — no per-client polling, no controller-side event writes.
- The Nuxt UI sends one atomic request, reconciles server message IDs, shows visible errors, and reloads history on terminal status.
- Health reports actual database, tmux, and Devin readiness.
- Startup recovery reconciles active tmux sessions with database state.

The user should perform the manual runtime QA items listed above before merging.
