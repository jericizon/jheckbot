# Interactive CEO Character MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `subagent-driven-development` or `executing-plans` to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Let a user open one existing CEO character from a project office, send a coding request in an inline chat panel, and automatically start one real Devin implementation run.

**Architecture:** Reuse the existing Nuxt/Vue office, CEO chat API, task domain, conversation service, prompt execution service, AgentManager, DevinAdapter, and office SSE stream. Add a durable task-to-conversation link and a narrow `OfficeTaskExecutionService`; do not expand the existing multi-step WorkflowEngine for this first slice.

**Tech Stack:** Nuxt 4, Vue 3, TypeScript, Tailwind CSS, Express 5, PostgreSQL, pnpm workspaces, Vitest, Devin CLI, tmux.

**Spec:** `docs/superpowers/specifications/20260901_002500-interactive-ceo-character-mvp.md`

## Global Constraints

- One character: the existing CEO.
- One request produces one implementation task and one Devin run.
- CEO replies are deterministic and coding-focused; no new general-purpose LLM call.
- Desktop uses an inline panel beside the office; mobile uses a full-viewport panel fallback.
- Devin is the only execution provider in this slice.
- `PromptExecutionService` and `PathValidator` remain the execution and filesystem boundaries.
- The server verifies office/project association and enabled project state.
- One active CEO execution per office is allowed; duplicates are rejected server-side.
- No Pixi.js, WebGL, GSAP, voice, text-to-speech, memory hive, Electron, or new agent roster.
- No new npm dependency.
- Do not modify `.env` or environment override files.
- Do not overwrite `tasks/plan.md` or `tasks/todo.md`; those files track the separate multi-provider workstream.
- Preserve `/office/ceo?office=...&project=...`, normal project conversations, authentication, rate limiting, and path validation.
- Runtime servers are user-managed and must not be started by the implementation agent.

---

## 1. File and Responsibility Map

### API

| File | Responsibility in this plan |
|---|---|
| `apps/api/migrations/010_task_execution_conversation.sql` | Add the nullable task-to-conversation foreign key and index |
| `packages/shared/src/types/office.ts` | Expose `executionConversationId` on `OfficeTask` |
| `apps/api/src/repositories/OfficeTaskRepository.ts` | Map, persist, query, and update the execution link |
| `apps/api/src/services/OfficeTaskService.ts` | Enforce internal execution-link and terminal-completion rules |
| `apps/api/src/services/OfficeService.ts` | Add an internal office lookup for association checks |
| `apps/api/src/services/orchestration/CEOPlanner.ts` | Add a one-task planning method without changing the existing planner behavior |
| `apps/api/src/services/orchestration/OfficeTaskExecutionService.ts` | Connect an office task to a project conversation and Devin run |
| `apps/api/src/services/orchestration/CEOService.ts` | Use the one-task path and return the execution result |
| `apps/api/src/app.ts` | Compose the new service and apply the CEO message limiter |
| `apps/api/tests/office-task-execution-link.test.ts` | Verify task link and completion contracts |
| `apps/api/tests/ceo-planner.test.ts` | Verify the single-task plan |
| `apps/api/tests/office-task-execution-service.test.ts` | Verify task-to-Devin lifecycle and terminal handling |
| `apps/api/tests/ceo-service.test.ts` | Verify CEO validation, response, and execution delegation |
| `apps/api/tests/ceo-routes.test.ts` | Verify request/response status behavior |

### Web

| File | Responsibility in this plan |
|---|---|
| `apps/web/app/components/office/OfficeCharacter.vue` | Expose an accessible interaction for the CEO only |
| `apps/web/app/components/office/OfficeCornerOffice.vue` | Forward the CEO interaction event |
| `apps/web/app/components/office/OfficeScene.vue` | Emit a project-office CEO selection event |
| `apps/web/app/components/office/CEOChatPanel.vue` | New desktop/mobile panel shell around the existing CEO chat |
| `apps/web/app/components/office/CEOChat.vue` | Display the execution result/status without adding a second chat flow |
| `apps/web/app/composables/useCEOChat.ts` | Type the execution result returned by the API |
| `apps/web/app/pages/projects/[id].vue` | Manage panel visibility and responsive office/panel layout |
| `apps/web/tests/office.test.ts` | Extend CEO client contract coverage |

### Documentation and QA

| File | Responsibility |
|---|---|
| `docs/superpowers/specifications/20260901_002500-interactive-ceo-character-mvp.md` | Approved product and technical contract |
| `docs/superpowers/plans/20260901_002600-interactive-ceo-character-mvp.md` | This dependency-ordered implementation plan |
| `docs/superpowers/qa/20260901_002700-interactive-ceo-character-mvp.md` | Manual and automated QA runbook, to be completed after implementation |

The existing broad office specification is intentionally not overwritten. This plan is the focused first slice it can reference.

