# Spec: Project-Office Workspace

## Capability Map

This initiative bundles three independently testable capabilities. Module boundaries and build order are approved before any module spec is written.

| Module id | Responsibility | Depends on |
|---|---|---|
| `office-project-link` | API + UI to find-or-create an office for a project; project page shows the office as the workspace | — |
| `office-conversation-picker` | UI in the office to pick existing project conversations or start a new one | `office-project-link` |
| `ceo-chatbox` | Improved CEO chat: passes project context, renders plan as structured card, shows agent assignment feed with live status | `office-project-link` |

Build order: `office-project-link` → `office-conversation-picker`, `ceo-chatbox`

---

## Objective

### Vision

When a user opens a project (`/projects/:id`), they see the office (cubicle village) for that project — the CEO in the center corner office, employees in surrounding cubicles. The office is the project workspace. From the office, the user can:

1. **Pick a conversation** — select an existing project conversation or start a new one, navigating to the conversation chat view.
2. **Chat with the CEO** — open an improved CEO chatbox that passes project context, renders the CEO's plan as a structured card (complexity, tasks, dependencies), and shows a live agent assignment feed as agents pick up tasks.

### User stories

- As a user opening a project, I see the office village immediately, so I don't need to navigate to a separate office page with a query string.
- As a user in the office, I can pick from my project's conversations, so I can resume work without leaving the office context.
- As a user in the office, I can start a new conversation with Devin, so I can begin a new coding task.
- As a user talking to the CEO, the CEO knows which project I'm working in, so its plan is project-scoped.
- As a user talking to the CEO, I see the plan as a structured card with tasks and dependencies, not just a text blob.
- As a user talking to the CEO, I see which agents are assigned to which tasks and their live status, so I can track progress.

### Success criteria

1. `GET /api/projects/:projectId/office` returns the project's office (creating one with default agents if none exists).
2. `/projects/:id` renders the `OfficeScene` cubicle village using the project's office agents.
3. The project page's conversation sidebar remains functional (list, pin, rename, delete, navigate).
4. The office view includes a conversation picker showing the project's conversations with active/idle status.
5. Starting a new conversation from the office creates a project conversation and navigates to it.
6. The CEO chat passes `projectId` to `POST /api/offices/:officeId/ceo/messages`.
7. The CEO chat renders the plan response as a structured card: complexity badge, task list with statuses, dependency arrows.
8. The CEO chat shows a live agent assignment feed derived from office events (TASK_CREATED, TASK_ASSIGNED, AGENT_STATUS).
9. All existing tests pass; new tests cover the office link API, conversation picker, and CEO chat plan rendering.
10. Typecheck passes for both `@jheckbot/web` and `@jheckbot/api`.

---

## Tech Stack

- **Frontend:** Vue 3 (`<script setup>`), Nuxt 4, TypeScript, Tailwind CSS
- **Backend:** Express, TypeScript, PostgreSQL
- **Shared:** `@jheckbot/shared` workspace package
- **Testing:** Vitest
- **Package manager:** pnpm workspaces
- **Existing patterns:** Repository → Service → Controller → Router (API); composable → component → page (web)

---

## Commands

```bash
# Install
pnpm install

# Test
pnpm --filter @jheckbot/web test
pnpm --filter @jheckbot/api test

# Typecheck
pnpm --filter @jheckbot/web typecheck
pnpm --filter @jheckbot/api typecheck

# Lint
pnpm --filter @jheckbot/web lint
pnpm --filter @jheckbot/api lint

# Dev (user-managed — do not start)
pnpm --filter @jheckbot/web dev
pnpm --filter @jheckbot/api dev
```

---

## Project Structure

### API (new files)

```
apps/api/src/
├── repositories/
│   └── OfficeRepository.ts          # NEW — offices table CRUD
├── services/
│   └── OfficeService.ts             # NEW — find-or-create, list, get
├── controllers/
│   └── OfficeController.ts          # NEW — HTTP handlers
├── routes/
│   └── office.routes.ts             # NEW — /api/offices + /api/projects/:projectId/office
└── app.ts                           # MODIFIED — mount office routes
```

### Web (new + modified files)

