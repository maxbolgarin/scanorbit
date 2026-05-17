# Observability

ScanOrbit exposes Prometheus metrics on three endpoints, structured JSON
logs on stdout, and two HTTP health checks. Wire them into whatever you
already run.

## Metrics

| Component | Endpoint | Default port |
| --- | --- | --- |
| API | `GET /metrics` | `4000` (internal) |
| Scanner worker | `GET /metrics` | `9090` |
| Analyzer worker | `GET /metrics` | `9091` |

The Go workers bind their metrics server to `127.0.0.1` by default, so
they're only reachable from the same container/host. For a Prometheus
running outside Docker, point your scrape config at the container IPs or
publish the ports in `docker-compose.yml`:

```yaml
  scanner:
    # ...existing config...
    ports:
      - "127.0.0.1:9090:9090"
  analyzer:
    # ...existing config...
    ports:
      - "127.0.0.1:9091:9091"
```

Sample `prometheus.yml`:

```yaml
scrape_configs:
  - job_name: scanorbit-api
    metrics_path: /metrics
    static_configs:
      - targets: ['scanorbit-api:4000']
  - job_name: scanorbit-scanner
    metrics_path: /metrics
    static_configs:
      - targets: ['scanorbit-scanner:9090']
  - job_name: scanorbit-analyzer
    metrics_path: /metrics
    static_configs:
      - targets: ['scanorbit-analyzer:9091']
```

### Useful series

- `scanorbit_jobs_processed_total{type, status}` — counter, jobs per
  type and outcome. Alert on a sudden spike in `status="error"`.
- `scanorbit_job_processing_seconds` — histogram of job latency. Watch
  the p95/p99 against expectations.
- `scanorbit_jobs_in_flight{type}` — gauge of currently running jobs.
- `scanorbit_queue_length{queue}` — Redis queue depth. Alert when it
  grows past a threshold for more than a few minutes — that means the
  workers can't keep up.
- API request metrics follow the
  [`prom-client` HTTP defaults](https://github.com/siimon/prom-client)
  (`http_request_duration_seconds`, etc.).

## Logs

All services log structured JSON to stdout — `pino` on the Node side,
`zerolog` on the Go side. Tune verbosity with `LOG_LEVEL`
(`debug` / `info` / `warn` / `error`, default `info`).

Pick up the streams with whatever you use:

```bash
docker compose logs -f api
docker compose logs -f scanner analyzer
```

For aggregation, point Loki / Datadog / Vector / Fluent Bit at the
container stdout. The JSON envelope already includes `level`, `time`,
`msg`, `service`, and a request ID on every API line — no parser
required.

## Health checks

| Endpoint | Returns | Use for |
| --- | --- | --- |
| `GET /health` | always 200 | liveness probe |
| `GET /health/ready` | 200 if Postgres + Redis ping, 503 otherwise | readiness probe, load-balancer health |

The bundled `docker-compose.yml` only health-checks Postgres and Redis;
add your own check against `/health/ready` if you front the app with a
load balancer.

## Suggested alerts

- `scanorbit_queue_length` > 100 for 10 minutes — workers can't keep up.
- `rate(scanorbit_jobs_processed_total{status="error"}[5m])` > 0.1 — too
  many job failures.
- `up{job=~"scanorbit-.*"} == 0` — a component is down.
- `/health/ready` returning non-200 — Postgres or Redis is unreachable.
