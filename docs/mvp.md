# JheckBot Architecture Reference

## 1. Overview

JheckBot is a self-hosted, mobile-first coding assistant UI. It provides a chat interface for controlling a locally installed agent CLI (currently Devin CLI) from a phone or browser. JheckBot is a **control plane**: it manages project metadata, conversation history, and agent sessions, but it does not contain the user's projects or perform the coding work itself.

```text
Phone / Browser
    ↓ HTTPS
Reverse proxy (Cloudflare Tunnel, Nginx, or Caddy)
    ↓
JheckBot web (Nuxt) + API (Express)
    ↓
Agent CLI (Devin) in tmux session
    ↓
Approved project directory (Git repository under configured root)
```

Key capabilities:

- Mobile-first chat UI (PWA)
- Project directory management with path validation
- Persistent, project-specific conversation history
- Persistent/reconnectable agent sessions via tmux
- Streaming agent output via SSE
- Filesystem path isolation and security
- Authentication with rate limiting
- PostgreSQL persistence

## 2. Core Concepts

```text
Project
   ↓
Conversation
   ↓
Messages
   ↓
Agent Session
```

- **Project** — an approved local Git repository under a configured allowed root.
- **Conversation** — a logical development task within a project.
- **Messages** — the permanent chat history (user prompts, agent output, errors, status).
- **Agent Session** — the actual agent process (Devin CLI in tmux) used to execute work.

Example:

```text
example-repo
│
├── Fix authentication tests
│   ├── User message
│   ├── Agent output
│   ├── User message
│   └── Agent output
│
├── Investigate API performance
│   └── Message history
│
└── Update dependencies
    └── Message history
```

## 3. Design Principle

JheckBot does **not** contain the user's projects. Projects remain outside the JheckBot repository in their own directories. JheckBot stores only metadata and validated filesystem path references.

Example filesystem layout:

```text
/workspace/projects/
├── example-repo/       ← registered in JheckBot
│   ├── .git/
│   └── src/
│
└── another-project/    ← registered in JheckBot
    ├── .git/
    └── package.json
```

JheckBot stores references such as:

```text
example-repo
→ /workspace/projects/example-repo
```

It does not copy, move, or import the projects.

## 4. Technology Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Nuxt 4, Vue 3, TypeScript, Tailwind CSS, PWA |
| Backend | Node.js, Express, TypeScript |
| Database | PostgreSQL |
| Agent | Devin CLI (host-side, interactive) |
| Process | tmux (live-process persistence) |
| Realtime | Server-Sent Events (SSE) |
| Package Manager | pnpm (workspaces) |
| Testing | Vitest, Supertest |
| Infrastructure | Docker Compose (PostgreSQL), Cloudflare Tunnel or reverse proxy (production) |

## 5. Repository Structure

```text
jheckbot/
├── apps/
│   ├── web/              # Nuxt web application (PWA)
│   └── api/              # Express API + agent runner
├── packages/
│   └── shared/           # Shared types, constants, validation
├── deploy/               # Deployment templates
├── docs/                 # Architecture documentation
├── docker-compose.yml
├── pnpm-workspace.yaml
├── package.json
└── .env.example
```

## 6. Allowed Directory Roots

JheckBot uses a configurable list of allowed filesystem roots (`ALLOWED_ROOTS`). A project may only exist beneath an enabled allowed root and must contain a `.git` marker (directory or worktree file).

Example configuration:

```env
ALLOWED_ROOTS=/workspace/projects
```

Paths like the following are rejected:

```text
/etc
/
~/.ssh
~/.config
```

This prevents project registration from becoming an unrestricted filesystem access mechanism.

## 7. Project Management

The API supports:

- Add project (validates path, root containment, Git marker, readability)
- Edit project
- Enable/disable project
- Delete project metadata (does NOT delete the actual directory)
- Test/validate directory
- View project health status
- Open project conversations

## 8. Project Health

Each project has a health check that reports:

- Directory exists and is accessible
- Git repository detected
- Node/pnpm project detection (optional)
- Agent CLI availability

The health check does not modify the project.

## 9. Conversation Model

A conversation belongs to exactly one project. Conversations keep project context separated.

Features:

- New conversation
- Rename conversation
- Delete conversation
- Archive conversation
- View message history
- Continue conversation
- Search conversation history (PostgreSQL text search)

Conversation titles can be generated from the first user prompt.

## 10. Message History

Every user prompt and agent output is persisted in PostgreSQL.

