# Implementation Plan: Multi-Provider Agent Support

## Overview

Add a provider abstraction so JheckBot conversations can be run by Devin, Claude Code, Codex, Gemini CLI, or a custom local binary. The work is split into vertical slices: foundation (interface + Devin refactor), persistence/API, UI, new adapters, and QA.

## Architecture decisions

- The existing `conversations.agent_type` column becomes the conversation's `provider_id`.
- New `conversations.provider_config` and `projects.default_provider_id`/`projects.default_provider_config` store custom binary/args and per-project defaults.
- A registry (`AgentProviderRegistry`) maps `provider_id` to an adapter instance.
- `AgentManager` receives the provider from the conversation and delegates to the adapter.
- Each adapter owns command construction, availability, and (optionally) model/skills discovery and output normalization.
- `TmuxManager` remains the shared session boundary; adapters only build command strings.

## Task list

### Task 1: Provider interface and Devin adapter refactor
- Define `AgentAdapter` interface and `AgentProviderRegistry`.
- Refactor `DevinAdapter` to implement `AgentAdapter`.
- Add `supportedModels()`, `hasSkills`, and optional `listSkills()`/`normalizeOutput()`/`resumeSessionId()`.
- Ensure existing Devin tests pass.

**Acceptance:** `DevinAdapter` implements the common interface; `AgentProviderRegistry.get('devin')` returns it; all existing adapter/manager tests pass.

**Verify:** `pnpm --filter @jheckbot/api exec vitest run tests/devin-adapter.test.ts tests/agent-manager.test.ts`

**Files touched:** `apps/api/src/agent/AgentAdapter.ts` (new), `apps/api/src/agent/AgentProviderRegistry.ts` (new), `apps/api/src/agent/DevinAdapter.ts`, `packages/shared/src/types/index.ts`.

### Task 2: Database and repository changes
- Migration: add `conversations.provider_config` JSONB.
- Migration: add `projects.default_provider_id` and `projects.default_provider_config` JSONB.
- Update `ConversationRepository`, `ProjectRepository`, types, and tests.

**Acceptance:** Repositories read/write provider columns; defaults are seeded; migration is reversible.

**Verify:** `pnpm --filter @jheckbot/api exec vitest run tests/conversation-repository.test.ts tests/project-repository.test.ts`; `pnpm --filter @jheckbot/api typecheck`

**Files touched:** `apps/api/migrations/006_provider_config.sql`, `apps/api/src/repositories/ConversationRepository.ts`, `apps/api/src/repositories/ProjectRepository.ts`, `packages/shared/src/types/index.ts`, repository tests.

### Task 3: Provider API endpoints
- Add `ProviderController` and `GET /api/providers`, `GET /api/providers/:id/models`.
- Update `ConversationController.create` and `ConversationService.create` to accept `provider_id` and `provider_config`.
- Update `ProjectController.update` and `ProjectService.update` to accept `default_provider_id` and `default_provider_config`.
- Update `ConversationService.get` to return provider fields.

**Acceptance:** Built-in providers are listed; models are provider-specific; conversation/project create/update accept provider fields; invalid provider is rejected.

**Verify:** `pnpm --filter @jheckbot/api exec vitest run tests/conversation-controller.test.ts tests/conversation-service.test.ts`; `pnpm --filter @jheckbot/api typecheck`

**Files touched:** `apps/api/src/controllers/ProviderController.ts` (new), `apps/api/src/routes/provider.routes.ts` (new), `apps/api/src/routes/conversation.routes.ts`, `apps/api/src/routes/project.routes.ts`, `apps/api/src/services/ConversationService.ts`, `apps/api/src/services/ProjectService.ts`, `apps/api/src/controllers/ConversationController.ts`, `apps/api/src/controllers/ProjectController.ts`, `apps/api/src/app.ts`.

### Task 4: Agent runner provider routing
- Update `AgentManager` to accept/resolve a provider and call the correct adapter.
- Update `PromptExecutionService` to pass `provider_id`/`provider_config` (read from conversation) into `AgentManager.prepareRun`.
- Update `PrepareRunOptions` and `StartAgentOptions` to include provider.
- Preserve Devin resume behavior and default to Devin for legacy records.

