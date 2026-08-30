# Plan: Project-Office Workspace

**Spec:** `docs/superpowers/specifications/20260829_project-office-workspace.md`
**Branch:** `feat/project-office-workspace` (branched from `feat/interactive`)
**Date:** 20260829

## Architecture Overview

```
                    ┌─────────────────────────────────┐
                    │       apps/api (Express)        │
                    │                                 │
                    │  OfficeRepository               │
                    │       ↓                         │
                    │  OfficeService                  │
                    │    (findOrCreateForProject)     │
                    │       ↓                         │
                    │  OfficeController               │
                    │       ↓                         │
                    │  GET /api/projects/:id/office   │
                    └────────────┬────────────────────┘
                                 │ HTTP
                    ┌────────────▼────────────────────┐
                    │       apps/web (Nuxt)           │
                    │                                 │
                    │  useOffices.ts                  │
                    │    .getByProject(id)            │
                    │       ↓                         │
                    │  pages/projects/[id].vue        │
                    │    ├─ ConversationSidebar       │
                    │    ├─ ProjectHeader             │
                    │    ├─ OfficeScene (cubicles)    │
                    │    ├─ OfficeConversationPicker  │
                    │    ├─ Conversation starter      │
                    │    └─ ChangedFilesPanel         │
                    │                                 │
                    │  pages/office/ceo.vue           │
                    │    └─ CEOChat                   │
                    │         ├─ CEOPlanCard          │
                    │         └─ CEOAgentFeed         │
                    └─────────────────────────────────┘
```

## Dependency Graph

```
Task 1 (OfficeRepository)
  ↓
Task 2 (OfficeService + default agent seeding)
  ↓
Task 3 (OfficeController + routes + app.ts wiring)
  ↓
Task 4 (useOffices composable)
  ↓
Task 5 (Project page: render office scene)          ← Module 1 complete
  ↓
Task 6 (OfficeConversationPicker component)          ← Module 2
  ↓
Task 7 (Project page: integrate conversation picker) ← Module 2 complete
  ↓
Task 8 (CEOPlanCard component)                       ← Module 3
  ↓
Task 9 (CEOAgentFeed component)
  ↓
Task 10 (CEOChat: pass projectId + render plan + feed)
  ↓
Task 11 (CEO page: pass projectId)
  ↓
Task 12 (Final verification + QA report)
```

Tasks 1–5 are sequential (each depends on the prior). Tasks 6–7 and 8–11 are sequential within their modules but the two module chains could theoretically parallelize after Task 5. For safety and review simplicity, we execute sequentially.

## Risks and Mitigations

| Risk | Mitigation |
|---|---|
| `findOrCreateForProject` race condition (two concurrent requests create two offices) | Use `INSERT ... ON CONFLICT (project_id) DO NOTHING` or a unique constraint on `project_id`. Check if a unique index exists; if not, add one via migration. |
| Default agent seeding creates duplicate agents on retry | `findOrCreate` checks for existing office first; seeding only runs on fresh create. Add a check: only seed if `agentService.listByOffice(officeId)` returns empty. |
| Project page becomes too tall / cluttered | Use the existing grid layout pattern; office scene + picker in a scrollable main area; sidebar remains fixed. |
| CEO chat page loses context when navigated from project | Pass `project` query param; `ceo.vue` reads it and forwards to `CEOChat`. |
| Existing `/office?office=X` page breaks | Do not modify `useOffice.ts` or the office page. Project page uses `useOffices` + `useAgents` directly. |
| `project_id` unique constraint may not exist | Check migration 009; the index `idx_offices_project_id` is non-unique. Add migration `010_office_project_unique.sql` with a unique constraint. |

## Verification Checkpoints

| After task | Verify |
|---|---|
| Task 3 | `pnpm --filter @jheckbot/api test` passes; new office-service and office-controller tests pass. |
| Task 5 | `pnpm --filter @jheckbot/web typecheck` passes; project page compiles. |
| Task 7 | `pnpm --filter @jheckbot/web test` passes; conversation picker tests pass. |
| Task 11 | `pnpm --filter @jheckbot/web test` + `pnpm --filter @jheckbot/web typecheck` pass. |
| Task 12 | Full suite: `pnpm --filter @jheckbot/web test`, `pnpm --filter @jheckbot/api test`, both typechecks. QA report written. |