Message model:

| Field | Description |
|-------|-------------|
| id | UUID |
| conversation_id | FK to conversations |
| role | `user`, `assistant`, `system` |
| content | Text content |
| message_type | `prompt`, `output`, `error`, `status` |
| created_at | Timestamp |

Agent streaming output is buffered and persisted in sensible chunks rather than creating a database row for every terminal character.

## 11. Agent Session

A conversation references an agent session:

```text
conversation
    ↓
agent_session_id
    ↓
Devin CLI / tmux session
```

Session naming convention: `jheckbot-{projectSlug}-{conversationId}`

## 12. Agent Adapter

JheckBot uses an adapter pattern for agent CLIs:

```text
AgentAdapter
    │
    └── DevinAdapter
```

The MVP implements only `DevinAdapter`. Future adapters (Codex, Claude Code, Gemini CLI) are planned. The adapter isolates provider-specific command details from the rest of the application.

## 13. Agent Lifecycle

```text
idle → starting → running → completed
                       ├→ failed
                       └→ stopping → stopped
```

The agent survives browser disconnects via tmux. When the browser reconnects, JheckBot restores the conversation state and reconnects to live output.

## 14. PTY / tmux

The agent runner uses tmux rather than a basic one-shot child process because:

- Devin is interactive
- Long-running work must survive browser disconnects
- Terminal output needs to be streamed
- Agent processes must be inspectable
- Backend restarts should not necessarily destroy the agent

```text
JheckBot API (host)
   ↓
TmuxManager
   ↓
host tmux session
   ↓
Devin CLI
```

The runner fails closed and reports the dependency as unavailable if tmux or Devin is missing.

## 15. Prompt Execution

User sends a prompt via `POST /api/conversations/:id/messages`.

Flow:

```text
Browser
  ↓ POST /api/conversations/:id/messages
Authenticate
  ↓
Validate conversation and project
  ↓
Resolve approved path
  ↓
Acquire conversation execution lock (PostgreSQL row lock)
  ↓
Persist user message
  ↓
Send prompt to agent (tmux + Devin)
  ↓
Return 202 Accepted
```

Output is streamed separately through SSE. Only one active prompt may execute per conversation (409 Conflict if already active).

## 16. SSE Streaming

Endpoint: `GET /api/conversations/:id/events`

Example events:

```text
event: status
data: {"status":"running"}

event: output
data: {"content":"Inspecting package.json..."}

event: output
data: {"content":"Running pnpm test..."}

event: status
data: {"status":"completed"}
```

The browser automatically reconnects. SSE uses ordered event cursors for replay — events are replayed after `Last-Event-ID` without duplication.

## 17. Reconnection

When the browser reconnects:

1. `GET /api/conversations/:id` — current conversation state
2. `GET /api/conversations/:id/messages` — persistent history
3. `GET /api/conversations/:id/events` — reconnect to live output

The application does not depend on the client remaining connected.

## 18. Authentication

JheckBot uses single-user authentication:

- Username/password login
- bcrypt password hashing
- HTTP-only secure cookies
- Login rate limiting
- Session expiration

The agent interface is never exposed without authentication.

## 19. Path Security

Before every agent launch:

1. Load project by ID
2. Resolve configured path
3. Resolve real path with filesystem APIs
4. Confirm project path is inside an enabled allowed root
5. Confirm directory exists and is readable
6. Confirm `.git` marker is present
7. Start agent only after validation

Protected against:

- `..` traversal
- Symlink traversal outside allowed roots
- Path substitution
- Arbitrary absolute paths
- Deleted/replaced project directories

## 20. API Routes

### Auth

```text
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me
```

### Projects

```text
GET    /api/projects
POST   /api/projects
GET    /api/projects/:id
PATCH  /api/projects/:id
DELETE /api/projects/:id
POST   /api/projects/:id/validate
POST   /api/projects/:id/health
```

### Conversations

```text
GET    /api/projects/:id/conversations
POST   /api/projects/:id/conversations
GET    /api/conversations/:id
PATCH  /api/conversations/:id
DELETE /api/conversations/:id
POST   /api/conversations/:id/archive
```

### Messages

```text
GET  /api/conversations/:id/messages
POST /api/conversations/:id/messages
```

### Agent

```text
GET  /api/conversations/:id/agent
POST /api/conversations/:id/agent/stop
GET  /api/conversations/:id/events
```

### System

```text
GET /health
```