```
apps/web/app/
├── pages/
│   ├── projects/[id].vue            # MODIFIED — render office scene + conversation picker
│   └── office/ceo.vue               # MODIFIED — pass projectId to CEOChat
├── components/
│   ├── office/
│   │   ├── OfficeConversationPicker.vue  # NEW — list/start project conversations
│   │   ├── CEOChat.vue               # MODIFIED — plan card + agent feed + projectId
│   │   ├── CEOPlanCard.vue           # NEW — structured plan rendering
│   │   └── CEOAgentFeed.vue          # NEW — live agent assignment feed
│   └── ConversationSidebar.vue       # UNCHANGED — reused on project page
├── composables/
│   ├── useOffices.ts                 # NEW — office API client (find-by-project, get, list)
│   └── useCEOChat.ts                 # MODIFIED — already accepts projectId (no change needed)
└── utils/
    └── (existing layout utils)       # UNCHANGED
```

### Shared (no changes)

`packages/shared/src/types/office.ts` already defines `Office` with `projectId`. No type changes needed.

### Tests (new files)

```
apps/api/tests/
├── office-service.test.ts           # NEW — find-or-create, default agent seeding
└── office-controller.test.ts        # NEW — HTTP integration

apps/web/tests/
├── office-conversation-picker.test.ts  # NEW
└── ceo-plan-card.test.ts               # NEW
```

---

## Code Style

Follow existing conventions in the codebase.

### API pattern (Repository → Service → Controller → Router)

```ts
// repositories/OfficeRepository.ts
export class OfficeRepository {
  async findByProjectId(projectId: string): Promise<Office | null> { ... }
  async create(input: { name: string; projectId?: string }): Promise<Office> { ... }
}

// services/OfficeService.ts
export class OfficeService {
  constructor(
    private repo: OfficeRepository,
    private agentService: OfficeAgentService,
  ) {}

  async findOrCreateForProject(projectId: string): Promise<Office> {
    const existing = await this.repo.findByProjectId(projectId)
    if (existing) return existing
    const office = await this.repo.create({ name: 'Project Office', projectId })
    await this.seedDefaultAgents(office.id)
    return office
  }
}
```

### Web pattern (composable → component → page)

```vue
<!-- components/office/OfficeConversationPicker.vue -->
<script setup lang="ts">
const props = defineProps<{
  conversations: Conversation[]
  projectId: string
}>()
const emit = defineEmits<{
  (e: 'select', id: string): void
  (e: 'new'): void
}>()
</script>
```

### Naming conventions

- API: PascalCase classes, camelCase methods, `*.routes.ts` / `*.controller.ts` / `*.service.ts` / `*.repository.ts`
- Web: PascalCase components, camelCase composables (`useXxx.ts`), kebab-case Vue file names for components
- Types: import from `@jheckbot/shared` where available

---

## Testing Strategy

### Framework

Vitest, existing configuration in `apps/web` and `apps/api`.

### Test levels by concern

| Concern | Level | Location |
|---|---|---|
| Office find-or-create logic | Unit (service) | `apps/api/tests/office-service.test.ts` |
| Office HTTP endpoints | Integration (controller) | `apps/api/tests/office-controller.test.ts` |
| Default agent seeding | Unit (service) | `apps/api/tests/office-service.test.ts` |
| Conversation picker rendering | Component (Vue test utils) | `apps/web/tests/office-conversation-picker.test.ts` |
| CEO plan card rendering | Component (Vue test utils) | `apps/web/tests/ceo-plan-card.test.ts` |
| Existing regression | Full suite | `pnpm --filter @jheckbot/web test`, `pnpm --filter @jheckbot/api test` |

### Coverage expectations

- `OfficeService.findOrCreateForProject`: idempotent (calling twice returns same office), seeds exactly 1 CEO + 3 employees on first call, does not re-seed on second call.
- `OfficeController`: `GET /api/projects/:projectId/office` returns 200 with office JSON; invalid UUID returns 400.
- `OfficeConversationPicker`: renders conversation list, emits `select` on click, emits `new` on button click, shows active status indicator.
- `CEOPlanCard`: renders complexity badge, renders task list with statuses, renders dependency count.

### What not to test

- Visual styling, animations, color choices (manual QA).
- SSE stream mechanics (already tested in existing suite).

---

## Boundaries

### Always do

- Run `pnpm --filter @jheckbot/web test` and `pnpm --filter @jheckbot/api test` before completion.
- Run typecheck for both packages before completion.
- Follow existing Repository → Service → Controller → Router pattern.
- Follow existing composable → component → page pattern.
- Reuse existing `OfficeScene`, `OfficeCubicle`, `OfficeCornerOffice`, `OfficeCharacter` components.
- Reuse existing `ConversationSidebar`, `useConversations`, `useActiveConversations`.
- Reuse existing `useCEOChat` (already accepts `projectId`).
- Use existing semantic CSS variables for light/dark themes.
- Add `dark:` variants to all new colored elements.
- Keep decorative elements `aria-hidden`.
- Keep interactive agents as buttons with accessible labels.

