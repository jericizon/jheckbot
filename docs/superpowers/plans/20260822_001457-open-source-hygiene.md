# Open-Source Hygiene Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove personal and unsafe assumptions from JheckBot so a clean checkout can be configured and published safely while preserving the configured Devin workflow.

**Architecture:** Keep the current application and Devin lifecycle intact. Centralize validated runtime configuration, synchronize configured filesystem roots into the existing database table, enforce one project-path policy, and replace local documentation/defaults with portable public guidance. The provider-neutral runner is explicitly deferred to a separate follow-up plan.

**Tech Stack:** TypeScript, Node.js, Express, Nuxt, PostgreSQL, pnpm, Vitest, Docker Compose, tmux.

**Spec:** `docs/superpowers/specifications/20260822_001457-open-source-hygiene.md`

## Global Constraints

- Do not implement Codex CLI, Claude Code, or Gemini CLI adapters in this phase.
- Do not modify or read/write a real `.env` file.
- Do not delete existing database rows; roots removed from configuration are disabled only.
- Do not expose secrets, prompt contents, cookies, or private project data in logs, tests, documentation, or error responses.
- Do not use developer-specific absolute paths or credentials as defaults.
- Preserve existing Devin chat, SSE, stop, recovery, and persistence behavior when configuration is valid.
- Keep workspace packages private to prevent accidental package publication.
- Use parameterized SQL for all database changes.
- Each task must leave the repository typecheckable and its focused tests passing.

---

### Task 1: Make runtime configuration explicit, portable, and testable

**Files:**
- Create: `apps/api/src/config/env-validation.ts`
- Modify: `apps/api/src/config/env.ts`
- Modify: `apps/api/src/agent/DevinAdapter.ts`
- Modify: `apps/api/src/agent/TmuxManager.ts`
- Create: `apps/api/tests/setup.ts`
- Modify: `apps/api/vitest.config.ts`
- Create: `apps/api/tests/env-validation.test.ts`
- Modify: `apps/api/tests/devin-adapter.test.ts`
- Modify: `apps/api/tests/tmux-manager.test.ts`

**Interfaces:**
- `env-validation.ts` produces:
  ```ts
  export interface RuntimeEnv {
    nodeEnv: 'development' | 'test' | 'production'
    apiPort: number
    webPort: number
    databaseUrl: string
    sessionSecret: string
    devinBin: string
    tmuxBin: string
    allowedRoots: string[]
    cookieSecure: boolean
    cookieSameSite: 'lax' | 'strict' | 'none'
    corsOrigin: string
    trustProxy: number
    adminUsername: string
    adminPassword: string
  }
  export function loadEnv(source?: NodeJS.ProcessEnv): RuntimeEnv
  export function parseAllowedRoots(value: string): string[]
  ```
- `env.ts` exports `const env = loadEnv()` and `type Env = RuntimeEnv`.
- `DevinAdapter.isAvailable()` and `TmuxManager.isAvailable()` accept either an executable path or a command name resolvable through `PATH`.

- [ ] **Step 1: Write failing configuration tests**

  Add tests for `loadEnv()` that assert:
  - missing `DATABASE_URL`, `SESSION_SECRET`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `ALLOWED_ROOTS`, `DEVIN_BIN`, or `TMUX_BIN` throws an error naming the missing variable;
  - blank values and known placeholders such as `change-me-locally`, `dev-only-not-secret`, and `generate-and-store-locally` are rejected;
  - a session secret shorter than 32 characters is rejected;
  - an admin password shorter than 12 characters or equal to the username is rejected;
  - `ALLOWED_ROOTS` trims entries, removes empty entries, deduplicates them, and uses `path.delimiter`;
  - valid test configuration returns typed numeric ports/limits and booleans.

- [ ] **Step 2: Run the focused tests and verify they fail**

  Run:
  ```bash
  pnpm --filter @jheckbot/api test -- --run tests/env-validation.test.ts
  ```

  Expected result: FAIL because the validation module and test setup do not exist yet.

