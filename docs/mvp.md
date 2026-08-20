# JheckBot MVP

## 1. Project Overview

JheckBot is a self-hosted, mobile-first development assistant that provides a chat interface for controlling a locally installed **Devin CLI** running on an Ubuntu development machine.

The primary workflow is:

```text
Android Phone
    ↓ HTTPS
Cloudflare
    ↓ Cloudflare Tunnel
JheckBot
    ↓
Devin CLI
    ↓
Configured project directory
```

The user's development projects remain **outside the JheckBot directory**. JheckBot only stores project metadata and approved filesystem paths.

The MVP should provide:

- Mobile-first chat UI
- Project directory management
- Persistent project-specific conversation history
- Persistent/reconnectable Devin CLI sessions
- Streaming Devin output
- Project isolation
- Authentication
- Cloudflare Tunnel deployment gate after hardening
- PostgreSQL persistence
- Docker support for the PostgreSQL development profile
- pnpm as the package manager
- TypeScript throughout the application

## 1.1 Verified Local Baseline

The following local facts were checked on **2026-08-21**. They are a baseline for implementation, not a substitute for checking the environment during deployment.

| Area | Verified local state | MVP impact |
|---|---|---|
| Operating system | Ubuntu 24.04.2, x86_64 | Compatible with the host-side Node, Devin, Docker, and Cloudflare profile below |
| Node.js | v24.12.0 via nvm | Available; pin the supported version in the repository once the monorepo is created |
| pnpm | v11.1.1 | Available and matches the package-manager requirement |
| Docker | Engine 29.7.2; Compose v5.5.0; daemon active | Available for the PostgreSQL development service |
| PostgreSQL | `psql` client 18.6; system PostgreSQL service inactive | Use a dedicated Docker PostgreSQL container; host port 8802 was free at verification time |
| Devin CLI | v3000.4.25, authenticated, `/home/jeric/.local/bin/devin` | Available on the host; do not use `/usr/local/bin/devin` |
| Devin sandbox prerequisites | `bwrap` and `socat` are installed | The CLI sandbox can be tested later; this does not prove the application runner is safe yet |
| tmux | Not installed; Ubuntu package candidate is 3.4 | Agent persistence is blocked until tmux is installed or another runner is selected |
| cloudflared | v2026.8.2 at `/usr/local/bin/cloudflared` | Binary is available, but no local Cloudflare configuration or active service was found |
| Workspace | `/home/jeric/Workspace`, `clients`, `personal`, and the example project directories exist and are readable/writable | Use `/home/jeric/Workspace` as the host allowed root |
| Additional project root | `/home/jeric/Projects` does not exist | Do not use it as a default allowed root |
| Ports | Existing services occupy 3000, 4000, 5433–5435, 6379–6380, 8080, and 9000–9003; 8800–8802 were free | Reserve 8800 for Nuxt, 8801 for Express, and 8802 for JheckBot's host-mapped database port |
| Storage | Root filesystem is approximately 95% full with about 14 GB free | Treat storage as a warning before Docker builds, database growth, or long agent runs |
| Repository | Documentation-only scaffold; no package files, source, lockfile, or Compose file exist yet | All implementation prerequisites still need to be created |

The feasible local development topology is therefore:

```text
Ubuntu host
├── Nuxt web                  :8800
├── Express API + agent runner:8801
├── Devin CLI                 /home/jeric/.local/bin/devin
├── tmux                      required, currently missing
├── cloudflared               installed, not configured
└── /home/jeric/Workspace      approved host workspace

Docker
└── PostgreSQL                host port :8802 → container port :5432
```

JheckBot reserves the following host ports:

```text
8800  Nuxt web
8801  Express API
8802  PostgreSQL host mapping → container 5432
```

These ports were free during verification. Recheck them before startup because port availability can change when other projects are running.

Run the web, API, and agent runner on the host for the initial MVP. This keeps the host-installed Devin CLI and project directories in the same filesystem namespace. Full web/API containerization is a later profile that requires an explicit agent-runner and path-mapping validation.

---

# 2. Core Product Concept

JheckBot has four primary concepts:

```text
Project
   ↓
Conversation
   ↓
Messages
   ↓
Devin Session
```

A project represents an approved local directory.

A conversation represents a logical development task/discussion.

Messages are the permanent chat history.

A Devin session represents the actual local agent process used to execute work.

Example:

```text
LunchOnline
│
├── Fix restaurant authentication
│   ├── User message
│   ├── Devin output
│   ├── User message
│   └── Devin output
│
├── Stripe wallet issue
│   └── Message history
│
└── Mobile checkout bug
    └── Message history
```

---

# 3. Important Design Principle

JheckBot itself should NOT contain the user's projects.

Current filesystem:

```text
/home/jeric/
│
└── Workspace/
    ├── clients/
    │   ├── lunchonline/
    │   ├── adzeela/
    │   └── other-project/
    │
    └── personal/
        ├── expresswayph/
        └── jheckbot/
            ├── docs/
            └── .git/
```

The JheckBot repository is currently at:

```text
/home/jeric/Workspace/personal/jheckbot
```

