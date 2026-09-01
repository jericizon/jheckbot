# Spec: Interactive CEO Character MVP

**Status:** Proposed, ready for implementation planning review  
**Date:** 2026-09-01  
**Implementation status:** Documentation only. No application code is changed by this specification.  
**Repository:** `jheckbot`  
**Branch observed during discovery:** `feature/characters-rework`

## 1. Decision Summary

The first version will add one useful interactive AI character to the existing project office: the CEO.

The user flow is:

```text
Open project
  -> see the existing office and CEO character
  -> click or tap CEO
  -> inline CEO chat panel opens beside the office
  -> type a coding request
  -> CEO returns a structured coding-focused response
  -> one implementation task is created
  -> one Devin conversation starts automatically
  -> office and task state reflect the real run
```

This is intentionally not a recreation of the complete Munder Difflin desktop application. The MVP reuses JheckBot's current Nuxt/Vue office, Express API, PostgreSQL task model, event stream, Devin adapter, path validation, authentication, and conversation runner.

## 2. Capability Map

The request contains several independently testable capabilities, so the implementation is divided into the following modules.

| Module id | Responsibility | Depends on |
|---|---|---|
| `ceo-entry-panel` | Make the existing CEO character interactive and open an inline chat panel from the project office | Existing project office and `CEOChat` |
| `single-task-ceo-request` | Turn one CEO request into one implementation task and a structured response | Existing CEO route, office, and task services |
| `task-to-devin-execution` | Create one project conversation for the task and start Devin automatically | `single-task-ceo-request`, existing conversation and agent runner |
| `execution-state-feedback` | Reflect real task, agent, and Devin terminal states in the office and chat | `task-to-devin-execution`, existing SSE office events |

**Product flow order:** `ceo-entry-panel` → `single-task-ceo-request` → `task-to-devin-execution` → `execution-state-feedback`.

**Implementation dependency order:** durable task link and single-task planner → task execution bridge → CEO API wiring → CEO interaction and inline panel → client status notice → integrated QA.

The modules are planned as one cohesive MVP. They are separated so each can be reviewed and tested without silently introducing the full multi-agent platform.

## 3. Reference Audit

### 3.1 Munder Difflin repository

The reference repository describes a desktop Electron application built with React, TypeScript, Pixi.js, xterm.js, and node-pty. Its floor is a 2D office populated by avatars that represent real terminal-agent processes. The repository's design documentation describes an Animal Crossing, Earthbound, and SNES-inspired visual system with pixel-snapped sprites, stations, movement, and status-driven animation.

Relevant reference areas reviewed:

