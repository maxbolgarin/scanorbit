# Docker Compose Production Stack

This document describes all services in `deploy/docker-compose.prod.yml`, how they interact, and their configuration.

## Architecture Overview

```
                        Internet
                           │
                    ┌──────┴──────┐
                    │    Caddy    │  :80, :443
                    │  (TLS/proxy)│
                    └──────┬──────┘
           ┌───────┬───────┼───────┬──────────┐
           │       │       │       │          │
       landing    app    api    umami    maxbolgarin
       (Astro)  (React) (Hono) (Analytics)  (Web)
        :80      :80    :4000   :3000        :80
                           │
                    ┌──────┴──────┐
                    │             │
                 postgres      redis
                  :5432        :6379
                    │             │
           ┌────┬──┴──┬────┐     │
           │    │     │    │     │
        scanner analyzer  umami  │
        (Go)    (Go)       │     │
        :9090   :9091      │     │
           │       │       │     │
           └───┬───┘       │     │
               │           │     │
          ┌────┴─────────┐ │     │
          │  Prometheus  │ │     │
          │    :9092     │ │     │
          └──────┬───────┘ │     │
                 │         │     │
          ┌──────┴──────┐  │     │
          │   Grafana   │  │     │
          │    :3001    │  │     │
          └─────────────┘  │     │
                           │     │
    ┌──────────────────────┘     │
    │  postgres-exporter         │
    │  redis-exporter ───────────┘
    │  loki / promtail
    │  alertmanager :9093
    └─────────────────────
```

## Domain Routing (Caddyfile)

| Domain | Service | Description |
|--------|---------|-------------|
| `{DOMAIN}` | `landing:80` | Astro landing page |
| `www.{DOMAIN}` | redirect | 301 redirect to root domain |
| `app.{DOMAIN}` | `app:80` + `api:4000` | React SPA; `/api/*`, `/auth/*`, `/orgs*`, `/aws/*`, `/resources*`, `/findings*` routes proxy to API |
| `api.{DOMAIN}` | `api:4000` | Direct API access |
| `{DOMAIN}/t.js`, `{DOMAIN}/collect` | `umami:3000` | Umami tracking script and event collection (dashboard not public) |
| `app.{DOMAIN}/t.js`, `app.{DOMAIN}/collect` | `umami:3000` | Umami tracking for app subdomain |
| `maxbolgarin.com` | `maxbolgarin:80` | Personal website |

All domains get automatic TLS certificates from Let's Encrypt via Caddy. A shared `block_scanners` snippet returns 404 for dotfile paths and common vulnerability scanner probes (WordPress, Swagger, actuator, etc.).

---

## Services

### Core Application

#### caddy
**Image:** `caddy:2-alpine`
**Ports:** 80, 443, 443/udp (HTTP/3)
**Role:** Reverse proxy and TLS termination. Routes requests to backend services based on domain. Handles automatic Let's Encrypt certificate provisioning and renewal.

| Env Var | Description |
|---------|-------------|
| `DOMAIN` | Base domain for routing (e.g., `scanorbit.cloud`) |
| `ADMIN_EMAIL` | Email for Let's Encrypt notifications |

**Volumes:** Caddyfile (read-only), persistent cert data and config.
**Depends on:** api (healthy), app (started), landing (started), umami (healthy).

---

#### api
**Image:** `ghcr.io/{GITHUB_REPOSITORY}/api:{IMAGE_TAG}`
**Internal port:** 4000
**Role:** Node.js/Hono REST API. Handles authentication (JWT, OAuth, 2FA), AWS account management, resource/findings queries, Stripe billing, and email.