- [ ] **Step 3: Implement the validation boundary**

  Implement `loadEnv(source = process.env)` in `env-validation.ts` with these rules:
  ```ts
  const REQUIRED = [
    'DATABASE_URL',
    'SESSION_SECRET',
    'ADMIN_USERNAME',
    'ADMIN_PASSWORD',
    'ALLOWED_ROOTS',
    'DEVIN_BIN',
    'TMUX_BIN',
  ] as const
  ```
  Trim non-secret values, reject empty/known placeholder values, parse integers with finite positive checks, parse `COOKIE_SAME_SITE` from `lax|strict|none`, and return `allowedRoots` as a string array. Do not include secret values in thrown errors.

- [ ] **Step 4: Make the existing configuration module consume the boundary**

  Replace direct fallback logic in `env.ts` with `loadEnv()`. Add `webPort` and `corsOrigin` to the typed result. Update `apps/api/src/app.ts` to read `env.corsOrigin` instead of `process.env.CORS_ORIGIN`. Remove the unused `AGENT_MAX_RUNTIME_MS` and `AGENT_MAX_CONCURRENT_SESSIONS` environment entries from the public example rather than exposing settings that the current manager does not consume.

- [ ] **Step 5: Add isolated test configuration**

  Create `apps/api/tests/setup.ts` that sets non-production fixture values before test modules import the API configuration. Register it in `vitest.config.ts` with `setupFiles`. The fixture values must be clearly test-only and must not be copied into runtime defaults. Update auth tests that currently rely on `admin`/`admin` fallback to set and clean their own values.

- [ ] **Step 6: Support PATH-based executables**

  Add a small private executable lookup in each existing process adapter using `execFileSync('which', [command])` for command names and `existsSync`/execute permission checks for absolute paths. Preserve the current mocked test seams. `DEVIN_BIN=devin` and `TMUX_BIN=tmux` must work when those commands are on `PATH`.

- [ ] **Step 7: Run focused verification**

  Run:
  ```bash
  pnpm --filter @jheckbot/api test -- --run tests/env-validation.test.ts tests/devin-adapter.test.ts tests/tmux-manager.test.ts
  pnpm --filter @jheckbot/api typecheck
  ```

  Expected result: all focused tests pass and the API typecheck exits successfully.

---

### Task 2: Make configured allowed roots authoritative and project validation consistent

**Files:**
- Modify: `apps/api/migrations/001_initial.sql`
- Modify: `apps/api/src/repositories/ProjectRepository.ts`
- Modify: `apps/api/src/server.ts`
- Modify: `apps/api/src/services/PathValidator.ts`
- Modify: `apps/api/src/services/ProjectService.ts`
- Modify: `apps/api/src/services/PromptExecutionService.ts`
- Modify: `apps/api/src/agent/AgentManager.ts`
- Modify: `apps/api/src/services/ProjectHealthService.ts`
- Modify: `apps/api/tests/path-validator.test.ts`
- Modify: `apps/api/tests/project-service.test.ts`
- Modify: `apps/api/tests/prompt-execution.test.ts`
- Modify: `apps/api/tests/agent-manager.test.ts`

**Interfaces:**
- `ProjectRepository` produces:
  ```ts
  async syncAllowedRoots(paths: string[]): Promise<void>
  ```
- `PathValidator` produces one project-facing operation:
  ```ts
  resolveRelative(candidatePath: string): PathValidationResult
  ```
  It accepts shorthand (`/projects/app` or `projects/app`) and full paths, and every successful result has passed containment, existence, readability, and Git-marker checks.

- [ ] **Step 1: Extend path tests before changing behavior**

  Add tests that assert:
  - shorthand with and without a leading slash resolves under the configured root;
  - a full absolute path under the configured root resolves successfully;
  - a directory without `.git` is rejected for both shorthand and full-path input;
  - a Git worktree `.git` file is accepted;
  - missing paths, outside-root paths, symlink escapes, and unreadable paths remain rejected;
  - `resolveRelative('../../../etc')` cannot escape the root.

