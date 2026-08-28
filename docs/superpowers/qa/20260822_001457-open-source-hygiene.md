# QA Report: Open-Source Hygiene

## Summary

Phase 1 open-source hygiene refactor completed. All personal paths, private project names, and unsafe defaults removed from tracked files. Configuration is now explicit and validated. Allowed roots are synchronized from configuration. Governance files added.

## Verification Commands and Results

### Typecheck

```
pnpm typecheck
→ packages/shared: Done
→ apps/api: Done
→ apps/web: Done
→ Exit code: 0
```

### Tests

```
pnpm test
→ apps/api: 20 test files, 241 tests passed
→ apps/web: 2 test files, tests passed
→ packages/shared: 1 test file, 8 tests passed
→ Exit code: 0
```

### Build

```
pnpm build
→ packages/shared: Done
→ apps/api: Done
→ apps/web: Build complete (2.1 MB, 527 kB gzip)
→ Exit code: 0
```

### Privacy Scan

| Scan | Result |
|------|--------|
| `/home/jeric` in tracked files | 0 matches |
| Private project names (lunchonline, adzeela, expresswayph, baon-box) | 0 matches |
| Unsafe credentials (change-me-locally, admin/admin, dev-only-not-secret) | 0 matches in source/config (only in plan docs as rejection criteria) |
| `.superpowers/sdd/` artifacts | Untracked and gitignored |

### Configuration Validation

| Check | Result |
|-------|--------|
| `predev` in package.json | 0 (removed) |
| `dev:clean` in package.json | 1 (added) |
| `change-me-locally` in docker-compose.yml | 0 (replaced with required-variable syntax) |
| `/home/jeric` in .env.example | 0 (generic paths only) |
| `DEFAULT_ALLOWED_ROOT` constant | Removed |
| Migration 001 personal seed | Removed |
| LICENSE exists | Yes (MIT, JheckBot contributors) |
| CONTRIBUTING.md exists | Yes |
| SECURITY.md exists | Yes |

## Changes by Task

### Task 1: Explicit portable configuration

- New: `apps/api/src/config/env-validation.ts` — `loadEnv()` with full validation
- New: `apps/api/tests/setup.ts` — test fixture env values
- New: `apps/api/tests/env-validation.test.ts` — 48 tests
- Modified: `apps/api/src/config/env.ts` — consumes `loadEnv()`
- Modified: `apps/api/src/app.ts` — uses `env.corsOrigin`
- Modified: `apps/api/src/agent/DevinAdapter.ts` — PATH-based `isAvailable()`
- Modified: `apps/api/src/agent/TmuxManager.ts` — PATH-based `isAvailable()`
- Modified: `apps/api/vitest.config.ts` — added setupFiles
- Modified: `apps/api/tests/devin-adapter.test.ts` — generic paths
- Modified: `apps/api/tests/auth-service.test.ts` — valid test credentials

### Task 2: Root sync + path policy

- Modified: `apps/api/migrations/001_initial.sql` — removed personal seed
- Modified: `apps/api/src/repositories/ProjectRepository.ts` — added `syncAllowedRoots()`
- Modified: `apps/api/src/server.ts` — calls sync at startup
- Modified: `apps/api/src/services/PathValidator.ts` — .git check on absolute fallback
- Modified: `apps/api/src/services/PromptExecutionService.ts` — uses `resolveRelative()`
- Modified: `apps/api/src/agent/AgentManager.ts` — uses `resolveRelative()`
- New: `apps/api/tests/root-sync.test.ts` — 6 tests
- Modified: path/project/prompt/agent-manager tests — .git fixtures

### Task 3: Remove unsafe defaults

- Modified: `package.json` — removed `predev`, added `dev:clean`
- Modified: `scripts/kill-ports.mjs` — opt-in messaging
- Modified: `docker-compose.yml` — required password
- Modified: `.env.example` — safe placeholders, no personal paths
- Modified: `deploy/README.md` — removed admin/admin documentation

### Task 4: Sanitize content + governance

- New: `LICENSE` — MIT, JheckBot contributors
- New: `CONTRIBUTING.md`
- New: `SECURITY.md`
- Rewritten: `README.md` — generic architecture
- Rewritten: `deploy/README.md` — generic deployment
- Rewritten: `docs/mvp.md` — 2280→330 lines, generic
- Modified: `deploy/cloudflared/config.yml` — placeholder paths
- Modified: `packages/shared/src/constants/index.ts` — removed `DEFAULT_ALLOWED_ROOT`
- Modified: `packages/shared/tests/smoke.test.ts` — removed constant test
- Modified: `apps/api/src/services/PathValidator.ts` — generic comments
- Modified: `apps/api/tests/slugify.test.ts` — generic project name
- Modified: `apps/web/app/pages/projects/index.vue` — generic placeholder
- Sanitized: historical superpowers docs, tasks/plan.md
- Modified: `.gitignore` — added `.superpowers/sdd/`
- Removed from tracking: `.superpowers/sdd/20260821_115932-transactional-chat/task-3-report.md`

## Acceptance Criteria

- [x] Fresh checkout contains no personal filesystem paths or private project names in tracked source, tests, examples, or public docs
- [x] `pnpm` commands and tests work without a developer-specific `.env`
- [x] API startup rejects missing/unsafe required configuration and does not seed `admin`/`admin` implicitly
- [x] Docker Compose refuses to start PostgreSQL without an explicit password
- [x] Configured allowed roots are synchronized idempotently, and removed roots are disabled without deleting user data
- [x] Relative and absolute project paths both require an existing readable Git repository under an enabled allowed root
- [x] Existing Devin chat, SSE streaming, stop/recovery, and project workflows remain behaviorally compatible when configured
- [x] API tests, web tests/typecheck, package build, and a focused open-source hygiene QA pass succeed

## Code Review Findings (Resolved)

1. **DevinAdapter constructor fallback** — Removed `process.env.TMUX_BIN` fallback and one-argument overload; constructor now requires explicit `TmuxManager` injection. Updated all test callers.
2. **Personal username in test** — Replaced `jeric` with `test-admin` in `auth-service.test.ts` custom credentials test.
3. **No dead code found** — All imports used, all exports consumed. `AGENT_LIMITS` in shared constants is unused by app code but retained as a public constant for future use.

## Known Limitations

- Build artifacts (`.nuxt/`, `.output/`, `dist/`) may contain stale paths from previous builds but are gitignored and regenerate clean
- The `docs/superpowers/plans/20260822_001457-open-source-hygiene.md` plan document references `change-me-locally` and `admin/admin` as rejection criteria — these are documentation of what to reject, not actual defaults
- Phase 2 (provider-neutral agent abstraction) is not yet started; Devin remains the only provider

## Risks

- Existing deployments using the old `.env` defaults will fail on upgrade — this is intentional and documented
- The `syncAllowedRoots` startup step adds a database dependency before session recovery; if it fails, the API exits cleanly without starting the listener