| Env Var | Default | Description |
|---------|---------|-------------|
| `PORT` | `4000` | API listen port |
| `LOG_LEVEL` | `info` | Logging level: debug/info/warn/error |
| `DATABASE_URL` | — | PostgreSQL connection string |
| `REDIS_URL` | — | Redis connection string (TLS) |
| `JWT_SECRET` | — | Access token signing key |
| `JWT_REFRESH_SECRET` | — | Refresh token signing key |
| `TOTP_ENCRYPTION_KEY` | — | AES key for 2FA secrets |
| `OAUTH_ENCRYPTION_KEY` | — | AES key for OAuth tokens |
| `GOOGLE_CLIENT_ID/SECRET` | — | Google OAuth credentials |
| `GITHUB_CLIENT_ID/SECRET` | — | GitHub OAuth credentials |
| `FRONTEND_URL` | — | CORS origin (e.g., `https://app.scanorbit.cloud`) |
| `COOKIE_DOMAIN` | — | Cross-subdomain cookie domain (e.g., `.scanorbit.cloud`) |
| `AWS_REGION` | `eu-central-1` | Default region for STS |
| `AWS_ACCESS_KEY_ID/SECRET_ACCESS_KEY` | — | AWS credentials for AssumeRole |
| `TRUSTED_PROXIES` | `127.0.0.1,::1` | Trusted IPs for x-forwarded-for |
| `EMAIL_PROVIDER` | `smtp` | Email backend: `smtp` or `resend` |
| `STRIPE_SECRET_KEY` | — | Stripe API key (optional) |
| `STRIPE_WEBHOOK_SECRET` | — | Stripe webhook signing secret |

**Healthcheck:** `GET /health` on port 4000.
**Depends on:** migrate (completed), postgres (healthy), redis (healthy).
**Auto-updated by Watchtower:** Yes.

---

#### app
**Image:** `ghcr.io/{GITHUB_REPOSITORY}/app:{IMAGE_TAG}`
**Internal port:** 80 (Nginx serving static React build)
**Role:** React 19 SPA (Vite build). The user-facing dashboard for scanning, analysis, and account management. Served as static files by Nginx.

No environment variables at runtime — all config is baked in at build time via Vite (`VITE_API_URL`, `VITE_SCANORBIT_AWS_ACCOUNT_ID`).

**Auto-updated by Watchtower:** Yes.

---

#### landing
**Image:** `ghcr.io/{GITHUB_REPOSITORY}/landing:{IMAGE_TAG}`
**Internal port:** 80 (Nginx serving static Astro build)
**Role:** Astro 5 static marketing site. Public-facing landing page with legal pages (privacy, terms, cookies, security, contact).

No environment variables at runtime.

**Auto-updated by Watchtower:** Yes.

---

### Background Workers

#### scanner
**Image:** `ghcr.io/{GITHUB_REPOSITORY}/scanner:{IMAGE_TAG}`
**Metrics port:** 9090 (localhost only)
**Role:** Go worker that discovers AWS resources (EC2, EBS, RDS, S3, ALB, ACM, Lambda, IAM, KMS, Secrets Manager). Picks scan jobs from the Redis queue, stores results in PostgreSQL.

| Env Var | Default | Description |
|---------|---------|-------------|
| `DATABASE_URL` | — | PostgreSQL connection string |
| `REDIS_URL` | — | Redis connection string (TLS) |
| `AWS_REGION` | `eu-central-1` | Default AWS region |
| `AWS_ACCESS_KEY_ID/SECRET_ACCESS_KEY` | — | AWS credentials for cross-account AssumeRole |
| `SCAN_CONCURRENCY` | `10` | Max concurrent region scans per account |
| `SCAN_TIMEOUT_MINUTES` | `60` | Overall scan timeout |
| `SHUTDOWN_TIMEOUT_SECONDS` | `30` | Graceful shutdown wait time |
| `REQUIRED_TAGS` | — | Comma-separated required tag keys |
| `OAUTH_ENCRYPTION_KEY` | — | For decrypting stored OAuth tokens |

**Healthcheck:** `GET /health` on port 9090.
**Depends on:** migrate (completed), postgres (healthy), redis (healthy).
**Auto-updated by Watchtower:** Yes.

---

#### analyzer
**Image:** `ghcr.io/{GITHUB_REPOSITORY}/analyzer:{IMAGE_TAG}`
**Metrics port:** 9091 (localhost only)
**Role:** Go worker that performs security analysis on scanned resources. Detects orphaned resources, expiring SSL certificates, permissive security groups, IAM issues, cost optimization opportunities, tagging compliance, and GDPR residency violations.

| Env Var | Default | Description |
|---------|---------|-------------|
| `DATABASE_URL` | — | PostgreSQL connection string |
| `REDIS_URL` | — | Redis connection string (TLS) |
| `SHUTDOWN_TIMEOUT_SECONDS` | `30` | Graceful shutdown wait time |
| `OAUTH_ENCRYPTION_KEY` | — | For decrypting stored OAuth tokens |

**Healthcheck:** `GET /health` on port 9091.
**Depends on:** migrate (completed), postgres (healthy), redis (healthy).
**Auto-updated by Watchtower:** Yes.

