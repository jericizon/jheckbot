# JheckBot Deployment Guide

## Architecture

```text
Phone / Browser
    ↓ HTTPS
Reverse proxy (Cloudflare Tunnel, Nginx, or Caddy)
    ↓
Host
├── Nuxt web :8800 (proxies /api to :8801)
├── Express API + AgentManager :8801 (internal only)
├── Host-side agent runner (tmux + Devin CLI)
├── PostgreSQL Docker service :8802 (internal only)
├── Devin CLI (configured via DEVIN_BIN)
├── tmux (configured via TMUX_BIN)
└── Configured workspace root(s) (via ALLOWED_ROOTS)
```

## Local Development

```bash
# 1. Create your environment file
cp .env.example .env
# Configure all required values (DATABASE_URL, SESSION_SECRET, etc.)

# 2. Start PostgreSQL
docker compose up -d postgres

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

- A host with:
  - Node.js 24+
  - pnpm 11+
  - Docker Engine + Docker Compose
  - Devin CLI installed and authenticated
  - tmux installed
  - A reverse proxy or tunnel daemon (e.g., cloudflared, Nginx, Caddy)
- A domain with DNS managed by your proxy provider (if using Cloudflare Tunnel)

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
SESSION_SECRET=<64-char-random-string-from-openssl-rand-hex-32>
DEVIN_BIN=devin
TMUX_BIN=tmux
ALLOWED_ROOTS=/workspace/projects
COOKIE_SECURE=true
COOKIE_SAME_SITE=none
ADMIN_USERNAME=admin
ADMIN_PASSWORD=<strong-password-12+-chars>
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

The API runs migrations and creates the configured admin user on first startup. Change the admin password after first login.

### Step 5: Start the Web Server

```bash
cd apps/web
node .output/server/index.mjs
```

### Step 6: Cloudflare Tunnel (Optional)

If using Cloudflare Tunnel for HTTPS and access control:

```bash
# Login to Cloudflare
cloudflared tunnel login

# Create the tunnel
cloudflared tunnel create jheckbot

# Copy the config template
cp deploy/cloudflared/config.yml /path/to/.cloudflared/config.yml
# Edit the config with your tunnel UUID and domain

# Add DNS route
cloudflared tunnel route dns jheckbot <YOUR_DOMAIN>

# Install as a system service
sudo cloudflared service install
```

### Step 7: Cloudflare Access (Optional)

In the Cloudflare Zero Trust dashboard:

1. Go to Access → Applications → Add an application
2. Select Self-hosted
3. Set the application domain to `<YOUR_DOMAIN>`
4. Configure an access policy (e.g., email-based)
5. Save

### Step 8: Verify

- Visit `https://<YOUR_DOMAIN>`
- Authenticate through your proxy/access layer
- Login with the admin credentials you configured in `.env`
- Change the admin password after first login

## Security Checklist

- [ ] `.env` file is not committed to git
- [ ] `SESSION_SECRET` is a strong random string (>= 32 chars)
- [ ] `ADMIN_PASSWORD` is strong (>= 12 chars) and changed after first login
- [ ] `COOKIE_SECURE=true` in production
- [ ] API port (8801) is not exposed externally
- [ ] PostgreSQL port (8802) is not exposed externally
- [ ] Only port 8800 is reachable through the tunnel/proxy
- [ ] `ALLOWED_ROOTS` is restricted to specific project directories
- [ ] HTTPS is enforced (Cloudflare Tunnel or reverse proxy)
- [ ] Rate limiting is active (login: 10/15min, API: 100/min, messages: 30/min)

## Full Docker Profile (Deferred)

Full containerization (web + api + postgres in Docker) is deferred until the
agent runner can safely access the host-installed Devin CLI, PTY behavior, and
the approved workspace through an explicit path mapping. Do not move Devin
into a container by assumption.

The current profile uses Docker for PostgreSQL only, with web/API/agent
processes running on the host. This is intentional.
