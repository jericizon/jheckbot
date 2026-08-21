# Specification: Transactional MVP Chat

## Status

Approved for implementation by the user on 2026-08-21.

## Objective

Make the JheckBot conversation experience behave like the MVP described in `docs/mvp.md`: an authenticated developer sends one prompt to a project conversation, receives clean Devin progress through SSE, and can refresh or disconnect without losing the prompt, agent run, or completed response.

The primary user-visible defects are:

- message persistence and agent startup are separate, non-atomic requests;
- Devin output is transient/event-only and is not persisted as assistant message history;
- the direct child-process runner does not survive an API restart;
- raw interactive terminal redraws are not suitable chat output;
- in-memory locking is vulnerable to concurrent requests and API restarts;
- refresh/reconnect can disagree with the persisted conversation state.

## User and success definition

The user is an authenticated developer operating a mobile browser against a project directory explicitly registered under an allowed root.

The feature is successful when a three-turn conversation can be completed with:

1. one accepted server command per user turn;
2. exactly one persisted user message per accepted turn;
3. one active Devin run per conversation;
4. clean, ordered, replayable SSE output without TUI banner/status redraws;
5. one persisted assistant transcript per completed turn;
6. history and active-run state restored after browser disconnect, refresh, and API restart;
7. controlled failure behavior with no orphan user message when agent startup fails;
8. server-side conversation/project ownership and path validation.

## Approved architecture

Use the literal MVP runner now that `/usr/bin/tmux` is installed:

```text
Browser
  ↓ one atomic POST /api/conversations/:id/messages
Express API
  ↓ PostgreSQL transaction + row lock
Conversation execution coordinator
  ↓
AgentManager
  ↓
DevinAdapter
  ↓
TmuxManager
  ↓
jheckbot-{projectSlug}-{conversationId}
  ↓
interactive Devin CLI
```

`DevinAdapter` remains the only module that knows Devin-specific command details. `TmuxManager` remains the only module that knows tmux command details. Conversation/message services own persistence and validation; the controller does not coordinate independent requests.

### External-process transaction caveat

PostgreSQL cannot provide a distributed ACID transaction with an OS process. The requested atomic behavior is therefore implemented as an application-level transaction:

- validate and acquire the conversation row lock inside a PostgreSQL transaction;
- insert the user message and `starting` state;
- create the tmux session before committing;
- commit only after tmux startup succeeds;
- on startup, commit, or response failure, roll back where possible and kill the newly-created tmux session as compensation;
- on an unavoidable crash window, startup recovery reconciles tmux sessions and database state before accepting new work.

## API contract

### Atomic send

`POST /api/conversations/:id/messages`

Request body:

```json
{
  "content": "Investigate the failing tests and report the smallest safe fix.",
  "model": "glm-5-2"
}
```

The server treats this endpoint as a user-prompt command. Client-supplied `role` and arbitrary message types are not accepted for this command.

Success:

- HTTP `202`
- response contains the persisted user message and accepted agent run/status metadata;
- the response includes server-generated IDs, never a temporary client ID.

Failure semantics:

- `400` invalid conversation ID or prompt;
- `404` conversation/project not found;
- `409` conversation already has an active run;
- `429` global active-session limit reached;
- `500` only for unexpected errors, with no internal stack trace exposed.

The existing explicit agent lifecycle endpoints may remain for status and stop. The frontend must not call a separate agent-start endpoint for a user turn.

### Status and stop

- `GET /api/conversations/:id/agent` returns database-backed/recovered state, not only process-local state.
- `POST /api/conversations/:id/agent/stop` requests graceful tmux/Devin termination and returns the terminal stopped run.
- `GET /api/conversations/:id/events` remains the SSE endpoint.

## Persistence model

Existing `conversations`, `messages`, and `agent_events` tables remain the source of truth. Add only the schema support required for this contract:

- ordered event replay cursor, using a monotonic database sequence or equivalent rather than UUID comparison;
- message type constraint/defaults aligned with the MVP types: `prompt`, `output`, `error`, and `status`;
- any nullable client request identifier needed to prevent duplicate accepted turns, with a database uniqueness constraint if introduced.

Every accepted turn has:

```text
messages: user / prompt
agent_events: status + buffered output + terminal status
messages: assistant / output      (on successful completion)
messages: system or error / error (on failure where user-visible diagnostics are appropriate)
```

Output chunks are buffered by the runner and persisted as sensible chunks. A database row is not created for every terminal character or every SSE client.

## Conversation locking and isolation

Use a transaction-scoped row lock (`SELECT ... FOR UPDATE`) or an equivalent conditional state transition on the conversation record before inserting the prompt.

The lock decision must use persisted agent state plus actual tmux session state:

- active persisted state with a live matching tmux session → `409`;
- stale persisted state with no matching tmux session → reconcile to idle/failed and continue;
- a conversation ID and project ID that do not refer to the same project → reject before process creation;
- the validated resolved project path is the only `cwd` passed to Devin;
- tmux session names are deterministic and include the validated project slug and conversation ID.

## Agent lifecycle and recovery