---

### Data Stores

#### postgres
**Image:** `postgres:17-alpine`
**Internal port:** 5432 (not exposed externally)
**Role:** Primary database for all application data, scan results, findings, users, audit logs.

**SSL/TLS:** Enabled. The entrypoint copies TLS certificates, fixes permissions, and starts PostgreSQL with `ssl=on`. All clients connect with `sslmode=require`.

| Env Var | Default | Description |
|---------|---------|-------------|
| `POSTGRES_USER` | `scanorbit` | Database superuser |
| `POSTGRES_PASSWORD` | — | Database password |
| `POSTGRES_DB` | `scanorbit` | Default database name |

**Logging:** `log_statement=mod`, `log_connections=on`, `log_disconnections=on`.
**Volumes:** `postgres_data` (persistent), TLS certs (read-only).
**Healthcheck:** `pg_isready` every 10s.

**Databases on this instance:**
- `scanorbit` — main application database
- `umami` — analytics database (created by `umami-db-init`)

---

#### redis
**Image:** `redis:7-alpine`
**Internal port:** 6379 (TLS only, not exposed externally)
**Role:** Job queue (scanner/analyzer tasks) and caching layer.

**TLS:** Enabled. Plain-text port disabled (`--port 0`). The entrypoint copies TLS certificates and starts Redis with TLS and password auth.

**Configuration** (`deploy/redis.conf`):
- Memory: 512MB max, `volatile-lru` eviction policy
- Persistence: RDB snapshots + AOF (append-only file) with hybrid preamble
- Connections: max 1000 clients, 300s idle timeout, TCP keepalive
- Performance: Active defragmentation, lazy freeing, 4 IO threads
- Security: `FLUSHDB`, `FLUSHALL`, `DEBUG` disabled; `CONFIG` and `SHUTDOWN` renamed
- Slow log: queries > 10ms, latency monitoring at 100ms threshold

**Volumes:** `redis_data` (persistent), TLS certs (read-only), redis.conf (read-only).
**Healthcheck:** `redis-cli ping` with TLS every 10s.

---

### Analytics

#### umami-db-init
**Image:** `postgres:17-alpine`
**Role:** One-shot init container. Creates the `umami` database on the existing PostgreSQL instance if it doesn't already exist. Runs once and exits.

**Depends on:** postgres (healthy).

---

#### umami
**Image:** `docker.umami.is/umami-software/umami:postgresql-latest`
**Internal port:** 3000
**Host port:** 3002 (localhost only — access via SSH tunnel)
**Role:** Self-hosted privacy-first web analytics. Cookie-free, GDPR compliant. The dashboard is not publicly accessible — use `make tunnel-umami` to access it at `http://localhost:3002`. Only the tracking script (`/t.js`) and event endpoint (`/collect`) are exposed through Caddy on both domains.

| Env Var | Description |
|---------|-------------|
| `DATABASE_URL` | PostgreSQL connection to `umami` database |
| `APP_SECRET` | Random secret for Umami sessions (`UMAMI_APP_SECRET` in `.env`) |
| `TRACKER_SCRIPT_NAME` | `t` — serves tracking script as `/t.js` |
| `COLLECT_API_ENDPOINT` | `/collect` — custom event collection endpoint |

**Healthcheck:** `GET /api/heartbeat` on port 3000.
**Depends on:** umami-db-init (completed).

**First-time setup:** Run `make tunnel-umami`, visit `http://localhost:3002`, log in with `admin`/`umami`, change the password, create two website entries (one for the root domain, one for `app.{DOMAIN}`), and put the generated website IDs into the tracking scripts.

---

### Database Migrations

#### migrate
**Image:** `ghcr.io/{GITHUB_REPOSITORY}/api:{IMAGE_TAG}`
**Role:** One-shot container that runs Drizzle ORM database migrations (`node dist/db/migrate.js`) before the API starts. Uses the same API image. Runs once and exits.

**Depends on:** postgres (healthy).
**Auto-updated by Watchtower:** Yes (picks up new migrations with each API image update).

---

### GDPR Compliance

#### postgres-backup
**Image:** `postgres:17-alpine`
**Role:** Runs daily encrypted PostgreSQL backups to Scaleway S3 Object Storage via cron. Uses `backup.sh` script.

