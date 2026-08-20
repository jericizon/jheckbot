# JheckBot Deployment Guide

## Current Architecture

```text
Android Phone
    ↓ HTTPS
Cloudflare Access / Cloudflare Tunnel
    ↓
Ubuntu host
├── Nuxt PWA :8800 (proxies /api to :8801)
├── Express API + AgentManager :8801 (internal only)
├── Host-side agent runner (tmux + Devin CLI)
├── PostgreSQL Docker service :8802 (internal only)
├── Devin CLI: /home/jeric/.local/bin/devin
├── tmux: /usr/bin/tmux
└── /home/jeric/Workspace (approved workspace root)
```

## Local Development

```bash
# 1. Start PostgreSQL
docker compose up -d postgres

# 2. Copy .env.example to .env and fill in secrets
cp .env.example .env
# Edit .env with your DATABASE_URL and SESSION_SECRET

# 3. Install dependencies
pnpm install

# 4. Run development servers
pnpm dev
```

- Nuxt: http://localhost:8800
- Express API: http://localhost:8801
- PostgreSQL: localhost:8802

## Production Setup

### Prerequisites

- Ubuntu host with:
  - Node.js 24+ (via nvm)
  - pnpm 11+
  - Docker Engine + Docker Compose
  - Devin CLI at `/home/jeric/.local/bin/devin`
  - tmux at `/usr/bin/tmux`
  - cloudflared installed
- Cloudflare account with:
  - A domain managed by Cloudflare DNS
  - Cloudflare Zero Trust (Access) enabled

### Step 1: Build

```bash
pnpm install
pnpm build
```

### Step 2: Configure Environment

Create `.env` with production values:

```env
NODE_ENV=production
API_PORT=8801
WEB_PORT=8800
POSTGRES_HOST_PORT=8802
DATABASE_URL=postgresql://jheckbot:<strong-password>@127.0.0.1:8802/jheckbot
SESSION_SECRET=<generate-a-64-char-random-string>
DEVIN_BIN=/home/jeric/.local/bin/devin
TMUX_BIN=/usr/bin/tmux
ALLOWED_ROOTS=/home/jeric/Workspace
COOKIE_SECURE=true
COOKIE_SAME_SITE=none
```

### Step 3: Start PostgreSQL

```bash
docker compose up -d postgres
```

### Step 4: Start the API

```bash
cd apps/api
node dist/server.js
```

The API runs migrations and seeds the default admin user on first startup.
Default credentials: `admin` / `admin` — **change the password immediately**.

### Step 5: Start the Web Server

```bash
cd apps/web
node .output/server/index.mjs
```

### Step 6: Cloudflare Tunnel

```bash
# Login to Cloudflare
cloudflared tunnel login

# Create the tunnel
cloudflared tunnel create jheckbot

# Copy the config template
cp deploy/cloudflared/config.yml ~/.cloudflared/config.yml
# Edit ~/.cloudflared/config.yml with your tunnel UUID and domain

# Add DNS route
cloudflared tunnel route dns jheckbot jheckbot.yourdomain.com

# Install as a system service
sudo cloudflared service install
```

### Step 7: Cloudflare Access

In the Cloudflare Zero Trust dashboard:

1. Go to Access → Applications → Add an application
2. Select Self-hosted
3. Set the application domain to `jheckbot.yourdomain.com`
4. Configure an access policy (e.g., email-based for your account)
5. Save

### Step 8: Verify

- Visit `https://jheckbot.yourdomain.com`
- You should see the Cloudflare Access login page
- After authenticating, you should see the JheckBot login page
- Login with `admin` / `admin`
- Change the admin password via the API

## Security Checklist

- [ ] `.env` file is not committed to git
- [ ] `SESSION_SECRET` is a strong random string
- [ ] `COOKIE_SECURE=true` in production
- [ ] Default admin password changed
- [ ] Cloudflare Access policy is configured
- [ ] PostgreSQL port (8802) is not exposed externally
- [ ] API port (8801) is not exposed externally
- [ ] Only port 8800 is reachable through the tunnel
- [ ] Allowed roots are restricted to `/home/jeric/Workspace`
- [ ] Rate limiting is active (login: 10/15min, API: 100/min, messages: 30/min)

## Full Docker Profile (Deferred)

Full containerization (web + api + postgres in Docker) is deferred until the
agent runner can safely access the host-installed Devin CLI, PTY behavior, and
the approved workspace through an explicit path mapping. Do not move Devin
into a container by assumption.

The current profile uses Docker for PostgreSQL only, with web/API/agent
processes running on the host. This is intentional.