## 21. Database Schema

### users

| Column | Type |
|--------|------|
| id | UUID |
| username | text |
| password_hash | text |
| created_at | timestamp |
| updated_at | timestamp |

### allowed_roots

| Column | Type |
|--------|------|
| id | UUID |
| name | text |
| path | text |
| enabled | boolean |
| created_at | timestamp |
| updated_at | timestamp |

### projects

| Column | Type |
|--------|------|
| id | UUID |
| name | text |
| slug | text |
| path | text |
| description | text |
| enabled | boolean |
| created_at | timestamp |
| updated_at | timestamp |

### conversations

| Column | Type |
|--------|------|
| id | UUID |
| project_id | UUID FK |
| title | text |
| status | text |
| agent_type | text |
| agent_session_id | text |
| created_at | timestamp |
| updated_at | timestamp |
| last_message_at | timestamp |

### messages

| Column | Type |
|--------|------|
| id | UUID |
| conversation_id | UUID FK |
| role | text |
| content | text |
| message_type | text |
| created_at | timestamp |

### agent_events

| Column | Type |
|--------|------|
| id | UUID |
| conversation_id | UUID FK |
| event_type | text |
| content | text |
| event_sequence | bigint |
| created_at | timestamp |

## 22. Security Requirements

JheckBot has access to development environments, so security is critical.

- The browser only references project IDs — it never sends arbitrary filesystem paths for execution.
- No shell API endpoint exists.
- The backend resolves project IDs to validated paths server-side.
- All request fields are validated at the API boundary.
- Parameterized SQL is used for all database operations.
- Authentication, security headers, secure cookies, and rate limiting are enforced.
- Generic API errors are returned without stack traces.
- Logs never include passwords, session secrets, cookies, API keys, or tokens.

## 23. Rate Limiting

Rate-limited endpoints:

- `/login` — 10 requests per 15 minutes
- `/api` — 100 requests per minute
- `/messages` — 30 requests per minute

## 24. Agent Limits

| Limit | Default |
|-------|---------|
| Maximum active agent sessions | 3 |
| Maximum active prompts per conversation | 1 |
| Default task timeout | 60 minutes |

## 25. Logging

Logged events:

- Authentication success/failure
- Project created/updated/deleted
- Conversation created
- Agent started/stopped/exited/error
- SSE connected/disconnected

Never logged: passwords, session secrets, cookies, API keys, tokens, or prompt contents.

## 26. Docker Architecture

The current profile uses Docker for PostgreSQL only:

```text
Docker Compose
└── postgres host :8802 → container :5432

Host
├── Nuxt web                  :8800
├── Express API + agent runner:8801
├── Devin CLI                 (configured via DEVIN_BIN)
├── tmux                      (configured via TMUX_BIN)
└── Configured workspace root (via ALLOWED_ROOTS)
```

Full web/API containerization is deferred until the agent runner can safely access the host-installed Devin CLI, PTY behavior, and the approved workspace through an explicit path mapping.

## 27. Environment Variables

See `.env.example` for the full list with documentation. Key variables:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string (required) |
| `SESSION_SECRET` | Random string >= 32 chars (required) |
| `ADMIN_USERNAME` | Admin login username (required) |
| `ADMIN_PASSWORD` | Admin login password >= 12 chars (required) |
| `ALLOWED_ROOTS` | Path-delimited list of workspace roots (required) |
| `DEVIN_BIN` | Devin CLI command or path (required) |
| `TMUX_BIN` | tmux command or path (required) |
| `COOKIE_SECURE` | Set `true` in production |
| `COOKIE_SAME_SITE` | `lax`, `strict`, or `none` |

Never commit the real `.env` file.

## 28. Future Architecture

The design leaves room for multiple agent backends:

```text
                  JheckBot
                      │
                 AgentManager
                      │
          ┌───────────┼───────────┐
          ▼           ▼           ▼
       Devin       Claude       Codex
       Adapter      Adapter      Adapter
```

## 29. Guiding Principles

1. JheckBot is a control plane, not the coding agent.
2. The agent CLI remains responsible for development work.
3. Projects remain outside the JheckBot repository.
4. Only explicitly configured project directories are available.
5. The browser never sends arbitrary filesystem paths for execution.
6. The browser never gets a raw shell API.
7. Conversation history is persistent and project-specific.
8. Agent sessions must survive browser disconnection.
9. Security is critical because the agent can execute commands on the host.