The application structure shown later in this document is planned structure. The real `.env` file must remain local and untracked; commit only `.env.example`.

JheckBot stores references such as:

```text
LunchOnline
→ /home/jeric/Workspace/clients/lunchonline

Adzeela
→ /home/jeric/Workspace/clients/adzeela

ExpresswayPH
→ /home/jeric/Workspace/personal/expresswayph
```

It does not copy, move, or import the projects.

---

# 4. Technology Stack

## Frontend

- Nuxt 4
- Vue 3
- TypeScript
- Tailwind CSS
- PWA

## Backend

- Node.js
- Express.js
- TypeScript

## Package Manager

- pnpm
- pnpm workspaces

## Database

- PostgreSQL

## Agent

- Devin CLI

## Agent Process

Current local profile:

- Host-side Devin CLI
- PTY-backed interactive process
- Devin CLI session history for `--continue`/`--resume`
- tmux for keeping a live process after browser/API disconnects

`tmux` is not currently installed on the host. Phase 3 is blocked until it is installed or the runner is redesigned around another supported process supervisor. Devin's native session history is a recovery mechanism; it does not replace live-process supervision or SSE event replay.

## Realtime Communication

- REST API
- Server-Sent Events (SSE)

## Infrastructure

- Docker (PostgreSQL development profile)
- Docker Compose (PostgreSQL development profile)
- Cloudflare Tunnel (deployment gate)
- Cloudflare Access (deployment gate)

## Testing

- Vitest
- Supertest
- Playwright

---

# 5. Repository Structure

Use a pnpm monorepo.

```text
jheckbot/
├── apps/
│   ├── web/
│   │   ├── pages/
│   │   │   ├── index.vue
│   │   │   ├── login.vue
│   │   │   ├── projects/
│   │   │   │   ├── index.vue
│   │   │   │   └── [id].vue
│   │   │   └── conversations/
│   │   │       └── [id].vue
│   │   │
│   │   ├── components/
│   │   │   ├── chat/
│   │   │   ├── projects/
│   │   │   ├── conversations/
│   │   │   ├── layout/
│   │   │   └── common/
│   │   │
│   │   ├── composables/
│   │   │   ├── useAuth.ts
│   │   │   ├── useProjects.ts
│   │   │   ├── useConversations.ts
│   │   │   ├── useChat.ts
│   │   │   └── useSSE.ts
│   │   │
│   │   ├── stores/
│   │   ├── middleware/
│   │   ├── assets/
│   │   ├── public/
│   │   ├── nuxt.config.ts
│   │   └── package.json
│   │
│   └── api/
│       ├── src/
│       │   ├── server.ts
│       │   ├── app.ts
│       │   │
│       │   ├── config/
│       │   │   └── env.ts
│       │   │
│       │   ├── routes/
│       │   │   ├── auth.routes.ts
│       │   │   ├── project.routes.ts
│       │   │   ├── conversation.routes.ts
│       │   │   ├── message.routes.ts
│       │   │   └── agent.routes.ts
│       │   │
│       │   ├── controllers/
│       │   │   ├── AuthController.ts
│       │   │   ├── ProjectController.ts
│       │   │   ├── ConversationController.ts
│       │   │   ├── MessageController.ts
│       │   │   └── AgentController.ts
│       │   │
│       │   ├── services/
│       │   │   ├── AuthService.ts
│       │   │   ├── ProjectService.ts
│       │   │   ├── ConversationService.ts
│       │   │   ├── MessageService.ts
│       │   │   └── AgentService.ts
│       │   │
│       │   ├── agent/
│       │   │   ├── AgentManager.ts
│       │   │   ├── DevinAdapter.ts
│       │   │   ├── PtyManager.ts
│       │   │   └── TmuxManager.ts
│       │   │
│       │   ├── repositories/
│       │   ├── middleware/
│       │   ├── validators/
│       │   ├── utils/
│       │   └── db/
│       │
│       └── package.json
│
├── packages/
│   ├── shared/
│   │   ├── src/
│   │   │   ├── types/
│   │   │   ├── constants/
│   │   │   └── validation/
│   │   └── package.json
│   │
│   └── eslint-config/
│
├── docker/
│   ├── api.Dockerfile
│   └── web.Dockerfile
│
├── config/
│   └── projects.example.json
│
├── scripts/
│
├── tests/
│
├── docker-compose.yml
├── pnpm-workspace.yaml
├── package.json
├── pnpm-lock.yaml
├── .env.example
├── .gitignore
└── README.md
```

---

# 6. pnpm Configuration

The root `package.json` should define the workspace commands.

Recommended scripts:

```text
pnpm dev
pnpm build
pnpm test
pnpm test:unit
pnpm test:e2e
pnpm lint
pnpm typecheck
pnpm format
```

Workspace commands should allow:

```text
pnpm --filter web dev
pnpm --filter api dev
pnpm --filter api test
pnpm --filter web test
```

Use the root lockfile:

```text
pnpm-lock.yaml
```

Do not use npm or yarn.

---

# 7. External Project Directory Model

JheckBot should support projects outside its own directory.

Example database record:

```text
id:
name: LunchOnline
slug: lunchonline
path: /home/jeric/Workspace/clients/lunchonline
description: Lunch and catering SaaS
enabled: true
```

The browser should only send:

```json
{
  "projectId": "project-id"
}
```

It must never send an arbitrary path to execute.

The backend resolves:

```text
projectId
    ↓
database
    ↓
approved path
    ↓
security validation
    ↓
Devin working directory
```

---

# 8. Allowed Directory Roots

JheckBot should have a configurable list of allowed filesystem roots.

Verified local default:

```text
/home/jeric/Workspace
```

`/home/jeric/Projects` is not present on the current host and should not be configured unless it is created and explicitly approved later.

A project may only exist beneath an allowed root.

For example:

```text
/home/jeric/Workspace/clients/lunchonline
```

is allowed.

But:

```text
/home/jeric/.ssh
/home/jeric/.config
/etc
/
```

must be rejected.

This prevents a project registration from becoming an unrestricted filesystem access mechanism.

---

# 9. Project Management

The MVP must allow the user to:

- Add project
- Edit project
- Enable/disable project
- Delete project metadata
- Test directory
- View project status
- Open project conversations

Deleting a project from JheckBot must NOT delete the actual project directory.

The delete operation only removes the JheckBot project record.

---

# 10. Add Project Flow

UI:

```text
Add Project

Name
[ LunchOnline ]

Directory
[ /home/jeric/Workspace/clients/lunchonline ]

Description
[ Lunch and catering SaaS ]

[ Validate Directory ]
[ Save Project ]
```

Validation must check:

- Path exists
- Path is a directory
- Path is under an allowed root
- Directory is readable
- Directory is accessible to the agent runtime
- Optional: directory is a Git repository
- Optional: Node/pnpm project detection

---

# 11. Project Health

Each project should have a health check.

Example:

```text
LunchOnline

Directory       ✓
Accessible      ✓
Git repository  ✓
Node            ✓
pnpm            ✓
Docker          ✓
Devin CLI       ✓

[ Open ]
```

The health check should not modify the project.

---

# 12. Conversation Model

A conversation belongs to exactly one project.

```text
Project
  ↓
Conversation
  ↓
Messages
```

Example:

```text
LunchOnline
├── Fix restaurant authentication
├── Stripe wallet issue
├── Mobile checkout
└── API performance
```

This keeps project context separated.

---

# 13. Conversation Features

MVP:

- New conversation
- Rename conversation
- Delete conversation
- Archive conversation
- Open conversation
- View message history
- Continue conversation
- Search conversation history

Conversation title can initially be generated from the first user prompt.

Example:

```text
"Fix the failing restaurant authentication tests"

→ "Fix restaurant authentication tests"
```

No additional AI call is required for the MVP.

---

# 14. Message History

Every user prompt and agent output should be persisted.

Message model:

```text
id
conversation_id
role
content
message_type
created_at
```

Roles:

```text
user
assistant
system
```

Types:

```text
prompt
output
error
status
```

Agent streaming output can be buffered and persisted in sensible chunks rather than creating a database row for every terminal character.

---

# 15. Agent Session

A conversation can reference a Devin session.

```text
conversation
    ↓
agent_session_id
    ↓
Devin CLI / tmux session
```

Example:

```text
conversation_id: 42
project_id: 5
agent_type: devin
agent_session_id: jheckbot-lunchonline-42
status: running
```

---

# 16. Devin CLI Adapter

Do not spread Devin-specific process handling throughout the application.

Use an adapter:

```text
AgentAdapter
    │
    └── DevinAdapter
```

This makes it possible to support other agents later.

Possible future adapters:

```text
DevinAdapter
ClaudeCodeAdapter
CodexAdapter
OpenCodeAdapter
```

The MVP only implements:

```text
DevinAdapter
```

The verified Devin CLI supports interactive sessions, non-interactive `-p` mode, and native `--continue`/`--resume` session recovery. The MVP should use the interactive mode for live PTY/SSE streaming and persist the Devin session identifier alongside the JheckBot run. Devin's optional `--sandbox` mode has its Linux prerequisites (`bwrap` and `socat`) installed on the current host, but it still requires an application-level smoke test before being treated as a production boundary.

---

# 17. Agent Lifecycle

The lifecycle should be:

```text
idle
 ↓
starting
 ↓
running
 ↓
waiting
 ↓
completed
```

Failure:

```text
running
 ↓
failed
```

Manual stop:

```text
running
 ↓
stopping
 ↓
stopped
```

---

# 18. Persistent Agent Sessions

The agent should survive a browser disconnect.

Example:

```text
Phone
  ↓
Prompt
  ↓
Devin starts
  ↓
Phone disconnected
  ↓
Devin continues
  ↓
Phone reconnects
  ↓
JheckBot restores conversation
```

Use host-side tmux as the live-process persistence layer after it is installed and validated. Devin CLI also persists conversation history and supports `--continue`/`--resume`, but that native history does not guarantee that a running process survives an API restart.

Example naming convention:

```text
jheckbot-{projectSlug}-{conversationId}
```

Example:

```text
jheckbot-lunchonline-42
```

---

# 19. PTY / tmux

The agent runner should use a PTY or tmux rather than a basic one-shot child process.

Reason:

- Devin is interactive
- Long-running work must survive browser disconnects
- Terminal output needs to be streamed
- Agent process must be inspectable
- Backend restarts should not necessarily destroy the agent

Current MVP approach:

```text
JheckBot API (host)
   ↓
TmuxManager
   ↓
host tmux session
   ↓
Devin CLI at /home/jeric/.local/bin/devin
```

This approach is not executable on the current host until tmux is installed. The runner must fail closed and report the dependency as unavailable rather than silently falling back to an unmanaged child process.

---

# 20. Prompt Execution

User sends:

```text
Investigate the failing tests and fix them. Do not commit anything yet.
```

Flow:

```text
Browser
  ↓
POST /api/conversations/:id/messages
  ↓
Authenticate
  ↓
Validate conversation
  ↓
Validate project
  ↓
Resolve approved path
  ↓
Acquire conversation execution lock
  ↓
Persist user message
  ↓
Send prompt to Devin
  ↓
Return accepted response
```

Output is streamed separately through SSE.

---

# 21. SSE Streaming

Endpoint:

```text
GET /api/conversations/:id/events
```

Example events:

```text
event: status
data: {"status":"running"}
```

```text
event: output
data: {"content":"Inspecting package.json..."}
```

```text
event: output
data: {"content":"Running pnpm test..."}
```

```text
event: status
data: {"status":"completed"}
```

The browser should automatically reconnect.

---

# 22. Reconnection

When the browser reconnects:

```text
GET /api/conversations/:id
```

gets the current conversation state.

Then:

```text
GET /api/conversations/:id/messages
```

loads persistent history.

Then:

```text
GET /api/conversations/:id/events
```

reconnects to live output.

The application must not depend on the phone remaining connected.

---

# 23. Concurrent Prompt Protection

Only one active prompt may execute per conversation in the MVP.

If the agent is working:

```text
Agent is currently working.
```

The API should return:

```text
409 Conflict
```

Do not blindly send multiple prompts to an interactive Devin process.

A prompt queue can be implemented later.

---

# 24. Stop Agent

UI:

```text
[ Stop Agent ]
```

API:

```text
POST /api/conversations/:id/stop
```

The agent should receive a graceful termination request.

Use forced termination only if graceful shutdown fails.

---

# 25. Authentication

JheckBot is initially a single-user personal application.

MVP authentication:

```text
Username
Password
```

Use:

- Argon2id or bcrypt
- HTTP-only secure cookies
- Secure session management
- Login rate limiting
- Session expiration

Do not expose an unauthenticated agent interface.

---

# 26. Cloudflare Access

Use Cloudflare Access as an additional external protection layer.

Recommended:

```text
Phone
 ↓
Cloudflare
 ↓
Cloudflare Access
 ↓
Cloudflare Tunnel
 ↓
JheckBot
 ↓
Application authentication
```

Never expose:

- PostgreSQL
- SSH
- tmux
- Devin
- arbitrary shell
- filesystem APIs

through the public tunnel.

---

# 27. Docker Architecture

## Current local profile

The current host supports a hybrid development profile:

```text
Docker Compose
└── postgres host :8802 → container :5432

Ubuntu host
├── Nuxt web                  :8800
├── Express API + agent runner:8801
├── Devin CLI                 /home/jeric/.local/bin/devin
├── tmux                      required, currently missing
├── cloudflared               installed, not configured
└── /home/jeric/Workspace      approved workspace
```

Run the web, API, and agent runner on the host. Run only JheckBot's PostgreSQL service in Docker during initial development. This avoids duplicate Node processes and keeps Devin, PTY/tmux, and the external project directories in the same filesystem namespace.

The host already runs other project containers, including PostgreSQL containers on ports 5433–5435. JheckBot must use its own database service, volume, credentials, and database name; it must not reuse another project's container.

The host API connects to `127.0.0.1:8802`. If the API is later moved into the Compose network, it must connect to the PostgreSQL service name on container port `5432` instead of using the host-mapped port.

## Future container profile

A full Compose profile may later contain:

```text
Docker Compose
├── web
├── api
└── postgres
```

Do not enable that profile until the agent runner has been validated with the host-installed Devin CLI, the required PTY behavior, and explicit host-to-container path mapping. The current MVP decision is a controlled host-side agent runner, not Devin inside the API container.

---

# 28. Workspace Access and Future Mount

No workspace mount is required for the current local profile because the API and agent runner execute on the host. Store and validate project paths in the host namespace:

```text
ALLOWED_ROOTS=/home/jeric/Workspace
```

If the future API/agent runtime is containerized, mount only the approved workspace root and maintain separate host and runtime paths:

```yaml
volumes:
  - /home/jeric/Workspace:/workspace
```

```text
Host:
/home/jeric/Workspace/clients/lunchonline

Container:
/workspace/clients/lunchonline
```

The database record must identify the path namespace it stores, and the runtime must validate the mapped path immediately before launch. Do not mount the entire `/home/jeric`.