### Ask first

- Changing the `offices` table schema (no migration expected — table already has `project_id`).
- Adding new npm dependencies.
- Changing the `Office` shared type.
- Modifying `useOffice.ts` composable contract (used by existing office page).

### Never do

- Start dev servers, watch processes, or preview servers.
- Modify `.env` files.
- Delete existing tests.
- Change the existing `/office?office=X` page route (keep it working for backward compatibility).
- Fabricate agent data not derivable from real `OfficeAgent` fields.
- Introduce levels, XP, or game-mechanic progression (visual style only).

---

## Module Specs

### Module: `office-project-link`

**Objective:** When a user opens a project, the project's office is loaded and rendered. If no office exists for the project, one is created with default agents.

**API changes:**

1. `OfficeRepository` — `findByProjectId(projectId)`, `getById(id)`, `create({ name, projectId })`, `list()`.
2. `OfficeService` — `findOrCreateForProject(projectId)`: finds office by `project_id`; if none, creates office + seeds 1 CEO + 3 default employees.
3. `OfficeController` — `getByProject(req, res)`: handles `GET /api/projects/:projectId/office`.
4. Route mounting in `app.ts`: `GET /api/projects/:projectId/office` → `OfficeController.getByProject`.

**Default agents seeded:**

| Role | Name | Status | Enabled |
|---|---|---|---|
| CEO | CEO | idle | true |
| Engineer | Engineer | idle | true |
| QA Engineer | QA Engineer | idle | true |
| Reviewer | Reviewer | idle | true |

These match the CEOPlanner's task roles (implement, qa, review) so tasks can be assigned.

**Web changes:**

1. `useOffices.ts` composable — `getByProject(projectId)` API client.
2. `pages/projects/[id].vue` — on mount, fetch the project's office via `useOffices().getByProject(id)`, then load agents via `useAgents().listByOffice(officeId)`. Render `OfficeScene` with the agents. Keep `ConversationSidebar`, `ProjectHeader`, `ChangedFilesPanel`.

**Backward compatibility:**

- The existing `/office?office=X` page continues to work unchanged.
- `useOffice.ts` composable is not modified (the project page uses `useOffices` + `useAgents` directly, not `useOffice`).

**Acceptance criteria:**

- `GET /api/projects/:projectId/office` returns 200 with office + agents on first call (creates them).
- Second call returns the same office (idempotent).
- `/projects/:id` renders the `OfficeScene` cubicle village.
- CEO is visible in the center; employees are in cubicles.
- Conversation sidebar still lists, pins, renames, deletes conversations.
- No existing tests regress.

---

### Module: `office-conversation-picker`

**Objective:** From the office view on the project page, the user can pick an existing conversation or start a new one.

**Web changes:**

1. `OfficeConversationPicker.vue` — new component.
   - Props: `conversations: Conversation[]`, `projectId: string`, `loading?: boolean`.
   - Emits: `select(id)`, `new()`.
   - Renders a list of conversations with title, active/idle status dot, last-message time.
   - "New Conversation" button at top.
   - Clicking a conversation emits `select` → parent navigates to `/conversations/:id`.
   - "New Conversation" emits `new` → parent creates a conversation and navigates.
2. `pages/projects/[id].vue` — integrate `OfficeConversationPicker` below or beside the `OfficeScene`. Wire `select` → `navigateTo('/conversations/' + id)`. Wire `new` → focus a conversation-starter input (reuse existing textarea + `MessageToolbar` pattern) or create + navigate immediately.

**Design decision — new conversation flow:**

The existing project page has a textarea + model selector for starting conversations. This is preserved. When the user clicks "New Conversation" in the picker, the textarea is focused and scrolled into view (matching the existing `newConversation()` behavior). The user types their message and sends, which creates a conversation and navigates to it.

This avoids creating empty conversations and matches the existing UX.

**Acceptance criteria:**

- `OfficeConversationPicker` renders the conversation list with active/idle indicators.
- Clicking a conversation navigates to `/conversations/:id`.
- "New Conversation" focuses the message input.
- Sending a message creates a conversation and navigates to it.
- Empty state shows "No conversations yet."
- Loading state shows "Loading..."
- Dark mode supported.

