# JheckBot

A self-hosted, mobile-first development assistant for controlling a locally installed Devin CLI from an Android phone.

## Architecture

```text
Android Phone
    ↓ HTTPS
Cloudflare Access / Cloudflare Tunnel
    ↓
JheckBot web application and API on Ubuntu
    ↓
Devin CLI
    ↓
Approved external project directory
```

## Prerequisites

- Node.js >= 24
- pnpm >= 11
- Docker and Docker Compose
- Devin CLI installed and authenticated
- tmux (required for Phase 3+ agent persistence)

## Reserved Ports

| Port | Service |
|------|---------|
| 8800 | Nuxt web |
| 8801 | Express API |
| 8802 | PostgreSQL (host mapping to container 5432) |

## Quick Start

```bash
cp .env.example .env
# Edit .env with your local values

docker compose up -d postgres
pnpm install
pnpm dev
```

- Web: http://localhost:8800
- API: http://localhost:8801
- PostgreSQL: localhost:8802

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start web and API in development mode |
| `pnpm build` | Build all packages |
| `pnpm test` | Run all tests |
| `pnpm typecheck` | Type-check all packages |
| `pnpm lint` | Lint all packages |
| `pnpm format` | Format code with Prettier |

## Documentation

See [docs/mvp.md](docs/mvp.md) for the full MVP specification.