**Acceptance:** `AgentManager` uses the conversation's provider; a Devin conversation still works exactly as before.

**Verify:** `pnpm --filter @jheckbot/api exec vitest run tests/prompt-execution.test.ts tests/agent-manager.test.ts`; `pnpm --filter @jheckbot/api typecheck`

**Files touched:** `apps/api/src/agent/AgentManager.ts`, `apps/api/src/services/PromptExecutionService.ts`, `packages/shared/src/constants/index.ts`, `packages/shared/src/types/index.ts`.

### Task 5: Health and diagnostics
- Update `GET /health` to report per-provider availability.
- Update `ProjectHealthService` to check the project's default provider and active conversation provider.
- Update project health UI fields.

**Acceptance:** Health endpoint shows each provider's availability; project health reflects default provider.

**Verify:** `pnpm --filter @jheckbot/api exec vitest run tests/project-health.test.ts tests/health.test.ts`

**Files touched:** `apps/api/src/app.ts`, `apps/api/src/services/ProjectHealthService.ts`, `apps/web/app/pages/projects/[id].vue`.

### Task 6: Frontend provider selector
- Add `ProviderSelector` component (chat composer + project default).
- Update `useConversations` to create conversation with provider and read provider from conversation.
- Update `useProjects` to update default provider.
- Fetch models from `/api/providers/:id/models`.
- Disable skills button when provider has no skills.

**Acceptance:** User can select provider before first message; project default is inherited; model list updates per provider; skills button is disabled for non-skill providers.

**Verify:** `pnpm --filter @jheckbot/web exec vitest run tests/conversation-chat.test.ts`; `pnpm --filter @jheckbot/web typecheck`

**Files touched:** `apps/web/app/components/ProviderSelector.vue` (new), `apps/web/app/composables/useConversations.ts`, `apps/web/app/composables/useProjects.ts`, `apps/web/app/pages/conversations/[id].vue`, `apps/web/app/pages/projects/[id].vue`.

### Task 7: Claude Code adapter
- Implement `ClaudeCodeAdapter` implementing `AgentAdapter`.
- Use `claude -p` non-interactive mode, `--allow-dangerously-skip-permissions`, `--model`.
- Define supported models (Claude Sonnet/Opus family, free-text fallback).
- Tests for command construction and availability.

**Acceptance:** A conversation with `claude-code` provider builds the expected command; `isAvailable` reflects `which claude`; tests pass.

**Verify:** `pnpm --filter @jheckbot/api exec vitest run tests/claude-code-adapter.test.ts` (new)

**Files touched:** `apps/api/src/agent/providers/ClaudeCodeAdapter.ts` (new), `apps/api/src/agent/AgentProviderRegistry.ts`, tests.

### Task 8: Codex adapter
- Implement `CodexAdapter` implementing `AgentAdapter`.
- Use `codex exec` or equivalent non-interactive command with `--model`.
- Define supported models (GPT/Codex family).
- Tests.

**Acceptance:** A conversation with `codex` provider builds the expected command; `isAvailable` reflects `which codex`; tests pass.

**Verify:** `pnpm --filter @jheckbot/api exec vitest run tests/codex-adapter.test.ts` (new)

**Files touched:** `apps/api/src/agent/providers/CodexAdapter.ts` (new), `apps/api/src/agent/AgentProviderRegistry.ts`, tests.

### Task 9: Gemini CLI adapter
- Implement `GeminiCliAdapter` implementing `AgentAdapter`.
- Use `gemini -p <prompt> --approval-mode yolo --skip-trust [--model <m>]`.
- Define supported models (Gemini family).
- Tests.

**Acceptance:** A conversation with `gemini-cli` provider builds the expected command; `isAvailable` reflects `which gemini`; tests pass.

**Verify:** `pnpm --filter @jheckbot/api exec vitest run tests/gemini-cli-adapter.test.ts` (new)

**Files touched:** `apps/api/src/agent/providers/GeminiCliAdapter.ts` (new), `apps/api/src/agent/AgentProviderRegistry.ts`, tests.

