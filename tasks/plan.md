# Implementation Plan: JheckBot MVP — Phase 1 (Repository Scaffold)

## Overview

Create the pnpm monorepo scaffold with Nuxt 4 web app, Express API app, shared package, and Docker Compose PostgreSQL service. Phase 1 success is verifiable via `docker compose up -d postgres`, `pnpm install`, and `pnpm dev` producing Nuxt on `localhost:8800`, Express on `localhost:8801`, and PostgreSQL on `localhost:8802`.

## Architecture Decisions

- **pnpm workspaces** with a single root lockfile; no npm/yarn.
- **Hybrid topology**: Nuxt and Express run on the host; PostgreSQL runs in Docker (host `8802` → container `5432`).
- **TypeScript project references** for type safety across packages.
- **Vitest** as the test runner for both web and api packages.
- **Phase 1 scope is scaffold only**: no auth, no Devin, no database schema, no agent runner. Health endpoints and placeholder index pages are sufficient.
- **Port reservations**: `8800` web, `8801` API, `8802` PostgreSQL host mapping.

## Task List

### Task 1: Root monorepo configuration
- [ ] Root `package.json` with workspace scripts (dev, build, test, lint, typecheck, format)
- [ ] `pnpm-workspace.yaml` pointing to `apps/*` and `packages/*`
- [ ] `.gitignore` covering node_modules, dist, .env, .nuxt, .output, coverage
- [ ] `.env.example` with the documented env vars (placeholders only)
- [ ] Root `tsconfig.base.json` for shared TS config
- [ ] `README.md` with setup instructions

### Task 2: Docker Compose PostgreSQL service
- [ ] `docker-compose.yml` with a `postgres` service
- [ ] Host port `8802` mapped to container port `5432`
- [ ] Dedicated volume `jheckbot_pgdata`
- [ ] Dedicated database `jheckbot` and user `jheckbot`
- [ ] Healthcheck definition
- [ ] Validated via `docker compose config` (does not start the service)

### Task 3: Shared package
- [ ] `packages/shared/package.json` with name `@jheckbot/shared`
- [ ] `src/types/` with placeholder types (Project, Conversation, Message, AgentSession)
- [ ] `src/constants/` with port constants and allowed-roots placeholder
- [ ] `src/validation/` with placeholder validators
- [ ] `tsconfig.json` extending root
- [ ] Vitest config + a smoke test

### Task 4: Express API app
- [ ] `apps/api/package.json` with name `@jheckbot/api`
- [ ] `src/server.ts` (listens on `API_PORT` = `8801`)
- [ ] `src/app.ts` (Express app with `/health` returning JSON status)
- [ ] `src/config/env.ts` (loads and validates env vars)
- [ ] `tsconfig.json` extending root
- [ ] Vitest config + a health-endpoint supertest

### Task 5: Nuxt web app
- [ ] `apps/web/package.json` with name `@jheckbot/web`
- [ ] `nuxt.config.ts` with `devServer.port` = `8800`, Tailwind module
- [ ] `pages/index.vue` placeholder page
- [ ] `tsconfig.json` extending root
- [ ] Vitest config + a smoke test

### Task 6: Root scripts integration and verification
- [ ] Root `pnpm dev` runs both web and api concurrently
- [ ] `pnpm install` succeeds
- [ ] `pnpm build` succeeds
- [ ] `pnpm typecheck` succeeds
- [ ] `pnpm lint` succeeds (or is documented as deferred)
- [ ] `pnpm test` runs all package tests
- [ ] `docker compose config` validates the Compose file

## Checkpoint: Phase 1 Complete
- [ ] All tasks above pass their acceptance criteria
- [ ] `docker compose config` is valid
- [ ] `pnpm install`, `pnpm build`, `pnpm typecheck`, `pnpm test` all succeed
- [ ] User runs `docker compose up -d postgres` and `pnpm dev` to confirm runtime
- [ ] Review with human before proceeding to Phase 2

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Nuxt 4 latest API changes | Medium | Verify against current Nuxt docs before scaffolding |
| Port conflicts at runtime | Low | Ports 8800–8802 are reserved; recheck before startup |
| Disk space | Medium | Scaffold is lightweight; no heavy Docker images beyond postgres |
| `pnpm dev` cannot be run by agent | Low | Agent verifies via build/typecheck/test; user runs dev manually |

## Open Questions

- None for Phase 1. All decisions are documented in `docs/mvp.md`.