---

## 2. Dependency Graph

```text
Task 1: Durable task execution link
    |
    +--> Task 2: Single-task CEO planner
    |        |
    |        +--> Task 3: OfficeTaskExecutionService
    |                 |
    |                 +--> Task 4: CEO API path and composition
    |                          |
    |                          +--> Task 5: CEO interaction event
    |                                   |
    |                                   +--> Task 6: Inline CEO panel
    |                                            |
    |                                            +--> Task 7: Client execution status
    |                                                     |
    |                                                     +--> Task 8: Full verification and QA
```

Tasks 1 and 2 can be developed independently after the plan is approved, but Task 3 must wait for the task link and planner contract. UI work can begin after the existing CEO endpoint contract is confirmed, but final integration waits for Task 4.

---

## Task 1: Add a durable task execution link

**Purpose:** Make the relationship between an office implementation task and its automatically created project conversation explicit, queryable, and idempotency-safe.

**Files:**

- Create: `apps/api/migrations/010_task_execution_conversation.sql`
- Modify: `packages/shared/src/types/office.ts`
- Modify: `apps/api/src/repositories/OfficeTaskRepository.ts`
- Modify: `apps/api/src/services/OfficeTaskService.ts`
- Test: `apps/api/tests/office-task-execution-link.test.ts`

**Interfaces produced:**

```ts
// packages/shared/src/types/office.ts
export interface OfficeTask {
  // existing fields remain unchanged
  executionConversationId?: string
}

// OfficeTaskService internal operations
findActiveCeoExecution(officeId: string): Promise<OfficeTask | null>
linkExecutionConversation(taskId: string, conversationId: string): Promise<OfficeTask | null>
completeExecution(taskId: string): Promise<OfficeTask | null>
```

### Steps

- [ ] **Step 1: Write failing repository/service tests.**

  Add tests that prove:

  1. A database record field named `execution_conversation_id` maps to `executionConversationId`.
  2. `linkExecutionConversation` rejects empty task or conversation IDs.
  3. `completeExecution` only succeeds for an execution-backed task currently in `working` status.
  4. `findActiveCeoExecution` only returns a non-terminal task created by the CEO using the simple workflow.

  Use the existing fake repository style from `apps/api/tests/office-task-service.test.ts` and `apps/api/tests/office-task-repository.test.ts`. Do not add a database test dependency.

- [ ] **Step 2: Run the focused tests and verify they fail.**

  Run:

  ```bash
  pnpm --filter @jheckbot/api exec vitest run \
    tests/office-task-execution-link.test.ts \
    tests/office-task-service.test.ts \
    tests/office-task-repository.test.ts
  ```

  Expected result: the new field and internal methods are not yet available.

- [ ] **Step 3: Add the migration.**

  Create `apps/api/migrations/010_task_execution_conversation.sql` with exactly this schema intent:

  ```sql
  ALTER TABLE tasks
    ADD COLUMN IF NOT EXISTS execution_conversation_id UUID
      REFERENCES conversations(id) ON DELETE SET NULL;

  CREATE INDEX IF NOT EXISTS idx_tasks_execution_conversation_id
    ON tasks (execution_conversation_id);

  CREATE UNIQUE INDEX IF NOT EXISTS idx_tasks_one_active_ceo_execution
    ON tasks (office_id)
    WHERE created_by = 'ceo'
      AND workflow_type = 'simple'
      AND status IN ('backlog', 'planning', 'ready', 'assigned', 'working');
  ```

  The migration must not delete or rewrite existing tasks. If existing data already violates the partial unique index, stop and report the conflicting rows rather than deleting or changing them automatically.

- [ ] **Step 4: Update the shared type and repository mapping.**

  Extend `OfficeTask` with the optional camelCase field. Extend `OfficeTaskRecord`, `toOfficeTask`, create data, update data, INSERT columns, and UPDATE columns in `OfficeTaskRepository` so the field round-trips to PostgreSQL.

  Add repository methods with these contracts:

  ```ts
  findActiveCeoExecution(officeId: string): Promise<OfficeTask | null>
  linkExecutionConversation(taskId: string, conversationId: string): Promise<OfficeTask | null>
  ```

  The active query must filter `created_by = 'ceo'`, `workflow_type = 'simple'`, and statuses `backlog`, `planning`, `ready`, `assigned`, or `working`.

- [ ] **Step 5: Add the service-level rules.**

  Add the three `OfficeTaskService` methods from the interface block.

  - `findActiveCeoExecution` validates the office ID before querying.
  - `linkExecutionConversation` validates both UUID-shaped IDs, verifies the task exists, and updates only the execution link.
  - `completeExecution` validates the task exists, requires `executionConversationId`, requires status `working`, calls the repository status update, and emits the existing `TASK_UPDATED` event plus a `TASK_COMPLETED` event with the task and conversation IDs.
  - Do not add the execution link to public task create/update controller input.

