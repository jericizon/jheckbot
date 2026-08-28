# Specification: Office Domain Model (JheckBot Office — Task 01)

## Objective

Establish the shared domain model and database schema for the JheckBot Office virtual-agent orchestration system. This is the foundational slice for the Office Alpha implementation defined in [`docs/jheckbot-office-spec-and-plan.md`](../../jheckbot-office-spec-and-plan.md).

## Scope

This task is **purely the domain model**:

- TypeScript types, constants, and validation functions in `@jheckbot/shared`.
- A single incremental PostgreSQL migration that creates the core Office tables.
- Unit tests for the validation functions.

It explicitly does **not** include:

- REST API endpoints
- Repositories or services
- UI components
- Orchestration logic

## Domain Entities

| Entity | Responsibility |
|--------|----------------|
| `Office` | A virtual office that owns a project, CEO, employees, tasks, and events. |
| `OfficeAgent` | An employee/agent with profile, role, provider, model, status, and capabilities. |
| `OfficeAgentCapability` | A capability/skill tag attached to an agent. |
| `OfficeAgentMemory` | Scoped memory for an agent (`global`, `project`, `agent`, `task`). |
| `OfficeTask` | A unit of work with status, priority, assignment, and acceptance criteria. |
| `OfficeTaskDependency` | A dependency edge between two tasks. |
| `OfficeAgentMessage` | An agent-to-agent communication message within an office. |
| `OfficeWorkflowRun` | A workflow instance rooted on a top-level task. |
| `OfficeWorkflowStep` | One step within a workflow run. |

## Status & Value Enumerations

- **Agent visual status:** `idle`, `thinking`, `working`, `communicating`, `reviewing`, `testing`, `blocked`, `error`, `completed`.
- **Task status:** `backlog`, `planning`, `ready`, `assigned`, `working`, `blocked`, `review`, `qa`, `testing`, `completed`, `failed`, `cancelled`.
- **Task priority:** `low`, `medium`, `high`, `critical`.
- **Message type:** `TASK_ASSIGNED`, `TASK_STARTED`, `QUESTION`, `ANSWER`, `PROGRESS`, `HANDOFF`, `REVIEW_REQUESTED`, `REVIEW_RESULT`, `QA_REQUESTED`, `QA_RESULT`, `BLOCKED`, `ESCALATION`, `TASK_COMPLETED`, `TASK_FAILED`.
- **Event type:** `OFFICE_CREATED`, `CEO_THINKING`, `CEO_PLANNING`, `CEO_DELEGATING`, `CEO_WAITING`, `TASK_CREATED`, `TASK_ASSIGNED`, `TASK_STARTED`, `TASK_BLOCKED`, `TASK_COMPLETED`, `TASK_FAILED`, `AGENT_STARTED`, `AGENT_PROGRESS`, `AGENT_MESSAGE`, `AGENT_COMPLETED`, `AGENT_FAILED`, `REVIEW_STARTED`, `REVIEW_APPROVED`, `REVIEW_REJECTED`, `QA_STARTED`, `QA_PASSED`, `QA_FAILED`, `WORKFLOW_COMPLETED`, `WORKFLOW_FAILED`, `USER_ACTION_REQUIRED`.
- **Memory scope:** `global`, `project`, `agent`, `task`.

## Task Status Transition Rules

A task may transition only to the statuses listed below. Transitions not listed (and `undefined → invalid`) are rejected.

| From | To |
|------|-----|
| `backlog` | `planning`, `ready`, `cancelled` |
| `planning` | `ready`, `backlog`, `cancelled` |
| `ready` | `assigned`, `backlog`, `cancelled` |
| `assigned` | `working`, `blocked`, `ready`, `cancelled` |
| `working` | `review`, `qa`, `testing`, `blocked`, `failed`, `cancelled` |
| `blocked` | `working`, `escalation` (handled by messaging), `cancelled` |
| `review` | `qa`, `working`, `blocked`, `cancelled` |
| `qa` | `testing`, `working`, `failed`, `completed`, `cancelled` |
| `testing` | `completed`, `working`, `failed`, `cancelled` |
| `completed` | (terminal — no further transitions) |
| `failed` | `working`, `cancelled` |
| `cancelled` | (terminal) |

A transition from a status to itself is always allowed (idempotent no-op).

## Database Schema

A single migration file `apps/api/migrations/009_office_domain.sql` must create these tables idempotently (`IF NOT EXISTS`) with appropriate foreign keys, `ON DELETE` behavior, and indexes:

- `offices`
- `agents`
- `agent_capabilities`
- `agent_memories`
- `tasks`
- `task_dependencies`
- `agent_messages`
- `workflow_runs`
- `workflow_steps`

The migration must be additive and preserve all existing JheckBot tables and data.

## Acceptance Criteria

1. `@jheckbot/shared` exports domain types, constants, and validation helpers for every entity and enumeration above.
2. `apps/api/migrations/009_office_domain.sql` creates all tables idempotently with valid PostgreSQL syntax.
3. Unit tests cover valid/invalid status values, valid/invalid task status transitions, and valid/invalid message/event types.
4. `pnpm --filter @jheckbot/shared test`, `pnpm --filter @jheckbot/shared typecheck`, and `pnpm --filter @jheckbot/api typecheck` pass.

## Open Questions

- Should `agents` be renamed `employees` in the domain language? The spec uses both; this slice keeps the table name `agents` and the TypeScript type `OfficeAgent` for disambiguation with `AgentSession`/`AgentAdapter`.
