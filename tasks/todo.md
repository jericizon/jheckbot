# Multi-Provider Agent Support

- [ ] Task 1: Provider interface and Devin adapter refactor
  - Acceptance: `DevinAdapter` implements the common `AgentAdapter` interface; registry resolves `'devin'`; existing tests pass.
  - Verify: `pnpm --filter @jheckbot/api exec vitest run tests/devin-adapter.test.ts tests/agent-manager.test.ts`
  - Files: `apps/api/src/agent/AgentAdapter.ts`, `AgentProviderRegistry.ts`, `DevinAdapter.ts`, `packages/shared/src/types/index.ts`

- [ ] Task 2: Database and repository changes
  - Acceptance: `provider_config` on conversations; `default_provider_id`/`default_provider_config` on projects; repositories updated.
  - Verify: repository tests + API typecheck
  - Files: `apps/api/migrations/006_provider_config.sql`, `ConversationRepository.ts`, `ProjectRepository.ts`, types

- [ ] Task 3: Provider API endpoints
  - Acceptance: `GET /api/providers` and `/api/providers/:id/models`; conversation/project create/update accept provider fields; invalid provider rejected.
  - Verify: `pnpm --filter @jheckbot/api exec vitest run tests/conversation-controller.test.ts tests/conversation-service.test.ts`
  - Files: `ProviderController.ts`, `provider.routes.ts`, route/service updates

- [ ] Task 4: Agent runner provider routing
  - Acceptance: `AgentManager` and `PromptExecutionService` use conversation provider; Devin resume unchanged.
  - Verify: `pnpm --filter @jheckbot/api exec vitest run tests/prompt-execution.test.ts tests/agent-manager.test.ts`
  - Files: `AgentManager.ts`, `PromptExecutionService.ts`, shared types/constants

- [ ] Task 5: Health and diagnostics
  - Acceptance: Health reports per-provider availability; project health reflects default provider.
  - Verify: `pnpm --filter @jheckbot/api exec vitest run tests/project-health.test.ts tests/health.test.ts`
  - Files: `app.ts`, `ProjectHealthService.ts`, `projects/[id].vue`

- [ ] Task 6: Frontend provider selector
  - Acceptance: Provider selector in chat composer and project page; models load per provider; skills disabled for non-skill providers.
  - Verify: web tests + typecheck
  - Files: `ProviderSelector.vue`, `useConversations.ts`, `useProjects.ts`, `conversations/[id].vue`, `projects/[id].vue`

- [ ] Task 7: Claude Code adapter
  - Acceptance: `claude-code` provider builds command and reports availability.
  - Verify: `pnpm --filter @jheckbot/api exec vitest run tests/claude-code-adapter.test.ts`
  - Files: `apps/api/src/agent/providers/ClaudeCodeAdapter.ts`, registry

- [ ] Task 8: Codex adapter
  - Acceptance: `codex` provider builds command and reports availability.
  - Verify: `pnpm --filter @jheckbot/api exec vitest run tests/codex-adapter.test.ts`
  - Files: `apps/api/src/agent/providers/CodexAdapter.ts`, registry

- [ ] Task 9: Gemini CLI adapter
  - Acceptance: `gemini-cli` provider builds command and reports availability.
  - Verify: `pnpm --filter @jheckbot/api exec vitest run tests/gemini-cli-adapter.test.ts`
  - Files: `apps/api/src/agent/providers/GeminiCliAdapter.ts`, registry

- [ ] Task 10: Custom provider
  - Acceptance: Custom binary validated and run safely; no shell injection.
  - Verify: `pnpm --filter @jheckbot/api exec vitest run tests/custom-adapter.test.ts`
  - Files: `apps/api/src/agent/providers/CustomAdapter.ts`, `ProviderSelector.vue`

- [ ] Task 11: Skills and models per provider
  - Acceptance: Provider-aware skills and models; legacy `/api/models` preserved.
  - Verify: `pnpm --filter @jheckbot/api exec vitest run tests/skills-service.test.ts`; web typecheck
  - Files: `SkillsService.ts`, `app.ts`, `SkillsPicker.vue`, `useConversations.ts`

- [ ] Task 12: Full verification and QA
  - Acceptance: `pnpm test`, `pnpm typecheck`, `pnpm build`, `pnpm lint` pass; manual QA for installed providers; QA report written.
  - Verify: full workspace commands + manual runtime QA
  - Files: `docs/superpowers/qa/20260822_003000-agent-provider-qa.md`

## Checkpoints

- [ ] After Task 4: Foundation complete — Devin behavior preserved, provider persistence works.
- [ ] After Task 10: All built-in and custom adapters implemented.
- [ ] After Task 12: Complete — all checks green, QA report approved.