- [ ] **Step 6: Run focused tests and typecheck.**

  Run:

  ```bash
  pnpm --filter @jheckbot/api exec vitest run \
    tests/office-task-execution-link.test.ts \
    tests/office-task-service.test.ts \
    tests/office-task-repository.test.ts
  pnpm --filter @jheckbot/api typecheck
  ```

  Expected result: all focused tests and API typecheck pass.

**Acceptance criteria:**

- `executionConversationId` persists and maps correctly.
- The public task API cannot assign the execution link directly.
- Only one active CEO execution can be found per office.
- Successful execution completion has a controlled service path.

**Dependencies:** None.  
**Estimated scope:** Medium, five files including tests/migration.

### Checkpoint A: Task link foundation

- [ ] Focused task link tests pass.
- [ ] API typecheck passes.
- [ ] Migration is additive and does not modify existing task rows.

---

## Task 2: Add deterministic single-task CEO planning

**Purpose:** Preserve the existing planner for future multi-step work while giving this MVP an explicit one-task contract.

**Files:**

- Modify: `apps/api/src/services/orchestration/CEOPlanner.ts`
- Modify: `apps/api/tests/ceo-planner.test.ts`

**Interface produced:**

```ts
planSingleTask(
  request: string,
  officeId: string,
  projectId?: string,
): Promise<CEOPlan>
```

The result must have this shape:

```ts
{
  request: string,
  complexity: 'simple',
  tasks: [
    {
      id: string,
      officeId: string,
      projectId?: string,
      title: `Implement ${request}`,
      description: `Implement the requested change: ${request}`,
      status: 'backlog',
      workflowType: 'simple',
      createdBy: 'ceo',
      metadata: {
        request,
        projectId: projectId ?? null,
        complexity: 'simple',
        executionMode: 'single',
      },
    },
  ],
  dependencies: [],
}
```

### Steps

- [ ] **Step 1: Add failing planner tests.**

  Extend `apps/api/tests/ceo-planner.test.ts` with tests that prove:

  1. `planSingleTask('add a health endpoint', officeId, projectId)` creates exactly one task.
  2. The task has `createdBy: 'ceo'`, `workflowType: 'simple'`, and no dependencies.
  3. A request containing words such as `auth`, `payment`, or `component` still produces one task through this explicit MVP method.
  4. Empty request and empty office ID remain validation errors.
  5. Existing `plan()` tests retain their current medium/complex behavior.

- [ ] **Step 2: Run the focused planner tests and verify the new tests fail.**

  Run:

  ```bash
  pnpm --filter @jheckbot/api exec vitest run tests/ceo-planner.test.ts
  ```

- [ ] **Step 3: Implement `planSingleTask`.**

  Reuse the existing input validation and task/event services. Do not duplicate the existing keyword complexity logic. The new method must:

  1. Trim and validate the request and office ID.
  2. Emit `CEO_PLANNING` with `phase: 'start'` and `executionMode: 'single'`.
  3. Create one backlog task with the exact metadata contract above.
  4. Emit `CEO_PLANNING` with `phase: 'complete'`, `complexity: 'simple'`, and `taskCount: 1`.
  5. Return the single task and an empty dependency list.

- [ ] **Step 4: Run focused tests, API typecheck, and the existing planner suite.**

  Run:

  ```bash
  pnpm --filter @jheckbot/api exec vitest run tests/ceo-planner.test.ts
  pnpm --filter @jheckbot/api typecheck
  ```

  Expected result: the new and existing planner tests pass.

**Acceptance criteria:**

- The MVP planner always returns one implementation task.
- The existing multi-step planner remains available and unchanged for deferred work.
- Planning metadata identifies the CEO single-task execution mode.

**Dependencies:** Task 1 for the task type/link contract.  
**Estimated scope:** Small, two files.

---

## Task 3: Build the task-to-Devin execution bridge

**Purpose:** Close the current gap where `TaskDispatcher` assigns an office task but does not start a real project conversation or Devin run.

**Files:**

- Create: `apps/api/src/services/orchestration/OfficeTaskExecutionService.ts`
- Create: `apps/api/tests/office-task-execution-service.test.ts`

**Interfaces produced:**

```ts
export type OfficeTaskExecutionStatus = 'started' | 'failed'

export interface OfficeTaskExecutionResult {
  taskId: string
  conversationId?: string
  agentId?: string
  status: OfficeTaskExecutionStatus
  error?: string
}

export interface StartOfficeTaskExecutionOptions {
  model?: string
}

export class OfficeTaskExecutionService {
  start(
    taskId: string,
    options?: StartOfficeTaskExecutionOptions,
  ): Promise<OfficeTaskExecutionResult>
}
```

