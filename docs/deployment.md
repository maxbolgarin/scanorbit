# Production deployment

`docker compose up -d` will get ScanOrbit running. This page lists what to
tighten before exposing it beyond your laptop.

## Pre-flight checklist

1. **Generate the four secrets.** ScanOrbit refuses to start in production
   mode if any of `JWT_SECRET`, `JWT_REFRESH_SECRET`, `OAUTH_ENCRYPTION_KEY`,
   `TOTP_ENCRYPTION_KEY` are blank. Use `openssl rand -hex 32` per secret.
2. **Pick an auth mode.** Default (`AUTH_ENABLED=false`) is single-user — every
   request is treated as a built-in admin. Safe on a private network or behind
   a VPN; **never expose it on the public internet**. Flip to
   `AUTH_ENABLED=true` for the full email/password + OAuth + 2FA flow.
3. **Set `FRONTEND_URL`.** This drives cookie scope and email links. Match it
   to the URL your users will actually hit (including scheme and host).
4. **Set `TRUSTED_PROXIES`.** Comma-separated list of IPs/CIDRs whose
   `X-Forwarded-For` header to trust. Set this to the IP of your reverse proxy
   so rate limiting, audit logs and OAuth state see real client IPs.
5. **Set `COOKIE_DOMAIN`** if the API and app live on different subdomains
   (for example, `.example.com` covers `app.example.com` and `api.example.com`).
   Leave empty for single-host deployments.

## Health checks

The API exposes two endpoints:

| Endpoint | Purpose |
| --- | --- |
| `GET /health` | Liveness — process is up. Always 200. |
| `GET /health/ready` | Readiness — pings PostgreSQL and Redis. 200 if both healthy, 503 otherwise. |

Wire `/health/ready` into your orchestrator's readiness probe. The bundled
Docker Compose already runs `pg_isready` and `redis-cli ping` for the
backing services.

## Restart policy

The Compose file uses `restart: unless-stopped` for every long-running
service. If you orchestrate by hand (systemd, Nomad, k8s), match that — the
workers and API are stateless and safe to restart at any time.

## Migrations

The `migrate` service runs on every `docker compose up` and exits cleanly
once schema is current. The API, scanner and analyzer all `depends_on:
service_completed_successfully` for it, so they won't start against a stale
schema.

For upgrades, pull a new image and `docker compose up -d` — the migrate
container will run any new migrations before the API restarts.

## Where to go next

- [TLS and reverse proxy](./tls-and-reverse-proxy.md)
- [AWS IAM permissions](./aws-iam.md)
- [Backups](./backup-restore.md)
- [Observability](./observability.md)