- [`README.md`](https://raw.githubusercontent.com/chaitanyagiri/munder-difflin/main/README.md): product shape, real CLI agents, avatars, and stack.
- [`DESIGN.md`](https://raw.githubusercontent.com/chaitanyagiri/munder-difflin/main/DESIGN.md): pixel-art visual language and status-through-motion principle.
- [`SPEC.md`](https://raw.githubusercontent.com/chaitanyagiri/munder-difflin/main/SPEC.md): terminal plane, event plane, avatar state machine, and desktop scope.
- `src/renderer/src/scene/office/Character.ts`: pathing, animation state, status overlays, and walking behavior.
- `src/renderer/src/scene/office/CharacterSprite.ts`: sprite-sheet animation and seated/walking poses.
- `src/renderer/src/scene/office/OfficeFloor.tsx`: Pixi scene orchestration and real agent state integration.
- `src/renderer/src/scene/office/cast.ts`: character roster and avatar metadata.

### 3.2 Live website and demo

The live marketing site presents a visual office simulation with character avatars, status changes, and a separate explanation of real CLI-agent execution. The supplied hero demo is a 35.3-second, 2300x1440 video observed loading successfully in a browser. The site explicitly describes the office simulation as deterministic visual feedback, while the desktop application connects avatars to real agent processes.

### 3.3 What JheckBot should borrow

- One recognizable character as the primary entry point.
- A visible work state that is derived from actual backend events.
- Short structured dialogue around a work request.
- An office view that remains useful while work runs.
- A visual identity for the CEO that already exists in JheckBot's SVG character.

### 3.4 What JheckBot should not copy in the MVP

- Electron packaging or a desktop-only runtime.
- Pixi.js, WebGL, tile maps, sprite sheets, or A* pathfinding.
- The reference repository's characters, artwork, fonts, or branded copy.
- A memory hive, autonomous agent-to-agent mailbox, or multi-provider fleet.
- A fake animation that claims work is happening when no real Devin run exists.

The Munder Difflin repository is MIT licensed, but its bundled assets and third-party attributions still require separate review. This MVP uses JheckBot's existing original SVG character and does not import reference assets.

## 4. Current JheckBot Baseline

The existing repository already contains most of the surface area needed for the first slice.

### Web

- `apps/web/app/pages/projects/[id].vue` loads the project office and renders `OfficeScene`.
- `apps/web/app/components/office/OfficeScene.vue` renders the CEO, employee characters, rooms, status-driven movement, and live speech bubbles.
- `apps/web/app/components/office/OfficeCharacter.vue` renders a character, name tag, speech bubble, and accessible label, but it is not currently interactive.
- `apps/web/app/components/office/OfficeMiniFigure.vue` provides the current SVG character, CEO crown/tie, variant colors, walking bounce, idle bob, and talking mouth animation.
- `apps/web/app/components/office/CEOChat.vue` already loads CEO events, sends text requests, renders Markdown replies, subscribes to office SSE events, and shows loading/error states.
- `apps/web/app/pages/office/ceo.vue` already hosts a full-screen CEO chat route.
- `apps/web/app/composables/useCEOChat.ts` already wraps the CEO API.
- `apps/web/app/composables/useOfficeEvents.ts` already subscribes to office events over SSE.

### API

- `apps/api/src/routes/ceo.routes.ts` exposes `GET /api/offices/:officeId/ceo/events` and `POST /api/offices/:officeId/ceo/messages`.
- `apps/api/src/controllers/CEOController.ts` validates the office ID and request body.
- `apps/api/src/services/orchestration/CEOService.ts` persists CEO messages, calls the planner, creates a response, and currently runs a synthetic timed meeting sequence.
- `apps/api/src/services/orchestration/CEOPlanner.ts` creates tasks with deterministic keyword-based planning.
- `apps/api/src/services/orchestration/TaskDispatcher.ts` assigns a task and marks the selected office agent working, but does not start a Devin conversation.
- `apps/api/src/services/orchestration/WorkflowEngine.ts` creates workflow records and dispatches ready steps, but it does not itself start Devin and is intentionally deferred from this single-task path.
- `apps/api/src/services/ConversationService.ts` creates project conversations with provider defaults.
- `apps/api/src/services/PromptExecutionService.ts` validates a project path, persists a user prompt, and starts an `AgentManager` run.
- `apps/api/src/agent/AgentManager.ts` starts and watches Devin through tmux, persists output, and publishes terminal status events.
- `apps/api/src/agent/DevinAdapter.ts` owns Devin CLI command construction and availability checks.
- `apps/api/src/services/PathValidator.ts` remains the filesystem boundary.

### Persistence

- `tasks` already stores office/project/task state, assignment, workflow type, metadata, and timestamps.
- `conversations` already stores project conversation state, provider configuration, Devin session ID, and agent status.
- `office_events` already stores the office event stream.
- No durable task-to-conversation relationship currently exists.

### Current gaps

1. The CEO character has no click/tap event that opens the existing chat.
2. The inline panel beside the project office does not exist.
3. The current planner can create multiple tasks, while this MVP requires exactly one implementation task.
4. The current CEO response is deterministic task-list text rather than a general-purpose conversational response. This is acceptable for the MVP and must remain explicit.
5. The current dispatcher assigns a task but does not connect it to `ConversationService` and `PromptExecutionService`.
6. Task completion is not currently correlated with a conversation run, and the task table has no execution conversation link.
7. `CEOService` currently contains a timed multi-agent meeting path that is broader than this MVP.

## 5. Objective

Give an authenticated JheckBot user a simple, recognizable character they can talk to in the project office and use to start real coding work without leaving the office context.

### Primary user story

As an authenticated project owner, I want to click the CEO character, type a coding request in a panel beside the office, and have the CEO start one Devin implementation run while the office reflects the real status.

### Secondary user stories

- As a user, I can close and reopen the CEO panel without losing persisted CEO messages.
- As a user, I can see whether the request was accepted, started, completed, or failed.
- As a user, I can find the automatically created implementation conversation in the existing project conversation list.
- As a user, I cannot accidentally start multiple concurrent CEO implementation runs for the same office.
- As a user on a small screen, I can use the same flow without horizontal scrolling or inaccessible controls.

## 6. Assumptions

1. The first character is the existing CEO agent and no new character roster is needed.
2. The first supported execution provider is Devin, which is the current JheckBot provider.
3. The user is authenticated through the existing session middleware.
4. A project office is associated with one project through `offices.project_id`.
5. A request is treated as a coding request. General conversation is not part of this version.
6. Devin CLI, tmux, PostgreSQL, and an enabled project are available when the user expects real execution.
7. The project path continues to be validated by the existing `PathValidator` through `PromptExecutionService`.
8. One active CEO execution per office is sufficient for the first version. Parallel CEO requests are deferred.
9. No new third-party package or visual rendering engine is required.
10. The existing active multi-provider plan in `tasks/plan.md` and `tasks/todo.md` is a separate workstream and must not be overwritten.

## 7. Scope

### In scope

- CEO character click/tap interaction in the project office.
- Inline CEO chat panel beside the office on desktop.
- Full-width or full-screen mobile fallback for the same panel.
- Text input, submit, loading, success, failure, empty, and close states.
- Deterministic single-task CEO planning.
- Exactly one implementation task per accepted request.
- Automatic creation of one project conversation per implementation task.
- Automatic Devin start through existing `PromptExecutionService` and `AgentManager`.
- Durable task-to-conversation linkage.
- Real task and agent status events.
- Server-side validation of office/project association and enabled project state.
- Existing authentication, rate limiting, path validation, and error handling boundaries.
- Automated tests and a manual QA runbook.

### Explicitly deferred

- Natural-language general-purpose CEO conversation.
- A separate LLM call for CEO prose.
- Multiple new characters or a character picker.
- Direct employee chat.
- Automatic QA, review, research, or frontend/backend task fan-out.
- Agent-to-agent conversation.
- Pixi.js, canvas, WebGL, tile maps, sprite sheets, or pathfinding.
- Voice input or text-to-speech.
- Memory hive, semantic memory, or persistent character memory.
- Electron packaging or desktop-only behavior.
- Provider expansion beyond Devin.
- WorkflowEngine multi-step orchestration.
- New office settings, hiring, avatar customization, or game mechanics.
- Mobile pan/zoom gestures for the office.

## 8. UX and Interaction Specification

### 8.1 Project office entry point

- The existing CEO is the only interactive character in this slice.
- The CEO's visual treatment remains the existing `OfficeMiniFigure` with CEO styling.
- The interactive hit target must be a semantic button with a minimum 44x44 CSS pixel target.
- The accessible name must communicate both identity and action, such as `Open CEO chat for CEO`.
- Employee characters remain visually rendered but are not interactive in this version.
- Clicking or pressing Enter/Space on the CEO emits a project-page event and opens the panel.

### 8.2 Desktop panel

At desktop widths, the project page becomes a two-region workspace:

```text
+--------------------+---------------------------+
| project office     | CEO chat panel            |
|                    |                           |
| CEO + employees    | CEO messages             |
| task/activity      |                           |
|                    | text input + send        |
+--------------------+---------------------------+
```

- The office remains the primary content region.
- The CEO panel is a sibling region, not a route change.
- The panel uses a stable width between 360px and 440px and must not cause horizontal scrolling.
- The panel has a visible header with CEO identity, current status, and a close button.
- The panel reuses `CEOChat.vue` rather than introducing a second chat implementation.
- Existing message history is loaded from the existing CEO event endpoint.
- The project ID is always passed from the project page to the panel and API request.

### 8.3 Mobile fallback

Below the desktop breakpoint, the panel becomes a full-viewport overlay with:

- A fixed header and safe-area padding.
- A visible close button with an accessible name.
- No horizontal scrolling.
- The same text composer and message history.
- Focus moved to the composer when the panel opens where the browser permits it.
- Escape closes the panel when focus is not inside a multiline editing action.

The mobile layout is a responsive fallback, not a second product flow.

### 8.4 CEO response language

Responses are concise, structured, and coding-focused. A successful response communicates:

1. The request was understood as one implementation task.
2. The task title or summary.
3. Which agent was selected.
4. Whether Devin started.
5. Where to inspect ongoing output, using the existing project conversation.

Example successful response:

```text
I will handle this as one implementation task.

Task: Implement the requested change
Agent: Support
Status: Devin started

You can follow the run from the project conversations and office activity.
```

Example startup failure response:

```text
I created the implementation task, but Devin could not be started.

Check the project setup and office activity for the failure.
```

The response is generated from the structured plan and execution result. It is not presented as a free-form LLM response.

### 8.5 Interaction states

| State | User-visible behavior |
|---|---|
| Closed | CEO remains in the office; no panel is mounted |
| Opening | Panel appears and loads persisted CEO messages |
| Empty | Panel explains that the user can send a coding request |
| Sending | Composer is disabled and a typing indicator is shown |
| Started | Structured CEO response says the task and Devin run started |
| Working | Office agent status and standard activity events show real work |
| Completed | Task completion event and persisted Devin output are visible |
| Failed | Task/agent failure is shown without a stack trace; the user can inspect activity |
| Active request conflict | The user receives a clear message that an office request is already running |
| Devin unavailable | The task is recorded as failed and the response explains that execution could not start |

## 9. Functional Requirements

### FR-1: Open the CEO panel

- The project page renders the existing CEO as an interactive control.
- Activating the CEO opens the inline panel without changing the URL.
- Closing the panel returns the user to the office without affecting office state.
- The existing `/office/ceo?office=...&project=...` route remains functional for backward compatibility.

### FR-2: Load and persist CEO messages

- The panel calls `GET /api/offices/:officeId/ceo/events` on mount.
- Only `CEO_MESSAGE` and `CEO_RESPONSE` events are rendered as chat messages.
- The panel subscribes to the existing office SSE stream.
- Duplicate event IDs are ignored.
- The draft is local to the mounted panel in this MVP; closing or reloading the panel may discard an unsent draft.
- The draft is cleared only after the request has been accepted by the API.

### FR-3: Validate a CEO request

The server must reject the request before task creation when:

- The office ID is not a valid UUID.
- The request is empty after trimming.
- The request exceeds the existing 32KB prompt limit.
- The office does not exist or is not active.
- The project ID is invalid, missing for an execution-capable office, or does not match the office's project.
- The project does not exist or is disabled.
- The office already has an active CEO execution.

### FR-4: Create one task

For each accepted request:

- Exactly one task is created.
- The task is an implementation task with `workflowType: 'simple'`.
- The task has `createdBy: 'ceo'`.
- The task has no child tasks and no dependencies.
- The task starts in `backlog` and moves through `ready`, `assigned`, and `working` as execution begins.
- The task stores the original request in existing metadata without storing secrets.

### FR-5: Start one Devin conversation

- The selected office worker is chosen using the existing `TaskDispatcher` and capability rules.
- The implementation agent must not be the CEO when a capable worker is available.
- A new project conversation is created with a clear task title.
- The conversation uses `devin` for this MVP.
- The requested model is passed when supported; otherwise the existing Devin default is used.
- The task stores the new conversation ID in a dedicated nullable execution link.
- The existing `PromptExecutionService` starts Devin so path validation and agent lifecycle protections remain centralized.
- The raw project path, shell command, session name, or credentials are never returned in the CEO response.

### FR-6: Reflect execution state

- The assigned worker is marked `working` only when the task is being executed.
- A successful Devin terminal event marks the task completed and returns the worker to `idle`.
- A failed Devin terminal event marks the task failed and marks the worker `error`.
- The service emits office events with task, agent, and conversation IDs.
- Terminal output remains in the existing conversation stream and is not duplicated into CEO message history.
- A process restart limitation is documented: startup reconciliation of task state is deferred unless it is already provided by the existing conversation recovery path.

### FR-7: Preserve existing flows

- Normal project conversations continue to create and run Devin sessions.
- Existing office agents, tasks, activity panels, and SSE behavior continue to work.
- Existing authentication and project path restrictions remain active.
- Existing full-screen CEO chat remains usable.
- No multi-provider behavior is added as part of this MVP.

## 10. Architecture

### 10.1 Chosen architecture

Use the existing web office as the visual shell and add a narrow server-side execution bridge:

```text
Project page
  -> OfficeScene
      -> interactive CEO
          -> CEOChatPanel
              -> CEOChat
                  -> POST /api/offices/:officeId/ceo/messages
                      -> CEOController
                          -> CEOService
                              -> CEOPlanner.planSingleTask
                              -> OfficeTaskExecutionService
                                  -> TaskDispatcher
                                  -> ConversationService
                                  -> PromptExecutionService
                                      -> AgentManager
                                          -> DevinAdapter + tmux
```

Office state returns through the existing event flow:

```text
AgentManager / task services
  -> OfficeEventService
      -> office_events persistence
      -> SSE subscribers
          -> project page OfficeScene and CEOChat
```

### 10.2 Why this architecture

- It gives the user a real working loop without a second LLM integration.
- It reuses existing project and conversation security boundaries.
- It avoids importing the reference application's desktop rendering architecture.
- It makes the missing task-to-Devin relationship explicit instead of hiding it in a background timer.
- It keeps the multi-step `WorkflowEngine` available for a later orchestration phase without pretending it is complete today.

### 10.3 Explicit non-choice: do not call the WorkflowEngine for v1

The current `WorkflowEngine` creates workflow records and dispatches tasks, but `TaskDispatcher` does not start Devin and `WorkflowEngine.onTaskStatusChanged` is not wired into task status events. Extending that engine would turn this small MVP into a broader workflow redesign.

For this version, `CEOService` uses `OfficeTaskExecutionService` directly for one task. The `WorkflowEngine` remains unchanged and is reserved for the later multi-step capability.

## 11. Data Model

### 11.1 Task-to-conversation link

Add a nullable `execution_conversation_id` column to `tasks`:

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

The shared `OfficeTask` type exposes this as:

```ts
executionConversationId?: string
```

The link is written only by the internal execution service. It is not accepted from the public task create/update routes.

### 11.2 Execution lifecycle

```text
backlog
  -> ready
  -> assigned
  -> working
  -> completed

working
  -> failed
```

The internal `OfficeTaskService.completeExecution(taskId)` operation is the controlled domain operation for the `working -> completed` terminal transition. It validates that the task is execution-backed and currently working before emitting `TASK_COMPLETED`.

### 11.3 Idempotency and concurrency

The MVP permits one active CEO-created execution per office. The server performs a friendly active-task lookup before planning, and the database migration adds a partial unique index over active CEO tasks so concurrent requests cannot create two active tasks. The UI also disables the composer while its request is in flight, but the database constraint is authoritative.

A repeated request after a successful response is a new request only after the existing task has reached a terminal state. A request that arrives while the task is active receives a conflict response and does not create another task, conversation, or Devin run. A unique-constraint race is translated into the same safe conflict response.

## 12. API Contract

### 12.1 Existing endpoint retained

`POST /api/offices/:officeId/ceo/messages`

The route remains the public entry point. It stays behind the existing authenticated `/api` middleware and receives the existing rate limiter.

### 12.2 Request body

```ts
interface CEOSendMessageRequest {
  request: string
  projectId?: string
  model?: string
}
```

`projectId` is optional only for backward compatibility with an office that can resolve its project. The project page always sends it.

### 12.3 Response body

```ts
interface CEOSendMessageResponse {
  userMessage: OfficeEvent
  ceoResponse: OfficeEvent
  plan: {
    request: string
    complexity: 'simple'
    tasks: Array<{
      id: string
      title: string
      status: string
    }>
    dependencies: []
  }
  execution: {
    taskId: string
    conversationId?: string
    agentId?: string
    status: 'started' | 'failed'
    error?: string
  }
}
```

Only safe identifiers and user-facing status are returned. Do not return `cwd`, tmux session names, raw CLI output, credentials, or internal stack traces.

Expected statuses:

| Condition | HTTP status | Response behavior |
|---|---:|---|
| Valid request and Devin started | 201 | `execution.status = 'started'` |
| Task recorded but Devin startup failed | 201 | `execution.status = 'failed'`, safe error message, durable failure events |
| Empty/oversized/invalid request | 400 | Validation error, no task |
| Office/project not found or mismatched | 404 | Safe not-found response |
| Project disabled | 400 | Project state error |
| Existing active CEO execution | 409 | Conflict, no duplicate task or run |
| Rate limit exceeded | 429 | Existing rate limiter response |

The endpoint may return 201 with a failed execution because the request and task were durably recorded. A startup failure is represented in the execution result and CEO response rather than leaving the user with a missing history entry.

## 13. Office Events

The following events are used by the existing office SSE stream. Event metadata contains identifiers and state, not secrets or raw paths.

| Event | When emitted | Required metadata |
|---|---|---|
| `CEO_MESSAGE` | User request accepted | `projectId`, `sender`, `executionMode: 'single'` |
| `CEO_PLANNING` | Single-task planning begins/ends | `projectId`, `phase`, `taskCount` |
| `TASK_CREATED` | Task is persisted | `taskId`, `status` |
| `TASK_UPDATED` | Task status changes | `taskId`, `status`, `previousStatus` |
| `TASK_DISPATCHED` | Worker selected | `taskId`, `agentId`, `agentName` |
| `AGENT_UPDATED` | Worker status changes | `agentId`, `status` |
| `AGENT_STARTED` | Devin run starts | `taskId`, `agentId`, `conversationId` |
| `AGENT_COMPLETED` | Devin completes successfully | `taskId`, `agentId`, `conversationId` |
| `AGENT_FAILED` | Devin fails or cannot start | `taskId`, `agentId`, `conversationId` when available, safe error code |
| `TASK_COMPLETED` | Task completion is persisted | `taskId`, `conversationId` |
| `TASK_FAILED` | Task failure is persisted | `taskId`, `conversationId` when available |
| `CEO_RESPONSE` | CEO result is persisted | `projectId`, `taskId`, execution status |

The existing `CEOChat` filters CEO conversation messages. The project office continues to consume task and agent events for the visual state.

## 14. Error Handling

### Input and association errors

- Validate UUIDs at the controller/service boundary.
- Trim all user request text before planning.
- Enforce the existing 32KB prompt limit before task creation.
- Resolve the office and verify it is active.
- Resolve the project and verify that it matches the office association.
- Verify the project is enabled before creating a Devin conversation.

### Execution errors

- If no capable worker is available, record a failed execution result and emit a safe task/agent failure event.
- If conversation creation fails, mark the task failed and do not start Devin.
- If Devin startup fails, preserve the task and conversation records, mark the task failed, and surface a user-safe message.
- If a terminal status event is malformed, retain the last known state and log no sensitive payload.
- Terminal event handling is idempotent by task/conversation ID so duplicate status notifications do not create duplicate completion events.

### HTTP errors

The existing error handler remains the final boundary. No stack traces, absolute filesystem paths, shell commands, cookies, session IDs, or provider credentials are returned to the browser.

## 15. Security Requirements

- Keep the CEO route behind `authMiddleware.requireAuth`.
- Reuse the existing CEO/message rate limiter rather than adding an unbounded endpoint.
- Verify that `projectId` belongs to the requested office on the server; do not trust the browser query string.
- Verify the project is enabled before execution.
- Reuse `PromptExecutionService` and `PathValidator`; do not start Devin from a new code path that bypasses project path validation.
- Do not accept an execution conversation ID from the public task API.
- Do not pass arbitrary provider or shell arguments from the CEO request.
- For v1, use the registered Devin provider only. Unsupported agent provider configuration must fail explicitly rather than silently selecting another runtime.
- Do not log secrets or copy raw prompt content into new telemetry. Existing logs are outside this feature's scope and must not be expanded with credentials.
- Preserve CSRF/session behavior already enforced by the existing web/API boundary.

## 16. Performance and Accessibility

### Performance

- Do not add Pixi.js, GSAP, or another animation dependency.
- Keep the existing SVG character and CSS animation path.
- Do not poll Devin from the browser; use existing persisted events and SSE.
- Avoid mounting a second office scene inside the panel.
- Reserve panel layout space on desktop and use a fixed overlay on mobile to avoid layout instability.
- Keep the first CEO response limited to the structured plan and safe execution status.

### Accessibility

- Use semantic buttons for the CEO and close control.
- Provide accessible names for all icon-only controls.
- Preserve visible keyboard focus.
- Use an `aria-live` region for execution status and errors.
- Do not rely on speech bubbles or color alone to communicate state.
- Preserve the existing `prefers-reduced-motion` CSS behavior.
- Ensure the mobile panel can be closed with keyboard and is not trapped without an escape path.
- Keep decorative SVG parts `aria-hidden` while exposing one meaningful character label.

## 17. Testing Strategy

### Automated tests

| Concern | Test level | Location |
|---|---|---|
| Task execution link mapping and persistence contract | Unit/repository contract | `apps/api/tests/office-task-execution-link.test.ts` |
| Single-task plan shape | Unit | `apps/api/tests/ceo-planner.test.ts` |
| Task-to-conversation execution bridge | Unit/service | `apps/api/tests/office-task-execution-service.test.ts` |
| CEO response and execution contract | Unit/service | `apps/api/tests/ceo-service.test.ts` |
| CEO request validation and statuses | API integration | `apps/api/tests/ceo-routes.test.ts` |
| CEO client request/response contract | Composable unit | `apps/web/tests/office.test.ts` or a focused CEO chat test |
| Existing office and chat regressions | Full package suite | Existing `apps/web/tests` and `apps/api/tests` |

### Required scenarios

- One valid request creates one task, one link, one conversation, and one Devin start.
- A second active request is rejected without creating another task or conversation.
- A missing project/office association is rejected server-side.
- A disabled project is rejected.
- A missing Devin executable produces a durable failed execution and safe response.
- A successful terminal event completes the task exactly once.
- A failed terminal event fails the task exactly once.
- A panel request includes the project ID.
- Existing full-screen CEO chat and normal project conversation behavior remain intact.

### Manual browser QA

Manual QA is required because the existing web package has no browser E2E suite and the visual character interaction is not covered by current Node-environment tests. The QA runbook is stored at:

`docs/superpowers/qa/20260901_002700-interactive-ceo-character-mvp.md`

## 18. Commands

```bash
# Install dependencies
pnpm install

# Focused API tests
pnpm --filter @jheckbot/api exec vitest run \
  tests/ceo-planner.test.ts \
  tests/ceo-service.test.ts \
  tests/ceo-routes.test.ts \
  tests/office-task-execution-service.test.ts

# Focused web tests
pnpm --filter @jheckbot/web exec vitest run tests/office.test.ts

# Full automated suite
pnpm test

# Typecheck
pnpm typecheck

# Build
pnpm build

# Lint entry point
pnpm lint

# Runtime commands are user-managed. Do not start them during this planning pass.
pnpm dev
```

The current baseline observed before documentation work was `pnpm test` passing with 32 shared tests, 86 web tests, and 729 API tests. `pnpm typecheck` also passed.

## 19. Project Structure and Planned Surfaces

### API

```text
apps/api/
├── migrations/
│   └── 010_task_execution_conversation.sql       # new durable task link
├── src/services/
│   ├── OfficeService.ts                          # add internal office lookup
│   ├── OfficeTaskService.ts                      # execution link/completion operations
│   └── orchestration/
│       ├── CEOPlanner.ts                         # add single-task plan method
│       ├── CEOService.ts                         # use single-task execution path
│       └── OfficeTaskExecutionService.ts         # new task-to-Devin bridge
└── src/
    ├── controllers/CEOController.ts              # request validation contract
    └── app.ts                                    # composition and CEO rate limit
```

### Shared

```text
packages/shared/src/types/office.ts               # executionConversationId field
```

### Web

```text
apps/web/app/
├── components/office/
│   ├── OfficeCharacter.vue                        # CEO interaction event
│   ├── OfficeCornerOffice.vue                     # CEO interaction forwarding
│   ├── OfficeScene.vue                            # ceo-selected event
│   ├── CEOChat.vue                                # execution status contract
│   └── CEOChatPanel.vue                           # new inline panel shell
├── composables/useCEOChat.ts                      # execution response type
└── pages/projects/[id].vue                        # open/close panel and responsive layout
```

No new dependency, asset directory, route, or database table is required.

## 20. Code Style and Conventions

Follow the current repository conventions:

- TypeScript classes for API services and controllers.
- Repository → Service → Controller → Router layering.
- Vue `<script setup lang="ts">` components.
- Composable → component → page data flow.
- Shared domain types imported from `@jheckbot/shared`.
- Existing semantic CSS variables and Tailwind utilities for theme-aware UI.
- Existing error classes and status codes instead of raw untyped errors.
- No new comments unless they explain a non-obvious reason.
- No raw SVG icon library is introduced; the existing character art is retained.

Example client handling for the extended response:

```ts
const result = await chat.sendMessage(officeId, draft, projectId, selectedModel)

if (result.execution.status === 'failed') {
  executionNotice.value = result.execution.error ?? 'Devin could not be started'
}
```

## 21. Boundaries

### Always do

- Keep the first path to one CEO, one task, and one Devin run.
- Validate office/project association on the server.
- Reuse `PromptExecutionService`, `AgentManager`, `DevinAdapter`, and `PathValidator`.
- Persist the task-to-conversation link before relying on live terminal events.
- Make task and terminal completion idempotent.
- Preserve existing routes and normal conversation behavior.
- Run focused tests, full tests, typecheck, build, and manual browser QA before implementation is considered complete.
- Keep accessible labels, focus states, loading states, and error states.

### Ask first

- Adding a second provider or LLM API.
- Adding voice, text-to-speech, or browser media capture to the CEO panel.
- Adding a new database table or changing task ownership semantics.
- Changing project URL structure or removing `/office/ceo`.
- Importing reference artwork, fonts, sprites, or third-party assets.
- Changing the existing multi-provider plan in `tasks/plan.md` or `tasks/todo.md`.
- Enabling parallel CEO requests or multi-agent task fan-out.

### Never do

- Do not start application servers or watch processes as part of implementation or QA automation.
- Do not modify `.env` or environment override files.
- Do not bypass authentication, rate limiting, project path validation, or allowed-root checks.
- Do not expose secrets, shell commands, absolute paths, tmux session names, or stack traces.
- Do not create fake task completion events without a corresponding Devin status.
- Do not import Pixi.js or build a second office renderer for this slice.
- Do not overwrite the active multi-provider plan/task files.
- Do not delete existing tests to make the new path pass.

## 22. Acceptance Criteria

The MVP is ready for implementation sign-off when the plan can satisfy all of the following:

1. The CEO is keyboard and pointer accessible from `/projects/:id`.
2. Activating the CEO opens an inline panel beside the office on desktop.
3. The panel has a usable mobile fallback and close behavior.
4. Persisted CEO history loads and new CEO messages are stored.
5. A valid project request creates exactly one implementation task with no dependencies.
6. The request creates exactly one linked project conversation.
7. Devin starts automatically through the existing runner and path-validation path.
8. Task and agent status events reflect actual execution state.
9. Successful Devin completion marks the task completed exactly once.
10. Devin startup or terminal failure is persisted and shown without sensitive data.
11. A second active request does not create duplicate execution.
12. Existing project conversations and the full-screen CEO route continue to work.
13. `pnpm test`, `pnpm typecheck`, `pnpm build`, and `pnpm lint` pass after implementation.
14. Manual QA passes desktop, mobile, dark mode, keyboard, reduced motion, success, failure, and duplicate-request scenarios.

## 23. Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Task dispatcher assigns but does not execute | High | Add a dedicated execution bridge that calls existing conversation/prompt services and test the full service contract |
| Duplicate request starts duplicate Devin runs | High | Enforce one active CEO task per office server-side and keep task-to-conversation link durable |
| Task completion cannot use the current generic transition table | Medium | Add a private `completeExecution` domain operation with explicit `working` validation |
| Office and project IDs can be mismatched from the browser | High | Resolve office and verify project association server-side before planning |
| CEO response sounds like a general AI but is deterministic | Medium | Use explicit structured coding copy and document general conversation as deferred |
| Devin is unavailable in a local installation | Medium | Return a durable failed execution with a safe actionable message |
| API restart leaves an execution task stale | Medium | Document startup reconciliation as deferred and keep the conversation run authoritative for current behavior |
| Existing synthetic meeting code conflicts with one-task path | Medium | Replace the MVP path with status-driven execution and leave multi-step orchestration for a separate phase |
| Reference assets have separate attribution/license concerns | Low | Use existing JheckBot SVG art and borrow only interaction principles |

## 24. Deferred Follow-up Roadmap

After the MVP is stable, the next work should be separately specified and reviewed:

1. Add a real agent-to-conversation/task association view.
2. Add automatic QA and review stages through a correctly wired WorkflowEngine.
3. Add configurable character identity and personality fields that affect response generation.
4. Add a provider-aware execution bridge after the active multi-provider workstream is complete.
5. Add persistent character memory only after privacy and retention requirements are defined.
6. Evaluate a Pixi/canvas renderer only if the current SVG/CSS office cannot express the desired interaction.

No deferred item is part of this implementation plan.

## 25. Documentation Review Gate

This specification and its implementation plan must be reviewed before any source code is changed. The implementation session must use the plan task-by-task, preserve the boundaries above, and complete the separate QA runbook before claiming the feature is done.