The constructor may depend on narrow `Pick<>` interfaces for these existing services:

- `OfficeTaskService`: `getById`, `setStatus`, `completeExecution`, `linkExecutionConversation`.
- `TaskDispatcher`: `dispatch`.
- `ConversationService`: `create`, `get`.
- `PromptExecutionService`: `send`.
- `AgentManager`: `subscribe`.
- `OfficeAgentService`: `update`.
- `OfficeEventService`: `create`.

### Required lifecycle

```text
CEO task: backlog
  -> ready
  -> TaskDispatcher assigns Support/another capable worker
  -> assigned
  -> working
  -> create project conversation
  -> link task to conversation
  -> PromptExecutionService.send()
  -> Devin running
  -> terminal status event
  -> completed + worker idle

Startup or terminal failure
  -> failed + worker error when an agent exists
```

### Steps

- [ ] **Step 1: Write failing service tests with fakes.**

  Add tests covering:

  1. A backlog CEO task is moved to `ready`, dispatched, moved to `working`, linked to one conversation, and passed to `PromptExecutionService.send`.
  2. The conversation is created with `agentType: 'devin'` and the selected model when provided.
  3. The prompt contains the task title and description, but no filesystem path, shell command, or secret.
  4. A task with an existing execution link is not started a second time.
  5. Missing `projectId` fails before conversation creation.
  6. Prompt startup failure marks the task failed and emits a safe failure event.
  7. A subscribed terminal status of `completed` calls `completeExecution` exactly once and returns the worker to `idle`.
  8. A subscribed terminal status of `failed` marks the task failed and the worker `error` exactly once.
  9. Duplicate terminal events are ignored.
  10. Unsupported non-Devin agent configuration fails explicitly rather than silently switching providers.

  Model the AgentManager status payload as the existing persisted format, for example:

  ```ts
  {
    eventType: 'status',
    content: JSON.stringify({ status: 'completed' }),
  }
  ```

- [ ] **Step 2: Run the new focused tests and verify they fail.**

  Run:

  ```bash
  pnpm --filter @jheckbot/api exec vitest run tests/office-task-execution-service.test.ts
  ```

- [ ] **Step 3: Implement validation and idempotency.**

  In `start`:

  1. Validate the task ID.
  2. Load the task and require a project ID.
  3. If the task already has an execution link, return its existing execution state and do not create another conversation.
  4. If the task is `backlog`, move it to `ready` through `OfficeTaskService.setStatus`.
  5. Call `TaskDispatcher.dispatch(taskId)` and use its returned assigned task and agent.
  6. Reject a configured agent provider other than `devin`.
  7. Move the task from `assigned` to `working`.

  Do not call the public task controller from this service.

- [ ] **Step 4: Implement conversation creation and Devin start.**

  Create one conversation using the existing `ConversationService`:

  ```ts
  const conversation = await conversationService.create({
    projectId: task.projectId,
    title: `CEO task: ${task.title}`,
    agentType: 'devin',
  })
  ```

  Persist the task link before starting terminal work:

  ```ts
  await taskService.linkExecutionConversation(task.id, conversation.id)
  ```

  Subscribe to `AgentManager` before calling `PromptExecutionService.send` so a very short run cannot finish before the listener exists. Then call:

  ```ts
  await promptExecutionService.send({
    conversationId: conversation.id,
    prompt: buildImplementationPrompt(task),
    model: options?.model,
    bypass: false,
  })
  ```

  `buildImplementationPrompt` must use only the task title, description, and acceptance criteria. It must not include `cwd`, tmux names, credentials, or raw provider configuration.

  Emit `AGENT_STARTED` after the prompt service accepts the run. Return only task ID, conversation ID, agent ID, and `started` status.

- [ ] **Step 5: Implement terminal status handling.**

  The subscription handler must:

  - Ignore event types other than `status`.
  - Parse the JSON status payload defensively.
  - Ignore non-terminal statuses.
  - Use a per-task terminal guard so `completed`, `failed`, or `stopped` can be applied once.
  - On `completed`, call `completeExecution`, emit `AGENT_COMPLETED`, and update the worker to `idle`.
  - On `failed` or `stopped`, call `taskService.setStatus(taskId, 'failed')`, emit `AGENT_FAILED` and `TASK_FAILED`, and update the worker to `error` for a failed run or `idle` for a stopped run.
  - Remove the AgentManager subscription after terminal handling.
  - Keep error text user-safe and identifier-based.

- [ ] **Step 6: Handle expected startup failures.**

  If dispatch, conversation creation, linking, or prompt startup fails:

  - Mark the task failed when a task exists and is not terminal.
  - Emit `TASK_FAILED` with task ID and a safe error code.
  - Set the selected worker to `error` only when an agent was assigned.
  - Return `{ status: 'failed', taskId, agentId?, conversationId?, error }`.
  - Do not throw raw adapter errors to the browser.

