# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in JheckBot, please report it responsibly:

1. **Do not open a public GitHub issue.**
2. Use [GitHub Security Advisories](https://github.com/security/advisories/new) to privately report the vulnerability to the repository maintainers.
3. Include a clear description of the issue, steps to reproduce, and the potential impact.
4. Do not include real credentials, tokens, or session data in your report.

We will acknowledge your report within 72 hours and work with you on a fix and disclosure timeline.

## Supported Versions

| Version | Supported |
|---------|-----------|
| Latest major | Yes |
| Older versions | No |

JheckBot is a young project; only the latest major version receives security updates.

## Deployment Hardening Requirements

JheckBot runs an agent CLI that can execute commands on the host filesystem. The following hardening steps are **required** for any deployment that is reachable beyond a local development machine.

### Secrets

- **SESSION_SECRET**: Generate a strong random string of at least 32 characters:
  ```bash
  openssl rand -hex 32
  ```
  Never reuse a development secret in production.
- **ADMIN_PASSWORD**: Use a strong password of at least 12 characters. Change it after first login.
- **POSTGRES_PASSWORD**: Use a strong, unique database password. Never use placeholder values.

### Cookies and Transport

- Set `COOKIE_SECURE=true` in production so session cookies are only sent over HTTPS.
- Set `COOKIE_SAME_SITE=none` when serving the web and API from the same origin behind a reverse proxy, or `strict` when same-origin.
- Use HTTPS end-to-end. A reverse proxy or Cloudflare Tunnel is required; never expose the API directly over HTTP.

### Network Isolation

- **Do not expose the API port (8801) externally.** The API should only be reachable through the web server's reverse proxy or internally.
- **Do not expose the PostgreSQL port (8802) externally.** PostgreSQL should only be accessible from the API process.
- Only the web entrypoint (port 8800) should be reachable through a tunnel or reverse proxy.

### Filesystem Roots

- Restrict `ALLOWED_ROOTS` to specific project directories. Do not allow broad roots like `/` or a home directory.
- Every project must be a Git repository under an enabled allowed root.
- The agent runner validates the resolved path before every launch.

### Post-Install Checklist

- [ ] `.env` is not committed to git
- [ ] `SESSION_SECRET` is a strong random string (>= 32 chars)
- [ ] `ADMIN_PASSWORD` is strong (>= 12 chars) and changed after first login
- [ ] `COOKIE_SECURE=true` in production
- [ ] API port (8801) is not exposed externally
- [ ] PostgreSQL port (8802) is not exposed externally
- [ ] HTTPS is enforced (reverse proxy or Cloudflare Tunnel)
- [ ] `ALLOWED_ROOTS` is restricted to specific project directories
- [ ] Rate limiting is active (login, API, and message endpoints)