| Env Var | Description |
|---------|-------------|
| `BACKUP_ENCRYPTION_KEY` | AES encryption key for backup files |
| `SCW_ACCESS_KEY/SECRET_KEY` | Scaleway Object Storage credentials |
| `SCW_BUCKET_NAME` | Target S3 bucket (default: `scanorbit-backups`) |
| `SCW_REGION` | Scaleway region (default: `nl-ams`) |

**Volumes:** `backup.sh` script, crontab, postgres certs (all read-only), `backup_temp` (temp storage).
**Depends on:** postgres (healthy).

---

#### retention-cleanup
**Image:** `ghcr.io/{GITHUB_REPOSITORY}/api:{IMAGE_TAG}`
**Role:** Runs daily at 03:00 UTC to enforce GDPR data retention policies. Deletes expired resources, findings, scans, and audit logs according to configurable retention periods.

| Env Var | Default | Description |
|---------|---------|-------------|
| `RETENTION_RESOURCES_DAYS` | `90` | Days to keep stale resources |
| `RETENTION_FINDINGS_RESOLVED_DAYS` | `180` | Days to keep resolved findings |
| `RETENTION_SCANS_DAYS` | `365` | Days to keep scan records |
| `RETENTION_AUDIT_LOGS_DAYS` | `730` | Days to keep audit logs (GDPR: 2yr minimum) |

**Depends on:** migrate (completed), postgres (healthy).
**Auto-updated by Watchtower:** Yes.

---

### Deployment

#### watchtower
**Image:** `containrrr/watchtower:latest`
**Role:** Monitors GHCR for new Docker image versions and auto-deploys them. Polls every 5 minutes. Only updates services with the `com.centurylinklabs.watchtower.scope=scanorbit` label.

| Env Var | Description |
|---------|-------------|
| `DOCKER_API_VERSION` | `1.47` (required for Docker 27+) |
| `WATCHTOWER_POLL_INTERVAL` | `300` (seconds) |
| `WATCHTOWER_CLEANUP` | `true` — removes old images after update |
| `WATCHTOWER_NOTIFICATION_URL` | Shoutrrr URL for Slack/Discord/Telegram notifications |

**Volumes:** Docker socket, Docker config for GHCR auth (read-only).

**Note:** Rolling restarts are disabled because services have inter-dependencies (e.g., API depends on migrate).

---

### Observability

#### prometheus
**Image:** `prom/prometheus:v2.51.0`
**Port:** 9092 (mapped from internal 9090)
**Role:** Collects metrics from all services every 10-15s. Stores 30 days of time-series data. Evaluates alert rules and forwards to Alertmanager.

**Scrape targets:**
| Job | Target | Interval |
|-----|--------|----------|
| `prometheus` | `localhost:9090` | 15s |
| `scanorbit-api` | `api:4000` | 10s |
| `scanorbit-scanner` | `scanner:9090` | 10s |
| `scanorbit-analyzer` | `analyzer:9091` | 10s |
| `redis` | `redis-exporter:9121` | 15s |
| `postgres` | `postgres-exporter:9187` | 15s |

**Depends on:** alertmanager (healthy).

---

#### grafana
**Image:** `grafana/grafana:10.4.0`
**Port:** 3001 (mapped from internal 3000)
**Role:** Metrics visualization and dashboards. Connects to Prometheus (metrics) and Loki (logs) as data sources.

| Env Var | Default | Description |
|---------|---------|-------------|
| `GF_SECURITY_ADMIN_USER` | `admin` | Grafana admin username |
| `GF_SECURITY_ADMIN_PASSWORD` | `admin` | Grafana admin password (change in production) |

**Depends on:** prometheus (healthy), loki (healthy).

---

#### loki
**Image:** `grafana/loki:2.9.6`
**Port:** 3100
**Role:** Log aggregation. Receives logs from Promtail and makes them queryable through Grafana.

---

#### promtail
**Image:** `grafana/promtail:2.9.6`
**Role:** Collects container logs via Docker socket and ships them to Loki. Reads from `/var/lib/docker/containers/`.

**Depends on:** loki (healthy).

---

#### postgres-exporter
**Image:** `quay.io/prometheuscommunity/postgres-exporter:v0.15.0`
**Role:** Exports PostgreSQL metrics (connections, replication, locks, etc.) for Prometheus scraping on port 9187.

**Depends on:** postgres (healthy).

---