- [ ] **Step 7: Run service tests, API typecheck, and the full API suite.**

  Run:

  ```bash
  pnpm --filter @jheckbot/api exec vitest run tests/office-task-execution-service.test.ts
  pnpm --filter @jheckbot/api typecheck
  pnpm --filter @jheckbot/api test
  ```

**Acceptance criteria:**

- One task starts at most one linked Devin conversation.
- The existing `PromptExecutionService` remains the only path that starts Devin for this feature.
- Successful and failed terminal events update office task/agent state exactly once.
- No sensitive execution details leave the service result or office event metadata.

**Dependencies:** Tasks 1 and 2.  
**Estimated scope:** Medium, two files.

### Checkpoint B: Real execution bridge

- [ ] The service tests prove a real task-to-conversation-to-run lifecycle with fakes.
- [ ] `pnpm --filter @jheckbot/api test` passes.
- [ ] The plan still avoids the multi-step WorkflowEngine path.

---

## Task 4: Wire the CEO API to the single-task execution path

**Purpose:** Replace the current synthetic multi-agent CEO background path for this MVP with a direct, observable, one-task execution flow.

**Files:**

- Modify: `apps/api/src/services/OfficeService.ts`
- Modify: `apps/api/src/services/orchestration/CEOService.ts`
- Modify: `apps/api/src/app.ts`
- Modify: `apps/api/tests/ceo-service.test.ts`
- Modify: `apps/api/tests/ceo-routes.test.ts`

`CEOController.ts` and `ceo.routes.ts` retain their existing route shape. Only update them if a focused test proves the existing body parsing cannot carry the already-defined response contract.

**Interfaces produced:**

```ts
interface CEOExecutionSummary {
  taskId: string
  conversationId?: string
  agentId?: string
  status: 'started' | 'failed'
  error?: string
}

interface CEOSendMessageResult {
  userMessage: OfficeEvent
  ceoResponse: OfficeEvent
  plan: CEOPlan
  execution: CEOExecutionSummary
}
```

### Steps

- [ ] **Step 1: Add failing CEO service tests.**

  Extend `apps/api/tests/ceo-service.test.ts` to prove:

  1. The service resolves the office and verifies that the effective project ID matches `office.projectId`.
  2. A valid request calls `planner.planSingleTask` and `executionService.start` with the created task ID and requested model.
  3. The result includes exactly one plan task and an execution summary.
  4. The CEO response says whether Devin started without exposing a path or session name.
  5. A startup failure produces a persisted CEO response with `execution.status = 'failed'`.
  6. An active execution fails before a second task is planned.
  7. A database unique-constraint race is translated into the same 409 conflict without a second run.
  8. The old synthetic timed meeting and WorkflowEngine invocation are not used by the MVP path.

  Extend `apps/api/tests/ceo-routes.test.ts` to cover the response shape and the existing validation statuses.

- [ ] **Step 2: Run focused CEO tests and verify new expectations fail.**

  Run:

  ```bash
  pnpm --filter @jheckbot/api exec vitest run \
    tests/ceo-service.test.ts \
    tests/ceo-routes.test.ts
  ```

- [ ] **Step 3: Add internal office lookup.**

  Add `OfficeService.getById(officeId)` with the existing service error style. It must return the office or `null` and must not create an office as a side effect.

- [ ] **Step 4: Replace the CEO service execution path.**

  Update `CEOService` to receive the existing office service and the new task execution service.

  The request flow must be:

  ```text
  validate office/request and 32KB limit
    -> load active office
    -> resolve projectId from request or office
    -> verify projectId matches office.projectId and project is enabled
    -> check findActiveCeoExecution
    -> set CEO status to communicating
    -> persist CEO_MESSAGE
    -> planner.planSingleTask
    -> executionService.start(taskId, { model })
    -> build safe structured CEO_RESPONSE
    -> restore CEO status to idle
    -> return plan + execution summary
  ```

  Translate a PostgreSQL unique-violation from the active CEO-task index into the same `409` conflict used by the friendly pre-check. This protects concurrent requests even when both pass the lookup.

  Preserve `GET /events` behavior. Do not call `holdMeeting`, do not add arbitrary delays, and do not call `WorkflowEngine.startWorkflow` from this path. The existing WorkflowEngine remains constructed for its separate workstream but is not part of this MVP request flow.

  Expected response copy must be structured from the result:

  ```text
  I will handle this as one implementation task.

  Task: <task title>
  Agent: <selected agent name>
  Status: Devin started
  ```

  For a failed startup, use a safe failure response without raw error internals.

- [ ] **Step 5: Apply the existing message rate limiter to the CEO POST route.**

  In `apps/api/src/app.ts`, mount the existing `messageLimiter` for:

  ```text
  /api/offices/:officeId/ceo/messages
  ```

  before the CEO router is mounted. Do not create a new limiter or alter the global limiter.