- [ ] **Step 2: Run focused path tests and verify the Git-policy failures**

  Run:
  ```bash
  pnpm --filter @jheckbot/api test -- --run tests/path-validator.test.ts tests/project-service.test.ts
  ```

  Expected result: existing tests that use non-Git fixture directories fail, demonstrating the behavior that must be made explicit. Update fixtures only after observing the failure.

- [ ] **Step 3: Implement a single project validation path**

  Keep `validate()` for generic containment checks used by existing callers, but make `resolveRelative()`:
  1. normalize shorthand by stripping leading separators;
  2. try each enabled root with `join(rootReal, relativePath)` and realpath containment checks;
  3. validate directory/readability and `.git` marker;
  4. fall back to the full absolute-path validator when shorthand resolution does not match;
  5. apply the same `.git` check to the absolute fallback.

  Return actionable errors without printing secrets or unrelated filesystem contents.

- [ ] **Step 4: Route project creation and agent launch through the project policy**

  Replace direct `validator.validate(project.path)` calls in `ProjectService.create()`, `PromptExecutionService.send()`, and the legacy `AgentManager.start()` path with `validator.resolveRelative(project.path)`. Update health validation to report the same root/Git policy while preserving its detailed health indicators.

- [ ] **Step 5: Remove the hard-coded migration seed**

  Delete only the personal `INSERT INTO allowed_roots` statement from `001_initial.sql`; retain the table definition and indexes. Do not add a migration that deletes existing rows.

- [ ] **Step 6: Implement idempotent root synchronization**

  Add `syncAllowedRoots(paths)` to `ProjectRepository` using `withTransaction` and parameterized SQL:
  - canonicalize/deduplicate the configured paths before persistence;
  - `INSERT ... ON CONFLICT (path) DO UPDATE` each configured root and enable it;
  - disable rows whose path is absent from the configured set;
  - never delete rows or cascade into projects.

  Derive a generic root name from the final path segment rather than storing a user-specific name.

- [ ] **Step 7: Run synchronization at startup before recovery**

  In `server.ts`, after `runMigrations()` and before `recoverSessions()`, call `new ProjectRepository().syncAllowedRoots(env.allowedRoots)`. If synchronization fails, log a generic configuration/database error and stop startup without starting the API listener.

- [ ] **Step 8: Update fixtures and run focused verification**

  Make all project fixtures create `.git` markers (directory or file) and use generic `/tmp` paths. Add repository synchronization tests with a mocked executor or pool that assert parameterized SQL and idempotent behavior. Run:
  ```bash
  pnpm --filter @jheckbot/api test -- --run tests/path-validator.test.ts tests/project-service.test.ts tests/prompt-execution.test.ts tests/agent-manager.test.ts
  pnpm --filter @jheckbot/api typecheck
  ```

---

### Task 3: Remove unsafe runtime and development defaults

**Files:**
- Modify: `.env.example`
- Modify: `docker-compose.yml`
- Modify: `apps/api/tests/auth-service.test.ts`
- Modify: `package.json`
- Modify: `scripts/kill-ports.mjs`
- Modify: `README.md`
- Modify: `deploy/README.md`

**Interfaces:**
- A clean checkout exposes an explicit `pnpm dev:clean` command for port cleanup; `pnpm dev` does not terminate existing processes automatically.
- `docker compose up -d postgres` exits with a clear Compose interpolation error when `POSTGRES_PASSWORD` is absent.

- [ ] **Step 1: Add regression tests for startup/auth assumptions**

  Update auth tests to assert that `ensureSeedUser()` only creates the configured username and bcrypt hash when valid explicit configuration exists. Add a test that the configuration loader rejects the old fallback values before `AuthService` can seed a user.

- [ ] **Step 2: Remove implicit port cleanup from the default dev script**

  Change the root scripts to remove `predev` and add:
  ```json
  "dev:clean": "node scripts/kill-ports.mjs"
  ```
  Keep `scripts/kill-ports.mjs` as an explicitly invoked developer utility and update its output to say it is terminating only the configured JheckBot development ports. Do not make it run automatically.