---

### Module: `ceo-chatbox`

**Objective:** The CEO chat is rebuilt to match the conversation chat UI (`/conversations/:id`), passes project context, renders the plan as a structured card, and shows a live agent assignment feed. The CEO chat should look and feel like the existing Devin conversation chat — same message bubbles, Markdown rendering, copy buttons, avatars, rich input area with voice/model selector, typing indicators — not the current bare-bones textarea.

**Reference UI:** `apps/web/app/pages/conversations/[id].vue` is the canonical conversation chat interface. The CEO chat adopts its visual language and interaction patterns.

**Web changes:**

1. `CEOPlanCard.vue` — new component.
   - Props: `plan: CEOPlan` (complexity, tasks, dependencies).
   - Renders complexity badge (simple=emerald, medium=amber, complex=rose).
   - Renders task list: each task shows title, status badge, assigned agent name (if any).
   - Renders dependency count summary.
   - Dark mode supported.
2. `CEOAgentFeed.vue` — new component.
   - Props: `events: OfficeEvent[]` (filtered to TASK_* and AGENT_* events).
   - Renders a chronological feed: "Task created: X", "Task assigned to Agent Y", "Agent Y status: working".
   - Each entry has a timestamp and event-type icon.
   - Dark mode supported.
3. `CEOChat.vue` — rewritten to match the conversation chat UI.
   - **Props:** `officeId: string`, `projectId?: string`.
   - **Message rendering — adopt conversation chat patterns:**
     - User messages: right-aligned, `rounded-2xl rounded-br-md bg-accent-muted px-4 py-2.5 text-sm text-content whitespace-pre-wrap break-words`, with copy button on hover (matching `conversations/[id].vue` user message bubble).
     - CEO messages: left-aligned with avatar (lightning bolt in `bg-content` circle, matching the assistant avatar in conversations), `Markdown` component for content rendering (not plain text), model/role badge, copy button on hover.
     - Use `animate-slide-up` on message entries (matching conversation chat).
     - Typing indicator: three bouncing dots with the assistant avatar (matching conversation chat typing indicator), replacing the current simple dots.
   - **Input area — adopt conversation chat rich input:**
     - `rounded-2xl border border-border bg-white focus-within:border-content-subtle/60 focus-within:ring-1 focus-within:ring-content-subtle/30` wrapper (matching conversation chat input box).
     - Textarea with `autoResize`, `@keydown.enter.exact.prevent` to send, shift+enter for newline.
     - Voice input button using `useVoiceInput` composable (mic icon, listening state, interim transcript display).
     - `VoiceWaveform` component when listening.
     - Send button with `bg-content text-surface` styling (matching conversation chat send button).
     - `MessageToolbar` below the input: model selector (`useSelectedModel`), bypass toggle (`useBypassMode`), skills picker button.
     - `SkillsPicker` and `ModelPicker` modals.
   - **Draft persistence:** Use `useConversationDrafts` to persist the CEO chat draft across page reloads (keyed by office ID).
   - **Plan + agent feed integration:**
     - Pass `projectId` to `chat.sendMessage(officeId, draft, projectId)`.
     - After sending, capture the returned `plan` and render `CEOPlanCard` below the CEO response message.
     - Subscribe to office events via `useOfficeEvents` and render TASK_/AGENT_ events in `CEOAgentFeed` below the plan card.
   - **Scroll behavior:** Auto-scroll to bottom on new messages (matching conversation chat `scrollToBottom`).
   - **Empty state:** Centered icon + "Send a request to the CEO to start planning." (keep existing empty state message, adopt conversation chat empty state styling).
   - **Error display:** Dismissible red error banner (matching conversation chat error display).
4. `pages/office/ceo.vue` — modified.
   - Read `projectId` from `route.query.project` or look up the office's project.
   - Pass `projectId` to `CEOChat`.
   - Adopt the `flex h-[100dvh] overflow-hidden` layout pattern from `conversations/[id].vue` for a full-height chat experience.

**Reusable components and composables (already exist, no changes needed):**