---

## Tasks

### Task 1: OfficeRepository

- **Acceptance:** `OfficeRepository` can `findByProjectId`, `getById`, `create`, and `list` offices from the `offices` table. All methods return `Office` typed objects.
- **Verify:** `pnpm --filter @jheckbot/api typecheck` passes. Unit tests for repository (if test infra exists for repos) or integration via service test in Task 2.
- **Files:**
  - `apps/api/src/repositories/OfficeRepository.ts` (NEW)
- **Notes:** Follow the pattern of `OfficeAgentRepository.ts` — use the same `pool`/`query` pattern. Map snake_case columns to camelCase `Office` type.

### Task 2: OfficeService + default agent seeding

- **Acceptance:** `OfficeService.findOrCreateForProject(projectId)` returns an office. On first call, creates the office and seeds 4 default agents (1 CEO + 3 employees). On second call, returns the existing office without re-seeding. Seeding checks `agentService.listByOffice` is empty before creating.
- **Verify:** `apps/api/tests/office-service.test.ts` passes. Tests: idempotency, seeding count, no re-seed on second call.
- **Files:**
  - `apps/api/src/services/OfficeService.ts` (NEW)
  - `apps/api/tests/office-service.test.ts` (NEW)
- **Notes:** Default agents: CEO (role "CEO"), Engineer (role "Engineer"), QA Engineer (role "QA Engineer"), Reviewer (role "Reviewer"). All `idle`, `enabled: true`. Office name: `"<projectName> Office"` — but since the service only receives `projectId`, use `"Project Office"` and let the controller pass the project name if desired. Simpler: service takes `{ projectId, name? }`.

### Task 3: OfficeController + routes + migration

- **Acceptance:** `GET /api/projects/:projectId/office` returns 200 with the office JSON (creating if needed). Invalid UUID returns 400. Route is mounted in `app.ts`. A unique constraint on `offices.project_id` exists via migration `010`.
- **Verify:** `apps/api/tests/office-controller.test.ts` passes. `pnpm --filter @jheckbot/api test` passes. `pnpm --filter @jheckbot/api typecheck` passes.
- **Files:**
  - `apps/api/src/controllers/OfficeController.ts` (NEW)
  - `apps/api/src/routes/office.routes.ts` (NEW)
  - `apps/api/src/app.ts` (MODIFIED — mount routes)
  - `apps/api/migrations/010_office_project_unique.sql` (NEW)
  - `apps/api/tests/office-controller.test.ts` (NEW)
- **Notes:** Route: `GET /api/projects/:projectId/office`. The controller calls `officeService.findOrCreateForProject(projectId)`. Follow `CEOController.ts` validation pattern (`validateIdParam`). Migration: `CREATE UNIQUE INDEX IF NOT EXISTS idx_offices_project_id_unique ON offices (project_id) WHERE project_id IS NOT NULL;`

### Task 4: useOffices composable

- **Acceptance:** `useOffices()` exposes `getByProject(projectId)` which calls `GET /api/projects/:projectId/office` and returns the `Office` object.
- **Verify:** `pnpm --filter @jheckbot/web typecheck` passes.
- **Files:**
  - `apps/web/app/composables/useOffices.ts` (NEW)
- **Notes:** Follow `useProjects.ts` pattern — return an object with API methods using `useApi()`.

### Task 5: Project page renders office scene

- **Acceptance:** `/projects/:id` fetches the project's office and agents on mount, then renders `OfficeScene` with the CEO and employees. The `ConversationSidebar`, `ProjectHeader`, and `ChangedFilesPanel` remain. The conversation starter textarea remains for starting new conversations.
- **Verify:** `pnpm --filter @jheckbot/web typecheck` passes. `pnpm --filter @jheckbot/web test` passes (no regressions).
- **Files:**
  - `apps/web/app/pages/projects/[id].vue` (MODIFIED)