#### redis-exporter
**Image:** `oliver006/redis_exporter:v1.58.0-alpine`
**Role:** Exports Redis metrics (memory, commands, clients, keyspace, etc.) for Prometheus scraping on port 9121. Connects via TLS.

**Depends on:** redis (healthy).

---

#### alertmanager
**Image:** `prom/alertmanager:v0.27.0`
**Port:** 9093
**Role:** Routes alerts from Prometheus to notification channels (Slack, Telegram). Uses template-based config with env var substitution via entrypoint script.

| Env Var | Description |
|---------|-------------|
| `SLACK_WEBHOOK_URL` | Slack incoming webhook URL |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token |
| `TELEGRAM_CHAT_ID` | Telegram chat/group ID for alerts |

---

### Other

#### maxbolgarin
**Image:** `ghcr.io/maxbolgarin/maxbolgarin-web:latest`
**Internal port:** 80
**Role:** Personal website served at `maxbolgarin.com`.

**Auto-updated by Watchtower:** Yes.

---

## Startup Order

The dependency chain ensures services start in the correct order:

```
postgres ─────────────┬─→ migrate ──────────┬─→ api ─────────→ caddy
                      │                     ├─→ scanner
redis ────────────────┤                     ├─→ analyzer
                      │                     └─→ retention-cleanup
                      ├─→ postgres-backup
                      ├─→ umami-db-init ──→ umami ──→ caddy
                      ├─→ postgres-exporter
                      └─→ redis-exporter
alertmanager ─→ prometheus ─→ grafana
loki ─→ promtail              ↗ (also depends on loki)
```

Key ordering rules:
1. **postgres** and **redis** must be healthy before anything else starts
2. **migrate** must complete successfully before api, scanner, analyzer, and retention-cleanup
3. **umami-db-init** must complete before umami starts
4. **caddy** waits for api (healthy), app (started), landing (started), and umami (healthy)
5. **alertmanager** must be healthy before Prometheus starts (to register as alert target)
6. **grafana** waits for both Prometheus and Loki

---

## Network

All services are on a single bridge network called `scanorbit`. No service ports are exposed to the host except:

| Port | Service | Access |
|------|---------|--------|
| 80 | Caddy | Public (HTTP → HTTPS redirect) |
| 443 | Caddy | Public (HTTPS + HTTP/3) |
| 9090 | Scanner | localhost only (metrics) |
| 9091 | Analyzer | localhost only (metrics) |
| 9092 | Prometheus | localhost (UI) |
| 9093 | Alertmanager | localhost (UI) |
| 3001 | Grafana | localhost (UI) |
| 3002 | Umami | localhost (analytics dashboard) |
| 3100 | Loki | localhost (API) |

---

## Volumes

| Volume | Service | Purpose |
|--------|---------|---------|
| `postgres_data` | postgres | Database files |
| `redis_data` | redis | RDB/AOF persistence |
| `caddy_data` | caddy | TLS certificates and ACME data |
| `caddy_config` | caddy | Runtime configuration |
| `backup_temp` | postgres-backup | Temporary backup staging |
| `prometheus_data` | prometheus | 30 days of metrics |
| `grafana_data` | grafana | Dashboards, users, config |
| `loki_data` | loki | Log index and chunks |
| `alertmanager_data` | alertmanager | Silences and notification state |

---

## TLS Certificates

Internal service-to-service TLS certificates are stored in `deploy/certs/` and mounted read-only:

- `deploy/certs/postgres/` — PostgreSQL server cert, key, and CA (`ca.crt`, `server.crt`, `server.key`)
- `deploy/certs/redis/` — Redis server cert, key, and CA (`ca.crt`, `redis.crt`, `redis.key`)

Generate before first deploy: `deploy/scripts/generate-certs.sh`

External TLS (HTTPS) is handled automatically by Caddy via Let's Encrypt.

---

## CI/CD Deployment Flow

```
git push to main
    ↓
GitHub Actions: semantic-release → version tag + CHANGELOG
    ↓
GitHub Actions: build Docker images for api, app, landing, scanner, analyzer
    ↓
Push images to ghcr.io/{GITHUB_REPOSITORY}/*:{version}
    ↓
Watchtower (polls every 5 min) detects new images
    ↓
Auto-pulls and restarts containers with watchtower.scope=scanorbit label
```

Services with the Watchtower label: api, app, landing, scanner, analyzer, migrate, retention-cleanup, maxbolgarin.