- [ ] **Step 3: Make Compose require the database password**

  Replace the PostgreSQL runtime fallback with Compose’s required-variable syntax:
  ```yaml
  POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?POSTGRES_PASSWORD must be set in .env}
  ```
  Keep non-secret database name/user/port defaults configurable. Ensure the healthcheck uses the same configured database values.

- [ ] **Step 4: Replace environment examples with safe instructions**

  Update `.env.example` so it contains no personal paths, no usable credentials, and no runtime fallback values. Use `devin` and `tmux` as documented PATH-based command examples, blank required secret/root values with comments explaining how to generate/configure them, and a generic root example such as `/workspace/projects`.

- [ ] **Step 5: Update setup guidance**

  Rewrite setup instructions to run:
  ```bash
  cp .env.example .env
  openssl rand -hex 32
  ```
  and require the generated secret, a strong admin password, an existing Git root, and authenticated Devin CLI before starting the API. Do not document `admin/admin` as a valid default.

- [ ] **Step 6: Run focused verification**

  Run:
  ```bash
  pnpm --filter @jheckbot/api test -- --run tests/auth-service.test.ts
  pnpm --filter @jheckbot/api typecheck
  ```
  Verify with a static check that `package.json` has no `predev` script and `docker-compose.yml` has no `change-me-locally` runtime fallback.

---

### Task 4: Sanitize public repository content and add open-source governance files

**Files:**
- Create: `LICENSE`
- Create: `CONTRIBUTING.md`
- Create: `SECURITY.md`
- Rewrite: `README.md`
- Rewrite: `docs/mvp.md`
- Rewrite: `deploy/README.md`
- Modify: `deploy/cloudflared/config.yml`
- Modify: `tasks/plan.md`
- Modify: `apps/api/tests/devin-adapter.test.ts`
- Modify: `apps/api/tests/agent-manager.test.ts`
- Modify: `packages/shared/src/constants/index.ts`
- Modify: `packages/shared/tests/smoke.test.ts`
- Sanitize: existing `docs/superpowers/specifications/`, `docs/superpowers/plans/`, and `docs/superpowers/qa/` records containing local machine facts

**Interfaces:**
- `LICENSE` grants the MIT terms to “JheckBot contributors” without adding a personal email or home path.
- Public documentation uses `<YOUR_DOMAIN>`, `/workspace/projects`, `devin`, and `tmux` examples only.

- [ ] **Step 1: Add the MIT license and governance documents**

  `LICENSE` must contain the standard MIT text with the copyright line `Copyright (c) 2026 JheckBot contributors`. `CONTRIBUTING.md` must document `pnpm install`, `pnpm typecheck`, `pnpm test`, focused tests, formatting, and the requirement to avoid committing `.env` or project data. `SECURITY.md` must direct vulnerability reports to a repository-maintainer contact mechanism without inventing a personal email address and must list secret rotation, private roots, HTTPS, and non-public API/database ports as deployment requirements.

- [ ] **Step 2: Rewrite public README and deployment docs**

  Preserve the existing architecture and quick-start intent, but describe JheckBot as a self-hosted local coding-agent UI rather than a personal Devin deployment. Explain that Devin is the current built-in provider and other providers are planned. Replace all personal paths, project names, local verification dates, private infrastructure facts, and credentials with generic values and explicit configuration instructions.

- [ ] **Step 3: Rewrite the long MVP document as a generic public architecture reference**

  Retain sections covering projects, conversations, messages, agent sessions, authentication, SSE, root isolation, PostgreSQL, and the host-side runner. Remove historical machine inventory, private project examples, home-directory diagrams, real session names, and internal incident history. Use a small generic example under `/workspace/projects/example-repo`.

- [ ] **Step 4: Sanitize deployment template and historical records**

  Replace the Cloudflare credentials path with a placeholder such as `/path/to/.cloudflared/<TUNNEL_UUID>.json`. Rewrite or remove local verification sections in existing superpowers records so no personal paths/project names remain. Keep technical decisions and test intent where useful.