- [ ] **Step 6: Compose services without changing provider scope.**

  Construct `OfficeTaskExecutionService` after the existing `TaskDispatcher` and before `CEOService`. Pass the existing `conversationService`, `promptExecutionService`, `agentManager`, office services, and event service. Pass the new executor into `CEOService`.

  Keep `agentType: 'devin'` explicit for this slice. Do not use unimplemented per-agent provider values to select a different runtime.

- [ ] **Step 7: Run focused and full API verification.**

  Run:

  ```bash
  pnpm --filter @jheckbot/api exec vitest run \
    tests/ceo-service.test.ts \
    tests/ceo-routes.test.ts \
    tests/office-task-execution-service.test.ts
  pnpm --filter @jheckbot/api typecheck
  pnpm --filter @jheckbot/api test
  ```

**Acceptance criteria:**

- The CEO API returns a plan plus safe execution summary.
- The server rejects mismatched office/project requests.
- The request produces one task and one Devin start when dependencies are available.
- The CEO path no longer uses the synthetic multi-agent meeting for this MVP.
- CEO messages remain persisted and the existing event endpoint remains compatible.

**Dependencies:** Task 3.  
**Estimated scope:** Medium, five files.

---

## Task 5: Make the CEO character interactive

**Purpose:** Provide the click/tap entry point without making employee characters interactive yet.

**Files:**

- Modify: `apps/web/app/components/office/OfficeCharacter.vue`
- Modify: `apps/web/app/components/office/OfficeCornerOffice.vue`
- Modify: `apps/web/app/components/office/OfficeScene.vue`
- Test/verify: `apps/web/tests/office.test.ts`

**Interfaces produced:**

```ts
// OfficeCharacter.vue
const emit = defineEmits<{
  select: []
}>()

// OfficeScene.vue
const emit = defineEmits<{
  'ceo-selected': []
}>()
```

### Steps

- [ ] **Step 1: Add a focused web contract test.**

  Extend the existing office tests to verify that the office interaction contract names the CEO selection event and does not change `findCeo`/`findEmployees` behavior. Because the current web Vitest environment is Node-only and has no Vue Test Utils dependency, component rendering is verified in browser QA rather than by adding a new testing library.

- [ ] **Step 2: Implement an accessible interactive mode in `OfficeCharacter.vue`.**

  Add an optional `interactive` prop with a default of `false`. When true:

  - Render the character hit target as a semantic `button type="button"`.
  - Emit `select` on click.
  - Support Enter and Space through native button behavior.
  - Provide an accessible label derived from the agent name and action.
  - Preserve the existing figure, speech bubble, name tag, animations, and layout.

  When false, preserve the existing non-interactive rendering for employees.

- [ ] **Step 3: Forward the CEO event.**

  In `OfficeCornerOffice.vue`, pass `interactive` to `OfficeCharacter` and forward its `select` event as the wrapper's `select` event.

  In `OfficeScene.vue`, bind the CEO wrapper's `select` event and emit `ceo-selected`. Do not make `OfficeCubicle` or `OfficeConferenceRoom` employee characters interactive in this task.

- [ ] **Step 4: Run web tests and typecheck.**

  Run:

  ```bash
  pnpm --filter @jheckbot/web exec vitest run tests/office.test.ts
  pnpm --filter @jheckbot/web typecheck
  ```

**Acceptance criteria:**

- The CEO has a semantic, keyboard-accessible interaction.
- Employees remain non-interactive.
- Existing office layout and animation behavior remain unchanged.
- `OfficeScene` exposes one project-level `ceo-selected` event.

**Dependencies:** Task 4 for the complete request flow, although the event itself is UI-isolated.  
**Estimated scope:** Medium, four files.

---

## Task 6: Add the inline CEO chat panel

**Purpose:** Open the existing CEO chat beside the project office instead of navigating to the full-screen CEO route.

**Files:**

- Create: `apps/web/app/components/office/CEOChatPanel.vue`
- Modify: `apps/web/app/pages/projects/[id].vue`
- Test/verify: `apps/web/tests/office.test.ts`

**Interface produced:**

```ts
// CEOChatPanel.vue
const props = defineProps<{
  officeId: string
  projectId: string
  ceo?: OfficeAgent
}>()

const emit = defineEmits<{
  close: []
}>()
```

### Steps

- [ ] **Step 1: Define the panel shell and responsive contract.**

  Create `CEOChatPanel.vue` as a layout shell around the existing `CEOChat` component. It must:

  - Render a panel header with CEO name/status and a 44x44 close button.
  - Render `<CEOChat :office-id="officeId" :project-id="projectId" />` as the only chat implementation.
  - Use a desktop sibling panel width within the 360px to 440px range.
  - Use a mobile `fixed inset-0` full-viewport fallback below the desktop breakpoint.
  - Apply safe-area padding on mobile.
  - Support Escape-to-close and expose an accessible label such as `CEO chat`.
  - Keep the unsent draft local to the mounted panel; closing or reloading may discard it in this MVP.
  - Keep the panel theme-compatible with existing semantic surface/content/border tokens.

