# Implementation Plan: Office Domain Model (JheckBot Office — Task 01)

## Overview

Deliver the foundational domain model for JheckBot Office: shared types, constants, validation functions, and the core PostgreSQL schema. This plan implements the specification in `docs/superpowers/specifications/20260828_office-domain-model.md`.

## Architecture Decisions

- Domain model lives in `@jheckbot/shared` so both `apps/web` and `apps/api` can consume it without cross-imports.
- TypeScript interfaces use `Office*` prefix to avoid collision with existing `AgentSession`, `AgentAdapter`, and `AgentManager` provider types.
- Constants are plain `as const` arrays; validation functions are small, pure, and testable.
- Database migration is one file, uses `IF NOT EXISTS` for idempotency, and is additive only.
- Status transitions are encoded as a `Record<TaskStatus, TaskStatus[]>` map in shared validation; services will reuse it.

## Task List

### Task 1.1: Shared types
- Create `packages/shared/src/types/office.ts` with domain interfaces.
- Update `packages/shared/src/types/index.ts` to re-export.

### Task 1.2: Shared constants
- Create `packages/shared/src/constants/office.ts` with status/value arrays and `WorkflowType` values.
- Update `packages/shared/src/constants/index.ts` to re-export.

### Task 1.3: Shared validation
- Create `packages/shared/src/validation/office.ts` with `isValid*` helpers and `isValidTaskStatusTransition`.
- Update `packages/shared/src/validation/index.ts` to re-export.

### Task 1.4: Database migration
- Create `apps/api/migrations/009_office_domain.sql` with all core Office tables.

### Task 1.5: Unit tests
- Create `packages/shared/tests/office-domain.test.ts` covering constants and validation.

### Task 1.6: Verification
- Run `pnpm --filter @jheckbot/shared test`.
- Run `pnpm --filter @jheckbot/shared typecheck`.
- Run `pnpm --filter @jheckbot/api typecheck`.

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| `agents` table name collides semantically with provider `AgentAdapter` | Low | Prefix TypeScript types with `Office` and keep table name aligned with spec. |
| Over-engineered transition rules | Low | Keep transition map minimal; expand when Task backend is built. |
| Migration syntax errors | Low | Run migration file through `psql` or typecheck indirectly; validate with regex in tests if needed. |

## Verification

- [ ] `packages/shared` tests pass.
- [ ] `packages/shared` typecheck passes.
- [ ] `apps/api` typecheck passes.
- [ ] No existing tests regress.
