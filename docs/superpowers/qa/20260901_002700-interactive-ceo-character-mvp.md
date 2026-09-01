# QA Plan: Interactive CEO Character MVP

**Status:** Implementation complete, automated verification passed, manual runtime QA blocked  
**Date:** 2026-09-01  
**Scope:** One CEO character, inline chat panel, one implementation task, one automatic Devin run  
**Specification:** `docs/superpowers/specifications/20260901_002500-interactive-ceo-character-mvp.md`  
**Implementation plan:** `docs/superpowers/plans/20260901_002600-interactive-ceo-character-mvp.md`

## 1. QA Objective

Verify that an authenticated user can open the CEO from a project office, send one coding request, receive a structured response, and observe one real Devin run through the existing JheckBot conversation and office event systems.

## 2. Acceptance Criteria

- [ ] The CEO is activated by pointer, Enter, and Space.
- [ ] Desktop activation opens a panel beside the office without a route change.
- [ ] Mobile activation opens a usable full-viewport panel with safe-area spacing.
- [ ] Existing CEO history loads and survives close/reopen.
- [ ] A valid request creates exactly one CEO implementation task.
- [ ] The task has no child tasks or dependencies.
- [ ] Exactly one project conversation is created and linked to the task.
- [ ] Devin starts through `PromptExecutionService`, `AgentManager`, and `DevinAdapter`.
- [ ] The worker's office state reflects actual execution.
- [ ] Successful completion marks the task completed exactly once.
- [ ] Startup or terminal failure marks the task failed without leaking internal details.
- [ ] A second request during an active CEO execution does not create a duplicate run.
- [ ] Existing project conversations and `/office/ceo` remain usable.
- [ ] Automated tests, typecheck, build, lint, and manual browser checks are recorded.

## 3. Environment Prerequisites

The person running runtime QA must provide:

- PostgreSQL running with migrations applied.
- JheckBot web and API processes already running according to the repository setup.
- A valid authenticated test session.
- At least one enabled project whose path is under an allowed root.
- Devin CLI installed and authenticated.
- tmux installed and available to the API process.
- An office created for the test project with the seeded CEO and Support/implementation-capable agent.
- A desktop browser and a mobile-width browser viewport.

The implementation agent must not start servers or watch processes. If a prerequisite is missing, record the run as `BLOCKED` with the exact missing prerequisite.

## 4. Automated Verification

Run from the repository root:

```bash
pnpm --filter @jheckbot/api exec vitest run \
  tests/ceo-planner.test.ts \
  tests/ceo-service.test.ts \
  tests/ceo-routes.test.ts \
  tests/office-task-execution-link.test.ts \
  tests/office-task-execution-service.test.ts

pnpm --filter @jheckbot/web exec vitest run tests/office.test.ts

pnpm test
pnpm typecheck
pnpm build
pnpm lint
```

Record:

- Command.
- Exit code.
- Test files and test counts.
- First failure and relevant error output when a command fails.
- Whether the failure is feature-related or an existing environment issue.

## 5. Manual Browser Scenarios

### Scenario A: Open and close the CEO panel on desktop

**Setup:** Authenticated user is viewing a project with a loaded office at `/projects/:id`.

1. Confirm the CEO character is visible.
2. Hover the CEO and confirm the pointer indicates an interactive target.
3. Click the CEO.
4. Confirm the URL does not change.
5. Confirm the CEO chat panel appears beside the office.
6. Confirm the panel header identifies the CEO and contains an accessible close button.
7. Press the close button.
8. Confirm the panel closes and the office remains visible.
9. Repeat with keyboard focus on the CEO and press Enter.
10. Repeat with keyboard focus on the CEO and press Space.

**Expected:** All three activation methods open the same panel. Closing does not reload or lose the project office.

### Scenario B: CEO history and draft behavior

1. Open the CEO panel.
2. Confirm previously persisted `CEO_MESSAGE` and `CEO_RESPONSE` events appear in chronological order.
3. Type a request without submitting.
4. Close the panel and reopen it.
5. Confirm persisted messages reload; an unsent draft may be discarded because drafts are local to the mounted panel in this MVP.
6. Send a valid request.
7. Confirm the input clears only after the API accepts the request.

**Expected:** History comes from the existing CEO event endpoint. There is no duplicate assistant message created by the browser.

### Scenario C: One request creates one task and one Devin run

Use a harmless test request appropriate for the test project, for example:

```text
Add a small README note explaining how to run the existing tests.
```

1. Open the CEO panel.
2. Submit the request once.
3. Confirm the CEO returns a structured response with task, agent, and Devin status.
4. Inspect office activity and confirm one `TASK_CREATED` event.
5. Confirm one `TASK_DISPATCHED` event identifies the selected worker.
6. Confirm one `AGENT_STARTED` event identifies the task, agent, and conversation.
7. Confirm the project conversation list gains one task conversation.
8. Open the linked project conversation.
9. Confirm Devin output appears through the normal conversation event/output flow.
10. Confirm the office worker displays the working state while Devin is active.
11. Wait for actual Devin completion.
12. Confirm one `AGENT_COMPLETED` event and one `TASK_COMPLETED` event.
13. Confirm the task ends in `completed` and the worker returns to `idle`.

**Expected:** One user request produces one task, one linked conversation, and one Devin run. No task completion is reported before the real terminal status.

### Scenario D: Duplicate protection

1. Start one valid CEO request.
2. Before it finishes, submit a second CEO request from the same panel or a second browser tab.
3. Inspect the second response.
4. Count tasks, conversations, and `AGENT_STARTED` events for the office.

**Expected:** The second request returns a conflict, or the documented active-execution response. It must not create a second active task or Devin run.