Supported lifecycle:

```text
idle → starting → running → completed
                       ├→ failed
                       └→ stopping → stopped
```

`AgentManager` owns one watcher per active run, not one polling loop per SSE client. It must:

- start the watcher when a tmux session is accepted;
- capture/normalize output and publish buffered events;
- detect natural completion and persist the final transcript;
- release the persisted/in-memory lock on every terminal state;
- stop and clean up the watcher on browser disconnect only when the agent itself is no longer active;
- expose recovery for API startup.

At API startup:

1. query conversations whose persisted agent status is active;
2. list tmux sessions matching the JheckBot namespace;
3. reconstruct runs for matching active sessions;
4. resume watchers;
5. mark active database rows stale/idle or failed when no matching session exists;
6. leave unknown tmux sessions visible to a safe orphan-cleanup path, never silently attach them to an unrelated conversation.

## Output normalization

The interactive tmux capture boundary must produce chat-safe text:

- strip ANSI CSI/OSC/control sequences;
- normalize CRLF and carriage-return redraws;
- remove known Devin banner, border, prompt, model, context, and input-status chrome;
- compare normalized snapshots and emit only newly meaningful content;
- preserve markdown, command output, Unicode, and meaningful whitespace where possible;
- never log or persist credentials, cookies, or environment secrets.

The parser must be a standalone unit with fixtures derived from the observed Devin output. If runtime QA shows the TUI cannot be made lossless with capture normalization, stop and surface that limitation rather than silently presenting corrupted text.

## SSE behavior

The server must:

- send `text/event-stream`, no-cache, keep-alive headers;
- replay events after `Last-Event-ID` using an ordered cursor;
- subscribe the client to the single run watcher after replay without a replay/live race;
- include IDs on status and output events;
- emit ordered `starting`/`running`, zero or more output events, and exactly one terminal status event;
- close the stream after terminal delivery;
- avoid creating duplicate database events for every reconnecting client.

The browser must reconnect automatically and reload/reconcile persistent messages when a run reaches a terminal state.

## Frontend behavior

The conversation page must:

- send one atomic message request;
- show the server response ID instead of leaving an unreconciled `temp-*` message;
- remove/replace an optimistic message on failure and show a visible error;
- render clean live output separately from persisted messages while a run is active;
- refresh messages after completion, failure, or stop;
- use persisted/recovered agent state on load;
- forward authentication cookies during SSR route checks so a valid refresh does not redirect to login;
- disable duplicate sends while the conversation is active;
- preserve Enter submit and Shift+Enter newline behavior.

## Security and operational boundaries

Always:

- validate all external request fields at the API boundary;
- validate conversation/project ownership and allowed paths server-side;
- use parameterized SQL;
- retain existing authentication, security headers, cookies, and rate limiting;
- prevent arbitrary command/path selection through the chat endpoint;
- expose generic API errors without stack traces;
- add focused structured diagnostics for prompt acceptance, agent start/failure, completion, recovery, and stop without logging prompt contents or secrets.

Do not:

- add a prompt queue in this workstream;
- add another agent provider;
- bypass tmux because it is inconvenient;
- make the browser the source of truth for locks or persistence;
- treat a green success toast as proof of persistence.

## Testing strategy

### Unit tests

- transaction failure compensation;
- row-lock/concurrent send behavior;
- project/conversation mismatch;
- output normalization and redraw deduplication;
- tmux session creation/stop/recovery;
- lifecycle terminal transitions;
- ordered event cursor behavior;
- message type validation.

### API/integration tests

- atomic message endpoint success and rollback;
- `409` for sequential and simultaneous active prompts;
- persisted assistant/error history;
- SSE replay and terminal event behavior;
- startup recovery and stale-run reconciliation;
- auth and invalid-ID behavior.

### Frontend tests

- one send request per turn;
- optimistic message reconciliation/rollback;
- terminal refresh of messages;
- visible failure state;
- SSR authenticated refresh behavior.

### Real-user QA

The dedicated QA owner will run headless/API-first validation against a disposable project fixture:

- three realistic turns;
- match history after refresh;
- disconnect/reconnect during active output;
- stop and failure recovery;
- two-client/double-submit concurrency;
- project isolation;
- no console/network errors that break the objective.

No destructive write testing will use an existing personal project without explicit operator approval.

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

All of the following must be demonstrated before completion:

- focused and full automated tests pass;
- API and web typechecks pass;
- build passes;
- current live app accepts one atomic turn and returns a clean transcript;
- assistant history survives refresh;
- active tmux work survives browser disconnect and is recovered after API restart validation;
- duplicate/concurrent sends cannot create multiple active runs;
- the dedicated QA owner marks the required real-user scenarios pass or records explicit environment limitations;
- a final code-quality review finds no blocking correctness, security, architecture, or performance issue.

## Open limitations to surface during implementation

- Interactive TUI normalization may require runtime fixtures beyond the currently observed screen capture.
- OS process creation and PostgreSQL cannot share a true distributed transaction; compensation and recovery are part of the contract.
- API restart validation must be coordinated with the user because it affects the running application and active sessions.