- [ ] **Step 5: Remove personal fixtures and constants**

  Replace Devin test paths with `/tmp/jheckbot-test-project` or `/workspace/projects/example-repo`. Remove the personal `DEFAULT_ALLOWED_ROOT` constant and update `packages/shared/tests/smoke.test.ts` so it no longer asserts a hard-coded root; configured roots are the only source of truth.

- [ ] **Step 6: Run the repository privacy scan**

  Run content scans over tracked files for:
  ```text
  /home/
  personal project names
  BEGIN .* PRIVATE KEY
  password=, secret=, token=, api_key=
  change-me-locally
  admin/admin
  ```
  Review each match manually so dependency lockfile tokens and generic documentation words are not treated as secrets. No developer-specific path, credential, private project name, or tunnel identifier may remain in tracked source/docs/tests.

---

### Task 5: Full compatibility verification and hygiene QA

**Files:**
- Create: `docs/superpowers/qa/20260822_001457-open-source-hygiene.md`
- Modify: focused tests discovered by prior tasks only when a failing regression requires it

**Interfaces:**
- QA report records exact commands, pass/fail results, configuration behavior, and known limitations without including secrets, cookies, prompts, or private project contents.

- [ ] **Step 1: Run all package checks**

  Run:
  ```bash
  pnpm typecheck
  pnpm test
  pnpm build
  pnpm lint
  ```
  Record the exact result of each command. If a command fails because the repository has a pre-existing limitation, isolate and document it rather than weakening the check.

- [ ] **Step 2: Validate safe configuration behavior**

  In a process environment with required values removed, confirm the API exits before listening and reports only the missing variable name. With placeholder secrets, confirm startup rejects configuration. With valid test values, confirm the configuration module loads.

- [ ] **Step 3: Validate root synchronization and project policy**

  Using disposable Git and non-Git fixture directories under a temporary configured root, verify:
  - configured roots are enabled after startup synchronization;
  - removed roots become disabled and no project rows are deleted;
  - shorthand and full project paths resolve only to Git repositories inside configured roots;
  - symlink escapes and non-existent paths are rejected.

- [ ] **Step 4: Validate existing Devin behavior**

  With a valid configured Devin binary and tmux, exercise the existing prompt flow through the running application: submit a prompt, observe SSE status/output/log events, verify final assistant persistence, stop a run, and verify a subsequent prompt is accepted. Do not include prompt contents or project contents in the QA report.

- [ ] **Step 5: Complete the QA report and review the diff**

  Record acceptance criteria results in `docs/superpowers/qa/20260822_001457-open-source-hygiene.md`. Review `git diff --stat`, `git diff -- .env.example docker-compose.yml apps/api/src/config apps/api/migrations/001_initial.sql`, and the privacy scan output. Confirm the uncommitted earlier UI/agent work remains intact and no real `.env` was modified.

- [ ] **Step 6: Handoff to Phase 2**

  After this plan passes, create a separate provider-core specification and plan for the `AgentProvider` registry and Devin adapter. Do not begin Codex, Claude Code, or Gemini CLI implementation until that contract is reviewed independently.

## Checkpoints

### Checkpoint after Task 2

- [ ] Configuration tests and path tests pass.
- [ ] Typecheck passes.
- [ ] Root synchronization is idempotent and non-destructive.
- [ ] Existing prompt-execution tests pass.

### Checkpoint after Task 4

- [ ] No personal paths/private project names/credentials remain in tracked files.
- [ ] README, deployment guidance, license, contribution, and security documents are public-repo ready.
- [ ] Docker and development scripts no longer contain unsafe runtime defaults.

### Final checkpoint

- [ ] Full tests, typecheck, build, lint, and focused QA pass.
- [ ] Existing Devin workflow remains compatible when configured.
- [ ] QA report is complete.
- [ ] Phase 2 provider-core work is explicitly separated from this change.