- **Notes:** On mount: `const office = await useOffices().getByProject(id)`, then `const agents = await useAgents().listByOffice(office.id)`. Compute `ceo` and `employees` using `findCeo` and `findEmployees` from `useOffice.ts` (import the helper functions, not the composable). Render `OfficeScene` in the main content area, replacing the current centered conversation-starter block. Move the conversation starter below the office scene. Keep `@select-agent` and `@talk-to-ceo` handlers. `@talk-to-ceo` navigates to `/office/ceo?office=${office.id}&project=${id}`.

### Task 6: OfficeConversationPicker component

- **Acceptance:** `OfficeConversationPicker` renders a list of conversations with title, active/idle dot, and last-message time. "New Conversation" button at top. Emits `select(id)` and `new()`. Shows loading and empty states. Dark mode supported.
- **Verify:** `apps/web/tests/office-conversation-picker.test.ts` passes. `pnpm --filter @jheckbot/web test` passes.
- **Files:**
  - `apps/web/app/components/office/OfficeConversationPicker.vue` (NEW)
  - `apps/web/tests/office-conversation-picker.test.ts` (NEW)
- **Notes:** Props: `conversations: Conversation[]`, `loading?: boolean`. Emits: `select(id)`, `new()`. Reuse the active-status dot pattern from `ConversationSidebar.vue`. Use semantic CSS variables. Add `dark:` variants.

### Task 7: Project page integrates conversation picker

- **Acceptance:** The project page renders `OfficeConversationPicker` below the office scene, wired to the project's conversations. `select` navigates to `/conversations/:id`. `new` focuses the conversation starter textarea.
- **Verify:** `pnpm --filter @jheckbot/web test` passes. `pnpm --filter @jheckbot/web typecheck` passes.
- **Files:**
  - `apps/web/app/pages/projects/[id].vue` (MODIFIED)
- **Notes:** The conversations are already loaded on the project page (`convApi.listByProject`). Pass them to the picker. Wire `@select` → `navigateTo('/conversations/' + id)`. Wire `@new` → existing `newConversation()` function.

### Task 8: CEOPlanCard component

- **Acceptance:** `CEOPlanCard` renders a complexity badge (simple=emerald, medium=amber, complex=rose), a task list with titles and status badges, and a dependency count. Dark mode supported.
- **Verify:** `apps/web/tests/ceo-plan-card.test.ts` passes. `pnpm --filter @jheckbot/web test` passes.
- **Files:**
  - `apps/web/app/components/office/CEOPlanCard.vue` (NEW)
  - `apps/web/tests/ceo-plan-card.test.ts` (NEW)
- **Notes:** Props: `plan: { complexity: string; tasks: { id: string; title: string; status: string }[]; dependencies: { taskId: string; dependsOnTaskId: string }[] }`. Use a `defineCEOResponse` type matching the API return. Complexity badge colors: simple → `bg-emerald-500/15 text-emerald-700 dark:text-emerald-300`, medium → `bg-amber-500/15 text-amber-700 dark:text-amber-300`, complex → `bg-rose-500/15 text-rose-700 dark:text-rose-300`. Task status badge: reuse `OfficeStatusBadge` pattern or map status → color inline.

### Task 9: CEOAgentFeed component

- **Acceptance:** `CEOAgentFeed` renders a chronological list of TASK_* and AGENT_* events with timestamps and event-type icons. Non-task/agent events are filtered out. Dark mode supported.
- **Verify:** `pnpm --filter @jheckbot/web typecheck` passes. Component renders in isolation.
- **Files:**
  - `apps/web/app/components/office/CEOAgentFeed.vue` (NEW)
- **Notes:** Props: `events: OfficeEvent[]`. Filter: `event.eventType.startsWith('TASK_') || event.eventType.startsWith('AGENT_')`. Render: icon (📋 for TASK_, 🤖 for AGENT_), content text, timestamp. Reverse chronological or chronological (match chat flow — chronological, oldest first). Use `formatTime` from `CEOChat.vue` or a shared util.

### Task 10: CEOChat rewrite — conversation chat UI + plan + feed