- [ ] **Step 2: Add project-page panel state.**

  In `apps/web/app/pages/projects/[id].vue`:

  - Add `const ceoChatOpen = ref(false)`.
  - Bind `@ceo-selected="ceoChatOpen = true"` to `OfficeScene`.
  - Render `CEOChatPanel` only when `ceoChatOpen` and `officeId` are available.
  - Wire `@close="ceoChatOpen = false"`.
  - Preserve the sidebar, project header, office content, task/activity panels, changed-file panel, and conversation starter.
  - Refactor only the main workspace wrapper needed for the desktop sibling panel; do not change project URLs or conversation route behavior.

  The intended desktop structure is:

  ```text
  project sidebar
    + main workspace
        + existing project office/content
        + CEOChatPanel when open
  ```

  On mobile, the panel overlays the project workspace and can be closed without losing persisted messages.

- [ ] **Step 3: Run web tests and typecheck.**

  Run:

  ```bash
  pnpm --filter @jheckbot/web exec vitest run tests/office.test.ts
  pnpm --filter @jheckbot/web typecheck
  ```

- [ ] **Step 4: Perform manual browser verification with the user-managed runtime.**

  Without starting a server from the implementation agent, verify in the already running application:

  1. Open a project with an office.
  2. Activate the CEO with a pointer and keyboard.
  3. Confirm the panel appears beside the office on desktop.
  4. Confirm the panel covers the viewport and remains closable on mobile width.
  5. Close and reopen the panel; confirm CEO history still loads.

**Acceptance criteria:**

- CEO activation opens an adjacent chat panel without a route change.
- The panel works at desktop and mobile widths.
- Existing full-screen `/office/ceo` remains untouched and functional.
- The panel reuses `CEOChat.vue` and does not duplicate chat state or API calls.

**Dependencies:** Task 5.  
**Estimated scope:** Medium, three files including one new component.

### Checkpoint C: User interaction surface

- [ ] CEO click/tap and keyboard activation work.
- [ ] Desktop and mobile panel layouts are manually verified.
- [ ] Web tests and typecheck pass.

---

## Task 7: Surface the execution result in the CEO client

**Purpose:** Make the response contract visible and accessible without adding a second conversation or execution UI.

**Files:**

- Modify: `apps/web/app/composables/useCEOChat.ts`
- Modify: `apps/web/app/components/office/CEOChat.vue`
- Modify: `apps/web/tests/office.test.ts`

**Interfaces produced:**

```ts
interface CEOExecutionSummary {
  taskId: string
  conversationId?: string
  agentId?: string
  status: 'started' | 'failed'
  error?: string
}
```

### Steps

- [ ] **Step 1: Add failing client contract tests.**

  Extend the existing `useCEOChat` test to assert that the typed POST response includes:

  ```ts
  {
    execution: {
      taskId: 'task-1',
      conversationId: 'conversation-1',
      agentId: 'agent-1',
      status: 'started',
    },
  }
  ```

  Also assert that `projectId` and `model` continue to be passed exactly as supplied.

- [ ] **Step 2: Extend the composable response type.**

  Add `execution: CEOExecutionSummary` to the generic response type in `useCEOChat.ts`. Do not change endpoint paths or request property names.

- [ ] **Step 3: Show a safe execution notice in `CEOChat.vue`.**

  Capture the result of `chat.sendMessage`. Add a small `aria-live="polite"` status region:

  - `started`: announce `Devin started the implementation task.`
  - `failed`: announce the safe returned error or `Devin could not be started.`

  Keep the existing CEO response event as the persisted message source. Do not append a second assistant message from the client. Clear the notice on the next submit or panel close.

- [ ] **Step 4: Run focused web verification.**

  Run:

  ```bash
  pnpm --filter @jheckbot/web exec vitest run tests/office.test.ts
  pnpm --filter @jheckbot/web typecheck
  pnpm --filter @jheckbot/web test
  ```

**Acceptance criteria:**

- The client accepts the extended API response.
- A successful or failed start is announced without exposing sensitive details.
- CEO messages remain sourced from persisted events and are not duplicated.

**Dependencies:** Task 6.  
**Estimated scope:** Small, three files.

---

## Task 8: Full verification, manual QA, and QA report

**Purpose:** Prove the complete flow and document any runtime limitation before the feature is considered complete.

**Files:**

- Modify: `docs/superpowers/qa/20260901_002700-interactive-ceo-character-mvp.md`

### Steps

