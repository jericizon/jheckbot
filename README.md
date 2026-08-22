# JheckBot

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A self-hosted, mobile-first coding assistant UI that lets you control a locally installed agent CLI from your phone or browser. JheckBot provides a chat interface, project management, persistent conversation history, and streaming agent output — all behind your own authentication and HTTPS boundary.

**Current provider:** [Devin CLI](https://devin.ai) is the built-in agent provider. Support for other agent CLIs (Codex, Claude Code, Gemini CLI) is planned via a provider abstraction layer.

## Architecture

```text
Phone / Browser
    ↓ HTTPS
Reverse proxy (Nginx, Caddy, or Cloudflare Tunnel)
    ↓
JheckBot web (Nuxt) + API (Express)
    ↓
Agent CLI (Devin) in tmux session
    ↓
Approved project directory (Git repository under configured root)
```

JheckBot is a **control plane**, not the coding agent itself. Your projects live outside the JheckBot repository; JheckBot only stores metadata and validated filesystem paths.

## Prerequisites

- **Node.js** 24+
- **pnpm** 11+
- **Docker** and Docker Compose
- **Devin CLI** installed and authenticated
- **tmux** (required for agent session persistence)

## Quick Start

```bash
# 1. Create your environment file
cp .env.example .env

# 2. Configure all required values in .env
#    Generate a session secret:  openssl rand -hex 32
#    Set a strong admin password (>= 12 characters)
#    Set ALLOWED_ROOTS to your project workspace root(s)

# 3. Start PostgreSQL
docker compose up -d postgres

# 4. Install dependencies
pnpm install

# 5. Start development servers
pnpm dev
```

- Web: http://localhost:8800
- API: http://localhost:8801
- PostgreSQL: localhost:8802

## Share via Cloudflare Tunnel

With `pnpm dev` running, expose the local dev server to a public URL:

```bash
pnpm tunnel
```

This creates an ephemeral `*.trycloudflare.com` URL. Quick Tunnels are intended
for testing only and do not support Server-Sent Events (SSE), so live agent
output in the chat may not work. For a production tunnel with full feature
support, see [deploy/README.md](deploy/README.md).

## Reserved Ports

| Port | Service |
|------|---------|
| 8800 | Nuxt web |
| 8801 | Express API |
| 8802 | PostgreSQL (host mapping to container 5432) |

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start web and API in development mode |
| `pnpm dev:clean` | Free reserved development ports (8800, 8801, 8802) |
| `pnpm build` | Build all packages |
| `pnpm test` | Run all tests |
| `pnpm typecheck` | Type-check all packages |
| `pnpm lint` | Lint all packages |
| `pnpm format` | Format code with Prettier |

## Project Structure

```
jheckbot/
├── apps/
│   ├── api/          # Express API + agent runner
│   └── web/          # Nuxt web application (PWA)
├── packages/
│   └── shared/       # Shared types, constants, validation
├── deploy/           # Deployment templates
├── docs/             # Architecture documentation
└── docker-compose.yml
```

## Documentation

- [Architecture reference](docs/mvp.md) — core concepts, data model, SSE, security model
- [Screenshots](docs/screenshots.md) — agent-captured browser screenshots inline in chat
- [Deployment guide](deploy/README.md) — production setup, Cloudflare Tunnel, security checklist
- [Contributing guide](CONTRIBUTING.md) — setup, testing, PR guidelines
- [Security policy](SECURITY.md) — vulnerability reporting, hardening requirements

## License

[MIT](LICENSE) — Copyright (c) 2026 JheckBot contributors
