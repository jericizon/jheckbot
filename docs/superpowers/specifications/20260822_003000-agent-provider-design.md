# Specification: Multi-Provider Agent Support

## Status

Draft. Approved assumptions:

- tool selector in the chat composer plus project-level default;
- provider is chosen per conversation before the first run and then locked;
- "others" means a custom provider configured with a binary path and optional arguments;
- first-class adapters for Devin, Claude Code, Codex, and Gemini CLI.

## Objective

Let a JheckBot user choose which agent CLI runs a conversation: Devin, Claude Code, Codex, Gemini CLI, or a custom local binary. The choice is visible in the chat composer, can have a project-level default, is persisted per conversation, and is honored by the agent runner, health checks, and model/skills discovery.

## User and success definition

The user is an authenticated developer who already runs `pnpm dev` and has one or more of the supported CLIs installed.

Success:

1. A new conversation can be started with a provider selected from the chat composer.
2. A project can declare a default provider used for new conversations.
3. The selected provider is persisted on the conversation and cannot silently change mid-run.
4. Each supported provider can start a non-interactive run, stream output over SSE, and produce a persisted assistant transcript.
5. The health endpoint reports availability of the configured providers, not just Devin.
6. The models and skills endpoints are provider-aware and degrade gracefully when a provider has none.
7. A custom ("other") provider accepts a binary path and optional arguments and is validated server-side before use.
8. Existing Devin behavior is unchanged when Devin is selected.

## Approved architecture

```text
Browser
  ↓
Nuxt frontend
  ↓ GET /api/providers, /api/providers/:id/models
Express API
  ↓
AgentProviderRegistry
  ↓
AgentAdapter (common interface)
  ↓
DevinAdapter | ClaudeCodeAdapter | CodexAdapter | GeminiCliAdapter | CustomAdapter
  ↓
TmuxManager
  ↓
CLI process
```

`TmuxManager` remains the only module that knows tmux details. Each adapter remains the only module that knows the command-line shape of its tool. `AgentManager` and `PromptExecutionService` select an adapter by `provider_id` and pass it to `TmuxManager` via a command string.

## Provider adapter interface

Every adapter implements:

```typescript
interface AgentAdapter {
  readonly providerId: string
  isAvailable(): boolean
  start(opts: StartAgentOptions): AgentSessionInfo
  sendPrompt(sessionName: string, prompt: string): void
  stop(sessionName: string): void
  forceKill(sessionName: string): void
  captureOutput(sessionName: string, startLine?: number | '-'): string[]
  isRunning(sessionName: string): boolean
  getExitCode(sessionName: string): number | null
  listSessions(): TmuxSession[]
  supportedModels(): ModelOption[]
  hasSkills(): boolean
  listSkills?(): Promise<Skill[]> | Skill[]
  normalizeOutput?(lines: string[]): string[]
  resumeSessionId?(cwd: string, sinceMs?: number): string | undefined
}
```

Provider-specific behavior:

- `start` builds a non-interactive command and creates the tmux session.
- `sendPrompt` is optional at the API level; it is used only if a provider keeps a persistent interactive session. If a provider exits after one prompt, the caller starts a new session for the next turn.
- `normalizeOutput` is per-adapter. The default normalizer strips ANSI and tmux redraws; adapters may add provider-specific chrome removal.
- `resumeSessionId` is optional. Devin uses `devin list --format json`; providers without native resume start a fresh process each turn and rely on prompt context.
- `supportedModels` returns the static model list for this provider. The UI disables the model selector if the list is empty, or uses a free-text fallback where safe.
- `hasSkills` and `listSkills` let the skills picker show provider-specific tools. Devin keeps `devin skills list`; the other built-ins initially return empty.

## Prompt context for non-resumable providers

Some providers (Claude Code with `-p`, Codex `exec`, Gemini with `-p`) do not keep a long-lived session. To support multi-turn conversations with these tools, `PromptExecutionService` may build a composite prompt containing the conversation history plus the new user message. The exact format is adapter-specific and lives in the adapter. This is a v1 fallback; resumable providers continue to use native session state.