| Component/Composable | Source | Purpose in CEO chat |
|---|---|---|
| `Markdown.vue` | `components/Markdown.vue` | Render CEO response content as markdown |
| `MessageToolbar.vue` | `components/MessageToolbar.vue` | Model selector + bypass toggle + skills button |
| `VoiceWaveform.vue` | `components/VoiceWaveform.vue` | Voice input waveform animation |
| `SkillsPicker.vue` | `components/SkillsPicker.vue` | Slash command picker |
| `ModelPicker.vue` | `components/ModelPicker.vue` | Model family picker |
| `useVoiceInput` | `composables/useVoiceInput.ts` | Voice input with interim transcript |
| `useSelectedModel` | `composables/useSelectedModel.ts` | Model selection state |
| `useBypassMode` | `composables/useBypassMode.ts` | Bypass toggle state |
| `useConversationDrafts` | `composables/useConversationDrafts.ts` | Draft persistence (key by office ID) |
| `useOfficeEvents` | `composables/useOfficeEvents.ts` | SSE subscription for office events (already used) |
| `useCEOChat` | `composables/useCEOChat.ts` | CEO chat API client (already used, already accepts projectId) |

**API changes:**

None. The `POST /api/offices/:officeId/ceo/messages` endpoint already accepts `projectId` and returns the plan. The `useCEOChat.sendMessage` composable already accepts `projectId`. Only the UI was not passing it.

**Plan data structure (already returned by API):**

```ts
interface CEOPlan {
  request: string
  complexity: 'simple' | 'medium' | 'complex'
  tasks: { id: string; title: string; status: string }[]
  dependencies: { taskId: string; dependsOnTaskId: string }[]
}
```

**Key differences from conversation chat (CEO-specific behavior):**

| Aspect | Conversation chat | CEO chat |
|---|---|---|
| API endpoint | `POST /api/conversations/:id/messages` | `POST /api/offices/:officeId/ceo/messages` |
| Live streaming | SSE via `useSSE` (output, logs, status) | SSE via `useOfficeEvents` (office events) |
| Response shape | Messages array from API | `{ userMessage, ceoResponse, plan }` from API |
| Plan card | N/A | `CEOPlanCard` below CEO response |
| Agent feed | N/A | `CEOAgentFeed` from TASK_/AGENT_ events |
| Changed files | `ChangedFilesPanel` | Not shown (CEO plans, doesn't edit code directly) |
| Queue | `useConversationQueues` | Not needed (CEO responds synchronously) |
| Agent timer | `useAgentTimer` | Not needed (no long-running agent) |
| Stop button | Yes (stop running agent) | No (CEO planning is synchronous) |

**Acceptance criteria:**

- `CEOChat` passes `projectId` to `sendMessage` when available.
- User messages render with the same bubble styling as `conversations/[id].vue` (right-aligned, `bg-accent-muted`, `rounded-2xl rounded-br-md`).
- CEO messages render with the assistant avatar (lightning bolt in `bg-content` circle) and `Markdown` component for content.
- Copy message buttons appear on hover for both user and CEO messages.
- Typing indicator uses three bouncing dots with the assistant avatar.
- Input area uses the `rounded-2xl` border wrapper with voice input button and send button.
- `MessageToolbar` renders below the input with model selector and bypass toggle.
- Voice input works (mic button toggles listening, interim transcript shows, `VoiceWaveform` animates).
- Draft persists across page reloads via `useConversationDrafts`.
- `CEOPlanCard` renders complexity badge with correct color per complexity.
- `CEOPlanCard` renders all tasks with titles and status badges.
- `CEOPlanCard` renders dependency count.
- `CEOAgentFeed` renders TASK_ and AGENT_ events chronologically.
- `CEOAgentFeed` ignores non-task/agent events.
- Plan card appears below the CEO response after sending.
- Agent feed updates live as events stream in.
- Error display is a dismissible red banner.
- Empty state shows centered icon + prompt.
- Dark mode supported on all new and modified components.
- No existing tests regress.

---

## Open Questions

1. **Default agent models/providers** — The seeded default agents will have no `provider` or `model` set. Is that acceptable, or should they default to a specific provider? (Assumption: leave unset; the agent profile page lets the user configure them.)

2. **Office name** — When auto-creating an office for a project, should the office name be the project name + " Office" (e.g., "my-app Office"), or a generic "Project Office"? (Assumption: use project name + " Office".)

3. **CEO chat navigation** — When the user clicks the CEO in the office on the project page, should it navigate to `/office/ceo?office=X&project=Y` (existing separate page), or open an inline chat panel? (Assumption: navigate to the existing separate page with project query param — simpler, preserves existing UX.)

4. **Conversation picker placement** — Should the picker be below the office scene, in a sidebar, or as a collapsible panel? (Assumption: below the office scene, full-width, matching the existing task/activity panel grid layout.)