---

# 29. Path Security

Before every agent launch:

1. Load project by ID.
2. Resolve configured path.
3. Resolve real path with filesystem APIs.
4. Resolve allowed root.
5. Confirm project path is inside an allowed root.
6. Confirm directory exists.
7. Confirm directory is accessible.
8. Convert to the agent runtime path if containerized.
9. Start Devin only after validation.

Protect against:

- `..`
- symlink traversal
- path substitution
- arbitrary absolute paths
- deleted/replaced project directories

If a project path resolves outside its allowed root, reject execution.

---

# 30. API Routes

## Auth

```text
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me
```

## Projects

```text
GET    /api/projects
POST   /api/projects
GET    /api/projects/:id
PATCH  /api/projects/:id
DELETE /api/projects/:id
POST   /api/projects/:id/validate
POST   /api/projects/:id/health
```

## Conversations

```text
GET    /api/projects/:id/conversations
POST   /api/projects/:id/conversations
GET    /api/conversations/:id
PATCH  /api/conversations/:id
DELETE /api/conversations/:id
POST   /api/conversations/:id/archive
```

## Messages

```text
GET  /api/conversations/:id/messages
POST /api/conversations/:id/messages
```

## Agent

```text
GET  /api/conversations/:id/agent
POST /api/conversations/:id/agent/start
POST /api/conversations/:id/agent/stop
GET  /api/conversations/:id/events
```

## System

```text
GET /health
GET /api/system/status
```

---

# 31. Database Schema

## users

```text
id
username
password_hash
created_at
updated_at
```

## allowed_roots

```text
id
name
path
enabled
created_at
updated_at
```

Example:

```text
Workspace
/home/jeric/Workspace
```

## projects

```text
id
name
slug
path
description
enabled
created_at
updated_at
```

## conversations

```text
id
project_id
title
status
agent_type
agent_session_id
created_at
updated_at
last_message_at
```

## messages

```text
id
conversation_id
role
content
message_type
created_at
```

## agent_events

Optional for MVP but recommended:

```text
id
conversation_id
event_type
content
created_at
```

This can help debug agent execution separately from the user-visible chat history.

---

# 32. Conversation History Search

MVP should support basic PostgreSQL text search.

Search across:

- conversation titles
- message content
- project names

Example:

```text
Search: stripe
```

Results:

```text
LunchOnline
Stripe wallet top-up issue
Aug 19

LunchOnline
Stripe checkout investigation
Aug 12
```

Do not introduce a vector database for the MVP.

---

# 33. Mobile UI

The UI should be designed primarily for Android phone screens.

Home:

```text
┌────────────────────────────┐
│ 🤖 JheckBot           ☰   │
├────────────────────────────┤
│                            │
│ Recent                    │
│                            │
│ 🟢 LunchOnline             │
│ Fix restaurant checkout    │
│ 2 minutes ago              │
│                            │
│ 🟢 Adzeela                 │
│ Android TV build           │
│ Yesterday                  │
│                            │
│ 🟢 ExpresswayPH            │
│ Update toll data           │
│ Aug 19                     │
│                            │
├────────────────────────────┤
│ Projects  History  Settings│
└────────────────────────────┘
```

---

# 34. Project Screen

```text
┌────────────────────────────┐
│ ← LunchOnline              │
├────────────────────────────┤
│                            │
│ /Workspace/clients/...     │
│                            │
│ Agent: Devin ✓             │
│ Directory: ✓              │
│ Git: ✓                     │
│                            │
│ Conversations              │
│                            │
│ Fix restaurant auth        │
│ Stripe wallet issue        │
│ Mobile checkout            │
│                            │
│ + New Conversation         │
└────────────────────────────┘
```

---

# 35. Chat Screen

```text
┌────────────────────────────┐
│ ← LunchOnline         ●    │
├────────────────────────────┤
│                            │
│ You                        │
│ Fix the failing tests.     │
│                            │
│ Devin                      │
│ Inspecting the project...  │
│                            │
│ Running pnpm test...       │
│                            │
│ 47 passed                  │
│ 2 failed                   │
│                            │
│ Investigating auth...      │
│                            │
├────────────────────────────┤
│ Message...              ➤  │
└────────────────────────────┘
```

While Devin is working:

```text
[ Stop ]
```

should be visible.

---

# 36. History Screen

```text
┌────────────────────────────┐
│ History                    │
├────────────────────────────┤
│ 🔎 Search                  │
│                            │
│ LunchOnline                │
│ Fix restaurant auth        │
│ Today                      │
│                            │
│ Adzeela                    │
│ Android TV build           │
│ Yesterday                  │
│                            │
│ ExpresswayPH               │
│ Toll calculator update     │
│ Aug 18                     │
└────────────────────────────┘
```

---

# 37. PWA

The web app should be installable on Android.

Requirements:

- Web manifest
- Service worker
- App icon
- Mobile viewport
- Standalone display
- Offline shell where practical

Do not attempt to make agent execution work offline.

The PWA is simply the mobile interface to the online JheckBot server.

---

# 38. System Status

Settings should show:

```text
JheckBot Status

API             ✓
Database        ✓
Devin CLI       ✓
tmux            ✓
Workspace       ✓
Cloudflare      ✓

Active Agents
1
```

Potential statuses:

```text
✓ Connected
⚠ Warning
✕ Unavailable
```

---

# 39. Environment Variables

## Current local development baseline

```env
NODE_ENV=development

API_PORT=8801
WEB_PORT=8800
POSTGRES_HOST_PORT=8802

DATABASE_URL=postgresql://jheckbot:<local-password>@127.0.0.1:8802/jheckbot

SESSION_SECRET=<generate-and-store-locally>

DEVIN_BIN=/home/jeric/.local/bin/devin
# Required after tmux is installed; this path is not present yet.
TMUX_BIN=/usr/bin/tmux

ALLOWED_ROOTS=/home/jeric/Workspace

AGENT_MAX_RUNTIME_MS=3600000

COOKIE_SECURE=false
COOKIE_SAME_SITE=lax
```

The literal placeholder values above are not valid secrets. Generate a strong local session secret and provide the PostgreSQL password through the untracked local environment. For production, use `NODE_ENV=production`, `COOKIE_SECURE=true`, managed secret injection, and the runtime path namespace selected by the deployment profile.

Never commit the real `.env`.

---

# 40. Security Requirements

JheckBot has access to development environments, so security is a major MVP requirement.

Do not provide:

```text
POST /api/shell
```

Do not allow:

```json
{
  "command": "..."
}
```

from the browser.

Do not allow arbitrary:

```json
{
  "path": "..."
}
```

execution.

The browser only references IDs.

Example:

```json
{
  "projectId": "lunchonline"
}
```

The backend resolves the project.

---

# 41. Rate Limiting

Rate-limit:

```text
/login
/projects
/conversations
/messages
```

Especially protect message execution.

A single user should not accidentally create hundreds of Devin processes.

---

# 42. Agent Limits

MVP defaults:

```text
Maximum active agent sessions: 3
Maximum active prompt per conversation: 1
Default task timeout: 60 minutes
```

These should be configurable.

---

# 43. Logging

Log:

```text
authentication success/failure
project created/updated/deleted
conversation created
agent started
agent stopped
agent exited
agent error
SSE connected/disconnected
```

Never log:

```text
passwords
session secrets
cookies
API keys
tokens
```

---

# 44. Health Endpoint

```text
GET /health
```

Example:

```json
{
  "status": "ok",
  "database": "ok",
  "devin": "ok",
  "tmux": "ok"
}
```

On the verified current host, the detailed status must report tmux as unavailable and Cloudflare as unconfigured until those prerequisites are completed. Health checks must not claim agent readiness based only on the Devin binary being present.

---

# 45. Local Development

The current local profile uses host Node processes and a Docker PostgreSQL service:

```text
Nuxt
localhost:8800

Express API
localhost:8801

PostgreSQL (JheckBot Docker service)
localhost:8802

Devin CLI
/home/jeric/.local/bin/devin

Approved workspace
/home/jeric/Workspace
```

Existing projects currently use ports including 3000, 4000, 5433–5435, 6379–6380, 8080, and 9000–9003. JheckBot reserves 8800–8802 for its own web, API, and database host mapping. Recheck the reserved block before starting because port availability can change.

After the repository is scaffolded, run:

```bash
docker compose up -d postgres
pnpm install
pnpm dev
```

The agent runner remains blocked until `/usr/bin/tmux` is installed and validated. Do not start the agent integration against an unverified process supervisor.

Tests:

```bash
pnpm test
```

Build:

```bash
pnpm build
```

Lint:

```bash
pnpm lint
```

Type check:

```bash
pnpm typecheck
```

---

# 46. Docker Development

For the current local profile, Docker is used for PostgreSQL only. The Compose mapping must be host `8802` to container `5432`:

```yaml
ports:
  - "8802:5432"
```

Start the database with:

```bash
docker compose up -d postgres
```

Run Nuxt and Express from the host with:

```bash
pnpm dev
```

Do not start web/API containers in the local profile. The host-side agent runner needs the host Devin binary and host workspace, and starting both container and host Node processes would create duplicate services. A complete web/API/PostgreSQL Compose profile is deferred until the agent runner and path mapping are validated.

---

# 47. Production Deployment

The current feasible production target keeps the agent runner on the Ubuntu host:

```text
Android
   ↓
https://jheckbot.example.com
   ↓
Cloudflare Access
   ↓
Cloudflare Tunnel
   ↓
Ubuntu host
   │
   ├── JheckBot Web       :8800
   ├── JheckBot API       :8801 (internal only)
   ├── Host-side agent runner
   ├── PostgreSQL Docker service :8802 (internal only)
   ├── Devin CLI          /home/jeric/.local/bin/devin
   ├── tmux               required before deployment
   └── /home/jeric/Workspace
```

Only the web entrypoint should be reachable through the tunnel. The current host has the `cloudflared` binary but no verified tunnel configuration or active service, so Cloudflare deployment remains a later setup task. Full web/API containerization is not part of the current supported profile.

---