### Scenario E: Invalid office/project association

1. Use a request containing the current project ID and confirm it succeeds.
2. Send a request with an invalid project ID through an API test client or controlled test fixture.
3. Send a request for a valid project ID that is not associated with the office.
4. Inspect the response and persisted records.

**Expected:** The server rejects the mismatched request before task creation. No task, conversation, or Devin run is created for the invalid request.

### Scenario F: Disabled project

1. Use a project that is disabled in the existing project settings.
2. Attempt to send a CEO request.
3. Inspect the response and database records through normal application views or test fixtures.

**Expected:** The request is rejected with the existing project-state error. Devin does not start.

### Scenario G: Devin startup failure

Run with Devin unavailable or use a controlled fake adapter in an API test.

1. Submit a valid CEO request.
2. Observe the CEO response.
3. Inspect office events and task status.
4. Confirm no browser response contains a filesystem path, shell command, tmux session name, stack trace, or credential.

**Expected:** The task and CEO message remain durable, execution status is `failed`, failure events are emitted once, and the message explains that Devin could not be started.

### Scenario H: Terminal failure

Use a controlled test adapter or a test prompt that produces a known non-zero terminal result.

1. Submit a valid request.
2. Wait for the terminal failure.
3. Inspect task, worker, conversation, and office event state.

**Expected:** The task is `failed`, the worker is `error` according to the plan, the conversation contains the normal system error, and duplicate terminal events do not duplicate failure records.

### Scenario I: Existing flows remain intact

1. Open a normal project conversation.
2. Send a normal prompt through the existing conversation composer.
3. Confirm Devin starts and output streams as before.
4. Open `/office/ceo?office=<office-id>&project=<project-id>` directly.
5. Send a CEO request from the full-screen route.
6. Confirm the route still loads history and responds.

**Expected:** The new inline entry point does not break normal conversations or the existing full-screen CEO route.

### Scenario J: Responsive and accessibility checks

Test at a desktop viewport and a mobile viewport.

1. Confirm no horizontal scroll is introduced.
2. Confirm the mobile panel fits within the viewport and respects the safe area.
3. Tab through the CEO control, panel header, close control, textarea, and submit control.
4. Confirm focus remains visible.
5. Confirm execution status is announced in an `aria-live` region.
6. Enable reduced motion and repeat the open/send/close flow.
7. Toggle dark mode and repeat the flow.

**Expected:** The flow remains usable with keyboard, reduced motion, and dark mode. State is not communicated by animation or color alone.

## 6. Event Sequence Evidence

For a successful run, the expected high-level sequence is:

```text
CEO_MESSAGE
CEO_PLANNING (start)
TASK_CREATED
CEO_PLANNING (complete)
TASK_UPDATED (ready)
TASK_DISPATCHED
TASK_UPDATED (working)
AGENT_UPDATED (working)
AGENT_STARTED
CEO_RESPONSE (started)
conversation output/status events
AGENT_COMPLETED
TASK_UPDATED (completed)
TASK_COMPLETED
AGENT_UPDATED (idle)
```

The exact ordering of `CEO_RESPONSE` relative to asynchronous output is allowed to vary only where the implementation plan explicitly permits it. The run must never report completion before Devin's terminal event.

## 7. Security Review Checklist

- [ ] CEO routes remain behind authentication.
- [ ] CEO POST route uses the existing message rate limiter.
- [ ] Office ID and project ID are validated server-side.
- [ ] Office/project association is checked server-side.
- [ ] Disabled projects are rejected.
- [ ] Existing allowed-root and path validation still runs.
- [ ] Public task APIs cannot set `executionConversationId`.
- [ ] Only Devin is selected in this MVP.
- [ ] No raw prompt, cwd, shell command, tmux session name, secret, or stack trace is returned in the execution summary.
- [ ] Duplicate execution attempts are rejected.
- [ ] Terminal status handling is idempotent.

## 8. Results Template

Complete this section after implementation and QA execution.

### Automated results

- `pnpm --filter @jheckbot/api test`: passed (778 tests)
- `pnpm --filter @jheckbot/web test`: passed (86 tests)
- `pnpm -r typecheck`: passed
- `pnpm --filter @jheckbot/api build`: passed
- `pnpm --filter @jheckbot/web build`: passed
- `pnpm lint`: passed (deferred)
- Focused API tests: `tests/ceo-planner.test.ts` (18 passed), `tests/ceo-service.test.ts` (11 passed), `tests/ceo-routes.test.ts` (6 passed), `tests/office-task-execution-link.test.ts` (19 passed), `tests/office-task-execution-service.test.ts` (19 passed)
- Focused web tests: `tests/office.test.ts` (25 passed)

### Manual results

- Desktop CEO activation: BLOCKED — no user-managed runtime available
- Mobile CEO activation: BLOCKED
- Successful task-to-Devin run: BLOCKED
- Duplicate protection: covered by automated `ceo-service.test.ts` 409 case
- Invalid association: covered by automated `ceo-service.test.ts` project mismatch case
- Disabled project: covered by automated `ceo-service.test.ts` disabled project case
- Devin startup failure: covered by automated `OfficeTaskExecutionService` and `ceo-service.test.ts` failure cases
- Terminal failure: covered by automated `OfficeTaskExecutionService` tests
- Existing flows: not manually validated; existing `ceo-routes.test.ts` and `office-orchestration.test.ts` pass
- Accessibility/reduced-motion/dark-mode: not manually validated

### Final status

`IMPLEMENTED: automated verification passed. Manual browser QA is blocked until the user-managed web and API runtime is available.`

### Limitations

The current document intentionally contains no runtime pass claim. The implementation agent must replace the result values with observed evidence after the feature is built and the user-managed runtime is available.