### Task 10: Custom provider
- Add `CustomAdapter` that validates `provider_config.binary` and `provider_config.args`.
- Enforce absolute path or resolvable binary; reject shell metacharacters.
- Append args and prompt safely; use shell escaping if needed.
- UI form for "Other" provider with name, binary, args.

**Acceptance:** Custom binary runs when available; missing/invalid binary is rejected at conversation creation; no shell injection.

**Verify:** `pnpm --filter @jheckbot/api exec vitest run tests/custom-adapter.test.ts` (new); security-focused manual review.

**Files touched:** `apps/api/src/agent/providers/CustomAdapter.ts` (new), `apps/api/src/agent/AgentProviderRegistry.ts`, `apps/web/app/components/ProviderSelector.vue`, `apps/web/app/pages/projects/[id].vue`, tests.

### Task 11: Skills and models per provider
- Update `SkillsService` to be provider-aware (Devin only for v1; empty for others).
- Update `/api/skills` to accept optional `provider_id` query.
- Update frontend skills picker to pass conversation provider.
- Update `/api/models` to be a backward-compatible alias for `/api/providers/devin/models`.

**Acceptance:** Skills list is provider-specific; model list is per provider; legacy `/api/models` still works.

**Verify:** `pnpm --filter @jheckbot/api exec vitest run tests/skills-service.test.ts`; `pnpm --filter @jheckbot/web typecheck`

**Files touched:** `apps/api/src/services/SkillsService.ts`, `apps/api/src/app.ts`, `apps/web/app/components/SkillsPicker.vue`, `apps/web/app/composables/useConversations.ts`.

### Task 12: Full verification and QA
- Run `pnpm test`, `pnpm typecheck`, `pnpm build`, `pnpm lint`.
- Manual verification: create a conversation with each installed provider and confirm a simple prompt returns output.
- Verify Devin resume, SSE, and output normalization are unchanged.
- Write QA report.

**Acceptance:** All automated checks pass; manual verification confirms each installed provider; QA report is in `docs/superpowers/qa/`.

**Verify:** `pnpm test`; `pnpm typecheck`; `pnpm build`; `pnpm lint`; manual runtime QA.

**Files touched:** `docs/superpowers/qa/20260822_003000-agent-provider-qa.md` (new).

## Checkpoint: Foundation complete

After Tasks 1–4:

- [ ] `pnpm --filter @jheckbot/api test` passes
- [ ] `pnpm --filter @jheckbot/api typecheck` passes
- [ ] Devin-only conversation still works end-to-end in code/tests
- [ ] Provider can be persisted on conversation/project

## Checkpoint: UI and adapters complete

After Tasks 5–10:

- [ ] Each built-in adapter has unit tests
- [ ] Provider selector works in chat and project pages
- [ ] Health reflects per-provider availability

## Checkpoint: Complete

- [ ] `pnpm test`, `pnpm typecheck`, `pnpm build`, `pnpm lint` pass
- [ ] Manual QA confirms each installed provider
- [ ] QA report approved

## Risks and mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| CLI flags differ from installed versions | High | Keep command construction in per-adapter private methods with clear fixture tests; verify against `claude/codex/gemini --help` at build time. |
| Non-resumable providers break multi-turn context | High | Document as v1 limitation; adapter builds prompt with history when provider has no resume. |
| Output normalizer tuned for Devin produces noise for other tools | Medium | Make `normalizeOutput` optional per-adapter; default normalizer is ANSI/tmux-only. |
| Custom provider binary validation bypassed | High | Validate at API boundary, reject shell metacharacters, use absolute-or-`which` check, spawn with array args only. |
| Database migration conflicts with existing data | Low | Add nullable columns with defaults; backfill `agent_type = 'devin'`. |

## Open questions

- Should the `agent_type` column be formally renamed to `provider_id`? Migration cost vs clarity.
- Do Claude Code, Codex, or Gemini CLI support a headless resume equivalent? To be verified during adapter implementation.
- Should custom providers be stored in a separate `providers` table for reuse? Deferred to v2 unless requested.