- **Acceptance:** `CEOChat` is rewritten to match the conversation chat UI from `conversations/[id].vue`. It accepts `officeId` and `projectId` props. User messages use the conversation chat bubble styling (right-aligned, `bg-accent-muted`, `rounded-2xl rounded-br-md`). CEO messages render with the assistant avatar (lightning bolt in `bg-content` circle) and `Markdown` component. Copy buttons appear on hover. Typing indicator uses bouncing dots with avatar. Input area uses the `rounded-2xl` border wrapper with voice input (`useVoiceInput`), `VoiceWaveform`, send button, and `MessageToolbar` (model selector + bypass + skills). Draft persists via `useConversationDrafts`. After sending, `CEOPlanCard` renders below the CEO response. `CEOAgentFeed` renders live TASK_/AGENT_ events. Error display is a dismissible red banner. Empty state is centered. Dark mode supported.
- **Verify:** `pnpm --filter @jheckbot/web test` passes. `pnpm --filter @jheckbot/web typecheck` passes.
- **Files:**
  - `apps/web/app/components/office/CEOChat.vue` (REWRITTEN)
- **Notes:** This is a full rewrite, not a patch. Reference `apps/web/app/pages/conversations/[id].vue` lines 62–642 for the UI patterns to adopt. Key reusable components: `Markdown`, `MessageToolbar`, `VoiceWaveform`, `SkillsPicker`, `ModelPicker`. Key composables: `useVoiceInput`, `useSelectedModel`, `useBypassMode`, `useConversationDrafts`, `useOfficeEvents`, `useCEOChat`. The `sendMessage` response returns `{ userMessage, ceoResponse, plan }` — capture `plan` in a ref and render `CEOPlanCard`. CEO-specific differences from conversation chat: no `ChangedFilesPanel`, no queue, no agent timer, no stop button, no `useSSE` (use `useOfficeEvents` instead). Draft key: use office ID as the conversation draft key.

### Task 11: CEO page passes projectId + full-height layout

- **Acceptance:** `/office/ceo` reads `project` from `route.query` and passes it to `CEOChat`. The page adopts the `flex h-[100dvh] overflow-hidden` layout pattern from `conversations/[id].vue` for a full-height chat experience.
- **Verify:** `pnpm --filter @jheckbot/web typecheck` passes.
- **Files:**
  - `apps/web/app/pages/office/ceo.vue` (MODIFIED)
- **Notes:** `const projectId = computed(() => route.query.project as string | undefined)`. Pass `:project-id="projectId"` to `CEOChat`. Replace the current simple wrapper with the full-height flex layout. Keep the `AppHeader` with "← Office" back link and "Talk to CEO" title.

### Task 12: Final verification + QA report

- **Acceptance:** All tests pass. Typecheck passes for both packages. QA report written to `docs/superpowers/qa/`.
- **Verify:**
  - `pnpm --filter @jheckbot/web test`
  - `pnpm --filter @jheckbot/api test`
  - `pnpm --filter @jheckbot/web typecheck`
  - `pnpm --filter @jheckbot/api typecheck`
- **Files:**
  - `docs/superpowers/qa/20260829_project-office-workspace.md` (NEW)
- **Notes:** QA report covers: API endpoint verification, project page office rendering, conversation picker, CEO chat plan card, CEO agent feed, dark mode, backward compatibility of `/office` page, test results summary.

---

## Execution Strategy

Per the user's previous selection, use **subagent-driven development**:

- Fresh implementer subagent per task.
- Task-specific review subagent after each implementation.
- Fix/review loops for findings.
- Final broad code review across the whole branch.
- Continue without pausing for user confirmation between tasks.
- Record rulings and progress in `.superpowers/sdd/20260829_project-office-workspace/progress.md`.

## Out of Scope

- Individual agent chat (chatting with non-CEO agents) — not requested.
- Office settings/management UI — not requested.
- Custom agent creation from the project page — use existing `/agents/:id` page.
- Real-browser visual QA — dev server startup is prohibited; user manages runtime.
- Changes to `useOffice.ts` composable.
- Changes to the existing `/office?office=X` page.
- Changes to the `Office` shared type.
- New orchestration behavior (CEOPlanner logic unchanged).