- [ ] **Step 1: Run the complete automated suite.**

  Run:

  ```bash
  pnpm test
  pnpm typecheck
  pnpm build
  pnpm lint
  ```

  Expected result:

  - Shared tests pass.
  - API tests pass.
  - Web tests pass.
  - All packages typecheck.
  - All packages build.
  - Existing lint commands exit successfully.

- [ ] **Step 2: Execute the manual browser flow against the user-managed runtime.**

  Use the QA runbook and verify:

  1. Authenticated project office loads.
  2. CEO activation works by pointer, Enter, and Space.
  3. Inline panel opens on desktop and mobile.
  4. CEO history loads and survives close/reopen.
  5. One coding request creates one task and one linked project conversation.
  6. Devin starts automatically through the existing runner.
  7. Office agent status changes reflect real task state.
  8. Persisted Devin output appears in the linked project conversation.
  9. Successful completion emits one completion event and returns the worker to idle.
  10. Startup/terminal failure is visible without stack traces or paths.
  11. A second request during active execution does not create another task/run.
  12. Normal project conversations still work.
  13. `/office/ceo` still works.
  14. Dark mode, reduced motion, keyboard focus, and mobile safe areas work.

- [ ] **Step 3: Record evidence in the QA report.**

  The report must include:

  - Exact automated commands and results.
  - Browser viewport(s) used.
  - Test data/project shape, without secrets.
  - Task ID, conversation ID, and event sequence where safe to record.
  - Any unavailable runtime prerequisite, such as Devin or tmux.
  - Any failures, retries, and unresolved risks.
  - A final status of `PASS`, `BLOCKED`, or `FAIL`, never an unverified success claim.

- [ ] **Step 4: Review the final diff and simplify.**

  Confirm:

  - No source file outside the planned surfaces changed.
  - No dependency was added.
  - No new `.env` or environment override file was created.
  - No dead synthetic CEO path remains active for the MVP.
  - No duplicate task/conversation start path exists.
  - The plan's deferred features were not introduced accidentally.

**Acceptance criteria:**

- Automated checks pass or their exact blocker is documented.
- Manual flow is verified in a real browser where runtime access is available.
- QA report records evidence and limitations.
- No completion claim is made without the required checks.

**Dependencies:** Tasks 1 through 7.  
**Estimated scope:** Medium, QA documentation and verification only.

### Final Checkpoint

- [ ] Specification and implementation plan remain consistent.
- [ ] One CEO request produces one task and one Devin run.
- [ ] The task-to-conversation link is durable.
- [ ] Office state derives from real events.
- [ ] Existing conversation and CEO routes remain compatible.
- [ ] Automated verification and manual QA are documented.
- [ ] User reviews the implementation plan before coding begins.

---

## 3. Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| `TaskDispatcher` remains assignment-only | High | Keep `OfficeTaskExecutionService` as the only bridge that starts a conversation and call `PromptExecutionService` directly |
| A request is retried after the browser loses its response | High | Check one active CEO execution server-side before planning; persist the task/conversation link before starting Devin |
| Task completion cannot use generic status transitions | Medium | Use the internal `completeExecution` method with explicit `working` and execution-link checks |
| Office/project IDs are forged in the browser | High | Load the office server-side and require the project ID to match its association |
| CEO status gets stuck communicating after an error | Medium | Restore CEO status in a `finally` path and emit only status changes that correspond to real work |
| Devin provider configuration is incomplete for future providers | Medium | Pin v1 to the registered Devin adapter; reject unsupported provider configuration explicitly |
| API restart leaves task state stale | Medium | Document startup reconciliation as deferred; do not infer success from an absent process |
| Existing full-screen CEO chat regresses | Medium | Keep its route and component contract, add only optional execution fields, and run existing web/API tests |
| Panel harms mobile usability | Medium | Use a fixed full-viewport mobile fallback, safe-area padding, focus/escape behavior, and manual browser QA |
| Reference assets create legal or attribution work | Low | Use existing JheckBot SVG artwork and no copied Munder Difflin assets |

## 4. Deferred Work

The following are separate plans, not hidden tasks in this plan:

- Natural-language CEO LLM responses.
- Multiple workers and task fan-out.
- Automatic QA/review stages.
- Agent-to-agent messages.
- Character roster and customization.
- Pixi.js/canvas/tile-map renderer.
- Voice and text-to-speech.
- Memory hive and persistent character memory.
- Provider expansion.
- WorkflowEngine status coordination and restart reconciliation.

## 5. Implementation Handoff

This plan is documentation-only until the user explicitly starts implementation. The next implementation session must:

1. Re-read the specification and this plan.
2. Verify the working tree before changing files.
3. Execute tasks in order with focused tests after each task.
4. Use the existing project conventions and security boundaries.
5. Run the final QA workflow before claiming completion.
