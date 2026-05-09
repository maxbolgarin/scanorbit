# ScanOrbit

Agentless AWS infrastructure scanner. Discovers resources across your AWS
accounts, surfaces orphans, security risks, cost waste, and compliance gaps —
without installing anything in your cloud beyond a read-only IAM role.

Self-hosted, single-binary-ish deploy via Docker Compose. Apache 2.0 licensed.

---

## Deploy

You need: Docker, Docker Compose, and a host with ~2 vCPU / 2 GB RAM.

```bash
git clone https://github.com/maxbolgarin/scanorbit
cd scanorbit
cp .env.example .env

# generate the four required secrets
for k in JWT_SECRET JWT_REFRESH_SECRET TOTP_ENCRYPTION_KEY OAUTH_ENCRYPTION_KEY; do
  sed -i.bak "s|^$k=.*|$k=$(openssl rand -hex 32)|" .env
done && rm -f .env.bak

docker compose up -d
```

The web UI is now on **http://localhost:8080**. Sign up — the first user
becomes the org admin, and the org runs at the equivalent of the full TEAM
plan (no billing, no upgrade prompts).

If you didn't configure SMTP/Resend, the signup verification code is printed
to the API logs:

```bash
docker compose logs -f api
```

### Connecting an AWS account

In the UI, **AWS Accounts → Add account** generates an IAM trust + read-only
policy snippet. Apply that role to your AWS account, paste the role ARN back,
and trigger a scan. Findings appear within minutes.

### Putting it behind a real hostname

The `app` service binds to `${APP_PORT:-8080}` on the host. For production:

1. Set `FRONTEND_URL=https://scanorbit.example.com` in `.env`.
2. Point a reverse proxy (Caddy, nginx, Traefik) at the `app` container and
   terminate TLS there. The container speaks plain HTTP on port 80.

### Updating

```bash
git pull
docker compose pull       # if you switch to pre-built images
docker compose up -d --build
```

The `migrate` service runs once per `up` and applies any new database
migrations before the API starts.

---

## Features

- **Inventory** — EC2, EBS, RDS, S3, ALB, ACM, Lambda, CloudWatch, IAM, KMS,
  Secrets Manager across every region in the account.
- **Orphan detection** — unattached EBS volumes, idle Elastic IPs, dangling
  ENIs, unused security groups, idle NAT gateways, idle load balancers, old
  snapshots.
- **Security** — overly permissive security groups, public S3/RDS/EC2,
  unencrypted resources, IAM users without MFA, stale access keys.
- **Cost** — stopped instances, oversized Lambdas, old-generation EC2/RDS,
  unused KMS keys, missing log retention, EBS rightsizing hints.
- **SSL** — ACM certificate expiry tracking with severity-based alerts.
- **Compliance** — required-tag enforcement, EU/region data residency checks.
- **Webhooks & API** — outbound webhooks for findings/scans and a public REST
  API at `/api/v1` (API key auth) for integrating with your own tooling.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                         Browser / CLI                        │
└──────────────────────────────┬───────────────────────────────┘
                               │
                  ┌────────────▼────────────┐
                  │   app  (React + nginx)  │  :8080
                  │   serves SPA, proxies   │
                  │   /api/* → api          │
                  └────────────┬────────────┘
                               │
                  ┌────────────▼────────────┐
                  │   api  (Hono / Node)    │  :4000
                  │   auth, orgs, REST API  │
                  │   queues scan jobs      │
                  └──────┬──────────┬───────┘
                         │          │
                ┌────────▼──┐    ┌──▼──────────┐
                │ postgres  │    │   redis     │
                │ (state)   │    │ (job queue) │
                └────────▲──┘    └──┬──────────┘
                         │          │
                ┌────────┴──────────▼──────────┐
                │        workers (Go)          │
                │  ┌────────────┐ ┌──────────┐ │
                │  │  scanner   │ │ analyzer │ │
                │  │  EC2/RDS/  │ │ orphans, │ │
                │  │  S3/ALB/…  │ │ security,│ │
                │  │            │ │ cost, …  │ │
                │  └────────────┘ └──────────┘ │
                └──────────────────────────────┘
```

- **`apps/api`** — Hono + Drizzle ORM REST API, JWT auth (email/password +
  optional Google/GitHub OAuth + optional TOTP 2FA), audit logging, public API.
- **`apps/app`** — React 19 SPA, Vite + Tailwind + Radix UI. Built into a
  static bundle and served by nginx with a same-origin `/api/*` reverse proxy
  to the API container — no CORS, no build-time API URL baking.
- **`workers/`** — Two Go binaries that pull jobs off Redis: `scanner` calls
  the AWS describe APIs across all enabled regions; `analyzer` consumes the
  inventory and emits findings. Both share the read-only IAM role you grant.
- **`packages/`** — Shared ESLint configs.

The API enqueues scan jobs to Redis lists (`jobs:scan_account`,
`jobs:analyze_*`); workers `BLPOP` from those queues, write results to
Postgres, and publish events that the API surfaces in the UI.

---

## Development

```bash
# install deps (pnpm 10+, Node 24+)
pnpm install

# spin up postgres + redis
docker compose up db redis -d

# run migrations
pnpm --filter @scanorbit/api db:migrate

# all TS apps in watch mode
pnpm dev
# or individually:
pnpm dev-api          # API on :4000
pnpm --filter @scanorbit/app dev   # SPA on :3000
```

Go workers:

```bash
cd workers
go run ./cmd/scanner
go run ./cmd/analyzer
```

Tests, lint, typecheck:

```bash
pnpm --filter @scanorbit/api test
pnpm lint
pnpm typecheck
```

---

## Configuration reference

All configuration is via environment variables (see `.env.example`). The four
secrets at the top of `.env` are the only mandatory values:

| Variable | Purpose |
|---|---|
| `JWT_SECRET` | Signs short-lived access tokens |
| `JWT_REFRESH_SECRET` | Signs long-lived refresh tokens |
| `TOTP_ENCRYPTION_KEY` | Encrypts 2FA secrets at rest (AES-256, 32 bytes hex) |
| `OAUTH_ENCRYPTION_KEY` | Encrypts OAuth tokens at rest (AES-256, 32 bytes hex) |

Everything else is optional. To enable Google or GitHub OAuth login, set
`GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` (and `GITHUB_*`) in the API
container's environment.

---

## Contributing

PRs welcome. Please run `pnpm lint && pnpm typecheck && pnpm --filter
@scanorbit/api test` before pushing.

## License

[Apache 2.0](./LICENSE)