# 48. Cloudflare Tunnel

Run `cloudflared` on the Ubuntu host after creating and validating the tunnel configuration.

The current target is the host Nuxt entrypoint:

```text
http://localhost:8800
```

The web application should proxy `/api` to the host API at `http://localhost:8801`, or a local reverse proxy may perform the same routing:

```text
/
    → web :8800

/api
    → api :8801
```

The current `cloudflared` binary is installed, but no `~/.cloudflared` configuration directory or active `cloudflared` service was found. Do not treat tunnel support as configured until DNS, Access policy, ingress routing, and an end-to-end HTTPS check are complete.

Do not expose PostgreSQL, API, tmux, Devin, or agent ports directly.

---

# 49. Reverse Proxy

A reverse proxy may be used locally:

```text
Cloudflare Tunnel
       ↓
Nginx/Caddy
       ├── /
       │    ↓
       │   Nuxt
       │
       └── /api
            ↓
           Express
```

This is optional for the initial development environment.

---

# 50. TDD Requirements

Build using TDD.

## Backend tests

Test:

- Login
- Logout
- Authentication middleware
- Project creation
- Project path validation
- Allowed root validation
- Symlink/path traversal protection
- Project deletion
- Conversation creation
- Conversation isolation
- Message persistence
- Agent startup
- Agent stop
- Agent status
- SSE
- Reconnection
- Concurrent prompt protection
- Process failure recovery

## Frontend tests

Test:

- Login screen
- Project list
- Add project
- Project validation
- Conversation list
- New conversation
- Message sending
- Streaming output
- Agent status
- Stop button
- Reconnection
- History search

## E2E

At minimum:

```text
Login
 ↓
Select project
 ↓
Create conversation
 ↓
Send prompt
 ↓
Receive streamed agent output
 ↓
Refresh browser
 ↓
History remains
```

---

# 51. MVP Development Phases

## Phase 1 — Repository

Create:

```text
pnpm monorepo
Nuxt app
Express app
shared package
PostgreSQL
```

Success:

```text
docker compose up -d postgres
pnpm install
pnpm dev
```

works with Nuxt on `localhost:8800`, Express on `localhost:8801`, and the dedicated PostgreSQL container on `localhost:8802`.

---

## Phase 2 — Project Registry

Implement:

- allowed roots
- projects table
- project CRUD
- path validation
- project health check

Success:

```text
Add /home/jeric/Workspace/clients/lunchonline
```

and JheckBot validates it.

---

## Phase 3 — Devin Runner

Prerequisites:

- Devin CLI available at `/home/jeric/.local/bin/devin`
- Devin CLI authentication verified
- tmux installed and available at `/usr/bin/tmux`
- Host workspace permissions verified

Implement:

- Devin CLI detection
- process spawning
- PTY
- tmux
- output capture
- stop
- status
- session recovery using native Devin session IDs plus the live runner state

Success:

```text
JheckBot
 ↓
Host-side agent runner
 ↓
Devin CLI
 ↓
LunchOnline
```

works without the frontend. This phase cannot be considered complete while tmux is missing.

---

## Phase 4 — Conversations

Implement:

- conversation creation
- conversation persistence
- messages
- titles
- history

Success:

```text
Project
 ↓
Conversation
 ↓
Messages
```

survive API/browser restarts.

---

## Phase 5 — API

Implement:

- auth
- projects
- conversations
- messages
- agent lifecycle
- SSE

Success:

```text
HTTP client
 ↓
JheckBot API
 ↓
Devin
```

works.

---

## Phase 6 — Mobile UI

Implement:

- login
- home
- projects
- conversations
- chat
- streaming
- stop
- history

Success:

```text
Android Chrome
 ↓
JheckBot
 ↓
Devin
```

works.

---

## Phase 7 — PWA

Add:

- manifest
- service worker
- install experience
- app icons

---

## Phase 8 — Optional Full Docker Profile

The current MVP already uses Docker for its PostgreSQL development service. Full containerization is deferred:

```text
web
api
postgres
```

Before enabling this profile, verify that the agent runner can safely access the host-installed Devin CLI, PTY behavior, and the approved workspace through an explicit path mapping. Do not move Devin into a container by assumption.

---

## Phase 9 — Hardening Before Exposure

Implement before enabling remote access:

- rate limiting
- security headers
- secure cookies
- path security
- process limits
- graceful shutdown
- logging
- error handling
- session recovery
- disk-space monitoring

---

## Phase 10 — Cloudflare Exposure

After hardening, configure:

- Cloudflare Tunnel
- HTTPS
- Cloudflare Access
- DNS

The current host has the `cloudflared` binary but no verified tunnel configuration or active service.

---

# 52. MVP Definition of Done

JheckBot is considered MVP-complete when all of the following work:

```text
[ ] pnpm monorepo
[ ] Nuxt frontend
[ ] Express backend
[ ] PostgreSQL
[ ] Authentication
[ ] Allowed filesystem roots
[ ] Project CRUD
[ ] External project directories
[ ] Project path validation
[ ] Project health check
[ ] Conversation CRUD
[ ] Persistent message history
[ ] History search
[ ] Host-side Devin CLI integration
[ ] PTY/tmux agent sessions (tmux installed and validated)
[ ] Agent status
[ ] Prompt execution
[ ] Streaming output
[ ] Browser reconnection
[ ] Agent stop
[ ] Concurrent prompt protection
[ ] PWA
[ ] Docker Compose PostgreSQL development profile
[ ] Security validation before remote exposure
[ ] Unit tests
[ ] API tests
[ ] E2E test
[ ] Production deployment documentation
[ ] Cloudflare Tunnel deployment gate
[ ] Cloudflare Access deployment gate
```

---

# 53. Example End-to-End Scenario

User opens JheckBot from Android.

```text
JheckBot
```

Selects:

```text
LunchOnline
```

Creates:

```text
Fix restaurant checkout
```

Sends:

```text
Investigate why restaurant checkout is failing on mobile.

Run the relevant tests first.
Fix the issue if you find it.
Do not commit or push anything.
```

JheckBot:

```text
Conversation saved.
Starting Devin...
```

Devin runs locally:

```text
cd /home/jeric/Workspace/clients/lunchonline
```

Output streams:

```text
Inspecting checkout flow...
Running tests...
3 tests failing...
Inspecting mobile checkout component...
Updating validation...
Running tests again...
47 passed...
```

The user closes the phone.

Devin continues through the host-side tmux runner. This step is not supported until tmux is installed and the live-process recovery path is verified.

Thirty minutes later, the user opens JheckBot.

The conversation is still available:

```text
Fix restaurant checkout
```

JheckBot reconnects to the agent session and displays the final output.

The entire history remains stored in PostgreSQL.

---

# 54. Future Architecture

The MVP should leave room for multiple agent backends:

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

Likewise, projects can remain independent:

```text
JheckBot
│
├── LunchOnline
│   ├── conversation A
│   └── conversation B
│
├── ExpresswayPH
│   └── conversation C
│
├── Adzeela
│   └── conversation D
│
└── Future Project
    └── conversation E
```

The core security boundary remains:

```text
Project ID
    ↓
Approved filesystem path
    ↓
Allowed root validation
    ↓
Agent working directory
```

---

# 55. Guiding Principles

1. **JheckBot is a control plane, not the coding agent.**
2. **Devin CLI remains responsible for development work.**
3. **Projects remain outside the JheckBot repository.**
4. **Only explicitly configured project directories are available.**
5. **The browser never sends arbitrary filesystem paths for execution.**
6. **The browser never gets a raw shell API.**
7. **Conversation history is persistent and project-specific.**
8. **Agent sessions must survive browser disconnection.**
9. **Use pnpm throughout the project.**
10. **Use TDD for core functionality.**
11. **Keep the MVP small before adding autonomous features.**
12. **Security is critical because the agent can execute commands on the development machine.**

---

# 56. Recommended MVP Stack Summary

```text
JheckBot
│
├── Frontend
│   ├── Nuxt 4
│   ├── Vue 3
│   ├── TypeScript
│   ├── Tailwind
│   └── PWA
│
├── Backend
│   ├── Node.js
│   ├── Express.js
│   └── TypeScript
│
├── Database
│   └── PostgreSQL
│
├── Package Manager
│   └── pnpm
│
├── Agent (host-side)
│   └── Devin CLI at /home/jeric/.local/bin/devin
│
├── Process (host-side)
│   ├── PTY
│   └── tmux (required; currently missing)
│
├── Realtime
│   └── SSE
│
├── Infrastructure
│   ├── Docker (PostgreSQL development profile)
│   ├── Docker Compose (PostgreSQL development profile)
│   ├── Cloudflare Tunnel (deployment gate)
│   └── Cloudflare Access (deployment gate)
│
└── Testing
    ├── Vitest
    ├── Supertest
    └── Playwright
```

## Final MVP Architecture

The current supported architecture is hybrid: web/API/agent processes run on the host, while PostgreSQL runs in its dedicated Docker service.

```text
Android
   │
   │ HTTPS (after Cloudflare setup)
   ▼
Cloudflare Access
   │
Cloudflare Tunnel → http://localhost:8800
   │
   ▼
Ubuntu host
├── Nuxt PWA :8800
│   └── /api proxy → Express API :8801
├── Express API + AgentManager :8801
│   └── TmuxManager → Devin CLI
│       /home/jeric/.local/bin/devin
├── cloudflared (installed; configuration pending)
└── /home/jeric/Workspace
    ├── clients/lunchonline
    ├── clients/adzeela
    └── personal/expresswayph

Docker on the same host
└── JheckBot PostgreSQL :8802
```

The web/API host profile is intentional until a full container profile proves that Devin, PTY/tmux, and the approved workspace can be isolated and mapped safely. The current host cannot complete the live-agent path until tmux is installed.

The MVP should prioritize getting this complete loop working reliably:

```text
📱 Prompt
   ↓
JheckBot
   ↓
Project lookup
   ↓
Path security validation
   ↓
Devin CLI
   ↓
Local project
   ↓
Streaming output
   ↓
📱 Chat history
```