## Persistence model

Reuse the existing `conversations.agent_type` column as the conversation's `provider_id`.

Changes:

- `conversations`
  - keep `agent_type` (maps to provider id);
  - add `provider_config` JSONB, nullable, for custom binary/args or provider-specific overrides.
- `projects`
  - add `default_provider_id` TEXT, nullable, default `'devin'`;
  - add `default_provider_config` JSONB, nullable.
- `messages`
  - keep `model` column, but its meaning is provider-specific (e.g. Claude model id, Gemini model id, Devin model id).

No new `providers` table for v1. Built-in provider ids are a closed set enforced by the registry. Custom providers are stored inline on the project or conversation record.

Valid `provider_id` values:

- `devin`
- `claude-code`
- `codex`
- `gemini-cli`
- `custom` (requires `provider_config.binary`)

For `custom`, `provider_config` shape:

```json
{
  "binary": "/absolute/path/or/command",
  "args": ["--flag", "value"],
  "name": "My Tool"
}
```

`args` are appended before the prompt. The prompt itself is always the final positional argument or passed with the provider's native prompt flag.

## API contract

### Providers

`GET /api/providers`

Returns the configured built-in providers plus any custom provider configured for the active user or project. Each provider includes:

```json
{
  "id": "claude-code",
  "name": "Claude Code",
  "available": true,
  "supportsResume": false,
  "supportsSkills": false,
  "requiresConfig": false
}
```

Custom providers include `config` only when the caller has permission to read them.

`GET /api/providers/:id/models`

Returns provider-specific models:

```json
{
  "models": [...],
  "default": "..."
}
```

For Devin, this is the existing `DEVIN_MODELS` list. For other providers, it is the adapter's `supportedModels()`. Custom providers accept a free-text model or return an empty list.

### Conversations

`POST /api/projects/:projectId/conversations`

Request body now accepts:

```json
{
  "title": "...",
  "provider_id": "claude-code",
  "provider_config": { ... }
}
```

If omitted, `provider_id` is the project's `default_provider_id` and `provider_config` is the project's `default_provider_config`.

`GET /api/conversations/:id` returns the persisted `provider_id` and `provider_config`.

`POST /api/conversations/:id/messages`

Request body accepts:

```json
{
  "content": "...",
  "model": "...",
  "bypass": false
}
```

The provider is read from the conversation row, not from the request, so a conversation cannot switch provider after the first run.

### Projects

`GET /api/projects/:id` returns `default_provider_id` and `default_provider_config`.

`PATCH /api/projects/:id` accepts `default_provider_id` and `default_provider_config`.

### Health

`GET /health` returns per-provider availability:

```json
{
  "status": "ok",
  "services": {
    "database": "connected",
    "tmux": "available",
    "providers": {
      "devin": "available",
      "claude-code": "available",
      "codex": "missing",
      "gemini-cli": "available"
    }
  }
}
```

The project health endpoint (`GET /api/projects/:id/health`) reports availability of the project's default provider and, if a conversation is active, the conversation's provider.

## Frontend behavior

- Chat composer: add a provider selector between the model selector and the skills button. It is disabled while a run is active. Changing it before the first message sets the conversation provider. It is hidden or disabled after the first run starts.
- Project page: add a "Default provider" section in the edit form. Pick a built-in provider or "Other" with binary/args/name inputs.
- Settings page: add a read-only list of available providers with availability status.
- Conversation page: load the conversation's `provider_id`/`provider_config` and populate the selector. Fetch models from `/api/providers/:id/models` instead of `/api/models` (which remains Devin-only for backward compatibility, or becomes a redirect to `/api/providers/devin/models`).
- Skills picker: only enabled for providers with `supportsSkills: true`.

## Security and operational boundaries

Always:

- validate `provider_id` against the registry at the API boundary;
- reject `custom` without a validated `binary` path that is either an absolute path or a name resolvable via `which`;
- never shell-interpret `provider_config.args`; pass them to `spawn` as an array or shell-escape them;
- respect `ALLOWED_ROOTS` and path validation regardless of provider;
- keep the existing authentication, rate limiting, and ownership checks;
- do not expose internal command construction or stack traces in API errors;
- persist provider config only for the owning project/conversation.

Never:

- allow a chat message to select or change the provider;
- run a custom binary without checking it resolves and is executable;
- pass user input (prompt) through shell interpolation when building the CLI command.

## Adapter command shapes (v1)

These are implementation details, not API contracts, and may be tuned during implementation:

- **Devin:** existing `devin --model <m> [--resume <id>] --print --respect-workspace-trust false --permission-mode dangerous -- <prompt>`.
- **Claude Code:** `claude -p --allow-dangerously-skip-permissions [--model <m>] -- <prompt>` (exact flags to be verified against the installed version).
- **Codex:** `codex exec [--model <m>] -- <prompt>` or the CLI's non-interactive command.
- **Gemini CLI:** `gemini -p <prompt> --approval-mode yolo --skip-trust [--model <m>]`.
- **Custom:** `<binary> [...args] -- <prompt>`; providers that do not support `--` use a provider-specific flag.

For non-resumable providers, each new user turn starts a new process. The adapter's `start` may combine the conversation history and new prompt when the provider cannot natively resume.

## Testing strategy

### Unit tests

- Provider registry resolves built-in and custom providers.
- Each adapter builds the expected command string for a given prompt/model/config.
- Adapter `isAvailable` returns false for missing binaries.
- Custom provider validation rejects missing binary, relative paths outside allowed roots, and shell metacharacters.
- `PromptExecutionService` reads provider from conversation, not request.
- `AgentManager` selects the correct adapter for `prepareRun`, `stop`, `sendPrompt`, and recovery.

### API/integration tests

- `GET /api/providers` lists built-ins and reflects availability.
- `GET /api/providers/:id/models` returns provider-specific models.
- `POST /api/projects/:id/conversations` inherits project default and accepts override.
- `POST /api/conversations/:id/messages` uses the conversation's provider.
- `PATCH /api/projects/:id` updates default provider.
- Health reports per-provider availability.

### Frontend tests

- Provider selector renders with built-in and custom options.
- Project default form validates custom binary.
- Conversation creation sends `provider_id` and `provider_config`.
- Model selector updates when provider changes.
- Skills picker is disabled for providers without skills.

### Real-user QA

- Start a conversation with each available provider and verify a simple prompt returns output.
- Verify Devin resume still works after the refactor.
- Verify project default is inherited by new conversations.
- Verify custom provider with a known script runs and returns output.
- Verify health reflects installed/missing CLIs.

## Verification commands

```bash
pnpm --filter @jheckbot/api test
pnpm --filter @jheckbot/web test
pnpm --filter @jheckbot/api typecheck
pnpm --filter @jheckbot/web typecheck
pnpm test
pnpm typecheck
pnpm build
pnpm lint
```

The application server is user-managed and must not be started by the agent.

## Success criteria

- All existing tests pass after the Devin-only refactor.
- New provider-specific tests pass.
- API and web typechecks pass.
- Build and lint pass.
- A conversation can be created with each built-in provider and produce a transcript.
- Project default provider is inherited.
- Custom provider accepts binary/args and runs.
- Health reports per-provider availability.
- No regression in Devin resume, SSE, or output normalization.

## Open limitations to surface during implementation

- Claude Code, Codex, and Gemini CLI may not have a session-resume mechanism equivalent to Devin. Multi-turn behavior for these providers may start a new process per turn and rely on prompt context.
- Output normalization is currently tuned for Devin TUI output. Other providers may require adapter-specific normalizer patterns before output is clean.
- Skills are Devin-specific in v1. Other built-in providers return empty skill lists.
- The exact non-interactive flags for Claude Code, Codex, and Gemini CLI may change between CLI versions; the adapter implementations must be easy to adjust.
