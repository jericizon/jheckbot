# Open-Source Hygiene Specification

## Status

Draft for review.

## Goal

Make JheckBot safe and portable to publish as an open-source repository without changing the existing Devin chat experience. The repository must not assume the original developer's filesystem, credentials, deployment host, or private projects.

## Scope

This specification covers the first phase only: repository hygiene, portable configuration, safe first-start behavior, and documentation cleanup. The provider-neutral agent abstraction is a separate follow-up phase; Devin remains the only execution provider during this phase.

## User decisions

- License: MIT.
- License attribution: JheckBot contributors.
- Delivery order: hygiene first, then provider abstraction with Devin as the first adapter.
- Initial provider scope: Devin only; Codex CLI, Claude Code, and Gemini CLI are future adapters.
- Missing configuration: fail clearly rather than silently using insecure defaults.
- Documentation: rewrite local MVP/deployment documentation generically while preserving useful architecture and setup guidance.

## Current blockers

1. `apps/api/src/config/env.ts` contains personal path fallbacks and insecure development fallbacks for the database and session secret.
2. `.env.example` contains personal paths and a predictable database password placeholder that is also used as a Docker Compose runtime default.
3. `apps/api/migrations/001_initial.sql` seeds a personal allowed-root path.
4. `ALLOWED_ROOTS` is read into configuration but is not provisioned into the `allowed_roots` table, so the database seed is the effective source of truth.
5. The initial admin seed uses `admin`/`admin` when credentials are absent.
6. Tests and historical documentation contain personal filesystem paths and private project names.
7. There is no repository license, contribution guide, or security policy.
8. The development pre-script terminates any process on the reserved ports without an explicit opt-in.

## Requirements

### Configuration and startup

- `DATABASE_URL`, `SESSION_SECRET`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `ALLOWED_ROOTS`, `DEVIN_BIN`, and `TMUX_BIN` must be explicitly configured for normal startup.
- Empty values and known placeholder values must be rejected with actionable error messages.
- `SESSION_SECRET` must meet a documented minimum length and must not use a development placeholder.
- `ADMIN_PASSWORD` must meet a documented minimum length and must not equal the username.
- `DEVIN_BIN` and `TMUX_BIN` may be command names resolved through `PATH` or absolute executable paths; no developer-specific absolute path may be a default.
- Existing local development may continue to use `.env`, but a clean checkout must fail safely until the user creates and configures it.
- Tests must provide isolated, non-production configuration through test setup rather than relying on a developer's untracked `.env`.

### Allowed roots and project validation

- `ALLOWED_ROOTS` is a portable, path-delimited list using the host platform's path delimiter.
- On startup, configured roots are synchronized into `allowed_roots`:
  - configured roots are inserted or enabled;
  - roots no longer configured are disabled, not deleted;
  - no project, conversation, message, or event data is deleted.
- Fresh installs must not receive a hard-coded filesystem root from SQL migrations.
- Project creation must validate both relative-to-root inputs and full absolute paths.
- A valid project path must resolve to a readable directory under an enabled configured root and contain a `.git` marker (directory or worktree `.git` file).
- Symlink traversal outside an enabled root remains rejected.

### Repository hygiene

- Add an MIT `LICENSE` attributed to JheckBot contributors.
- Add `CONTRIBUTING.md` with setup, test, typecheck, formatting, and pull-request guidance.
- Add `SECURITY.md` with supported-version expectations, secret-reporting guidance, and deployment hardening requirements.
- Rewrite public README and deployment/MVP documentation using generic paths such as `/workspace/projects` and placeholders such as `<YOUR_DOMAIN>`.
- Remove personal usernames, absolute home directories, private project names, local machine verification facts, and real deployment identifiers from tracked files.
- Keep `.env` ignored and ensure examples contain instructions/placeholders only.
- Keep workspace packages private to prevent accidental package publication unless a future release explicitly changes that decision.

### Development ergonomics

- Do not kill arbitrary processes automatically as part of the default `pnpm dev` path.
- Provide an explicit cleanup command or documented opt-in for freeing development ports.
- Preserve existing ports as documented defaults, but make them configurable.

### Compatibility and non-goals

- Do not implement Codex, Claude Code, or Gemini CLI adapters in this phase.
- Do not change the SSE protocol, message persistence model, or existing Devin prompt/output behavior except where required by configuration validation.
- Do not delete existing database rows during startup synchronization.
- Do not commit or modify any real `.env` file.
- Do not expose secrets or prompt contents in logs or documentation.

## Design

### Configuration boundary

`apps/api/src/config/env.ts` becomes the single validated configuration boundary. It parses path-delimited roots and exposes immutable typed values. Startup code consumes this configuration before constructing services. Validation errors identify the variable and the required correction without echoing secret values.

### Root synchronization

The project repository gains an idempotent synchronization operation for configured roots. The server invokes it after migrations and before session recovery. Synchronization uses parameterized SQL and disables, rather than deletes, roots absent from the current configuration. Migration `001_initial.sql` remains the table definition but no longer contains a user-specific seed row.

### Project path policy

`PathValidator` retains the existing realpath and containment checks and exposes one project-oriented validation path that handles both shorthand and absolute input. The project service uses this path so every newly created project receives the same existence, readability, root-containment, and Git checks.

### Provider boundary preparation

This phase does not introduce the provider abstraction. It removes personal Devin assumptions while keeping the current adapter working, so the later abstraction can use a generic configured provider command without carrying local paths into its interface.

## Acceptance criteria

- A fresh checkout contains no personal filesystem paths or private project names in tracked source, tests, examples, or public docs.
- `pnpm` commands and tests work without a developer-specific `.env`.
- API startup rejects missing/unsafe required configuration and does not seed `admin`/`admin` implicitly.
- Docker Compose refuses to start PostgreSQL without an explicit password.
- Configured allowed roots are synchronized idempotently, and removed roots are disabled without deleting user data.
- Relative and absolute project paths both require an existing readable Git repository under an enabled allowed root.
- Existing Devin chat, SSE streaming, stop/recovery, and project workflows remain behaviorally compatible when configured.
- API tests, web tests/typecheck, package build, and a focused open-source hygiene QA pass succeed.
