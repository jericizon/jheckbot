# Contributing to JheckBot

Thank you for your interest in contributing to JheckBot! This guide covers setup, development workflows, and pull-request expectations.

## Prerequisites

- **Node.js** 24+
- **pnpm** 11+
- **Docker** and Docker Compose
- **Devin CLI** installed and authenticated (current built-in agent provider)
- **tmux** (required for agent session persistence)

## Setup

```bash
# 1. Clone the repository
git clone <repository-url>
cd jheckbot

# 2. Create your environment file from the template
cp .env.example .env

# 3. Configure all required values in .env
#    - Generate a session secret:  openssl rand -hex 32
#    - Set a strong admin password (>= 12 characters)
#    - Set ALLOWED_ROOTS to your project workspace root(s)
#    - Set DEVIN_BIN and TMUX_BIN (command names or absolute paths)
#    - Set DATABASE_URL and POSTGRES_PASSWORD

# 4. Start PostgreSQL
docker compose up -d postgres

# 5. Install dependencies
pnpm install

# 6. Start development servers
pnpm dev
```

- Web: http://localhost:8800
- API: http://localhost:8801
- PostgreSQL: localhost:8802

## Development

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start web and API in development mode |
| `pnpm dev:clean` | Free reserved development ports (8800, 8801, 8802) |
| `pnpm build` | Build all packages |
| `pnpm test` | Run all tests |
| `pnpm typecheck` | Type-check all packages |
| `pnpm lint` | Lint all packages |
| `pnpm format` | Format code with Prettier |

### Focused tests

Run tests for a single package:

```bash
pnpm --filter @jheckbot/api test -- --run
```

Run a specific test file:

```bash
pnpm --filter @jheckbot/api test -- --run tests/path-validator.test.ts
```

## Project Structure

```
jheckbot/
├── apps/
│   ├── api/          # Express API + agent runner
│   └── web/          # Nuxt web application
├── packages/
│   └── shared/       # Shared types, constants, validation
├── deploy/           # Deployment templates (Cloudflare Tunnel, etc.)
├── docs/             # Architecture and design documentation
└── docker-compose.yml
```

## Pull Request Guidelines

- **Keep changes small and focused.** One logical change per PR.
- **Run tests before submitting.** Ensure `pnpm test` and `pnpm typecheck` pass.
- **Run formatting.** Use `pnpm format` before committing.
- **Never commit `.env`.** The `.env` file contains secrets and is git-ignored. Only `.env.example` is tracked.
- **Never commit real project data.** Do not include personal filesystem paths, private project names, credentials, or session data in code, tests, or documentation.
- **Use generic examples.** In documentation and tests, use paths like `/workspace/projects/example-repo` and placeholders like `<YOUR_DOMAIN>`.
- **Write clear commit messages.** Use [Conventional Commits](https://www.conventionalcommits.org/) format (e.g., `feat(api): add project health endpoint`).

## Reporting Issues

Use GitHub Issues to report bugs or request features. Include:

- Steps to reproduce
- Expected vs. actual behavior
- Relevant logs (without secrets, cookies, or tokens)
- Your environment (OS, Node.js version, pnpm version)

## License

By contributing, you agree that your contributions are licensed under the [MIT License](LICENSE).
