# ScanOrbit Go Workers – Algorithms, Architecture & Implementation Guide

## 1. Overview: What Are Workers?

Workers are **background processes** that perform long-running or compute-intensive tasks asynchronously. For ScanOrbit:

- **Scanner Worker**: Discovers AWS resources and populates inventory
- **Analyzer Worker**: Processes resources to detect findings (orphans, SSL issues, data residency violations)
- **Other Workers** (future): Cost optimization, notification delivery, data flow analysis

Workers run **independently** of the API, communicate via **Redis job queue**, and persist results to **Postgres**.

---

## 2. Architecture

### 2.1 Job Flow

```
API (Node + Hono)
    |
    | POST /aws/accounts/:id/scan
    |
    v
Redis Job Queue
    |
    +-- Scanner Worker reads job
    |   |
    |   +-- Calls AWS APIs
    |   |
    |   v
    |-- Insert resources into Postgres
    |
    +-- API notifies frontend (polling or WebSocket)
    |
    v
Analyzer Worker reads resources
    |
    +-- Apply rules (orphans, SSL, residency)
    |
    v
Insert findings into Postgres
    |
    v
Frontend polls findings endpoint
```

### 2.2 Job Types

| Job Type | Payload | Worker | Duration |
|----------|---------|--------|----------|
| `scan_account` | `{accountId, orgId}` | Scanner | 5–15 min |
| `analyze_orphans` | `{accountId, orgId}` | Analyzer | 1–2 min |
| `analyze_ssl` | `{accountId, orgId}` | Analyzer | 30–60 sec |
| `analyze_residency` | `{accountId, orgId, policy}` | Analyzer | 30–60 sec |

---

## 3. Go Concurrency Patterns

Go excels at handling concurrent I/O (API calls, database queries) via **goroutines** and **channels**. [web:251][web:252][web:255][web:258]

### 3.1 Key Concepts

- **Goroutines**: Lightweight threads managed by Go runtime (thousands can run on a single machine).
- **Channels**: Type-safe communication between goroutines; prevent race conditions by design.
- **WaitGroup**: Synchronization primitive to wait for all goroutines to complete.
- **Buffered Channels**: Act as queues/semaphores to limit concurrent operations. [web:252][web:255]

### 3.2 Core Patterns for Infrastructure Scanning

#### Pattern 1: Fan-Out/Fan-In (Parallel AWS API calls)

When scanning a region:

```
Main goroutine spawns N "fan-out" goroutines
    |
    +-- Goroutine 1: DescribeInstances
    |
    +-- Goroutine 2: DescribeVolumes
    |
    +-- Goroutine 3: DescribeDBInstances
    |
    v
Results collected via channel (Fan-In)
```

Benefits:
- Calls are concurrent, not sequential
- Network latency is masked (all calls in parallel)
- Typical 5–15 min scan reduced to 1–3 min

#### Pattern 2: Worker Pool (Bounded Concurrency)

Limit concurrent goroutines to avoid resource exhaustion:

```
Fixed-size pool (N workers)
    |
    +-- Worker 1 (processes resources)
    |
    +-- Worker 2 (processes resources)
    |
    +-- Worker N (processes resources)
    |
    ^ receives tasks from a task channel
```

Benefits:
- Prevents spawning unlimited goroutines (memory safety)
- Backpressure: if workers are busy, task channel fills up (slows producer)
- Predictable resource usage

#### Pattern 3: Pipelines (Sequential Processing)

```
Stage 1: Discover resources
    |
    v
Channel (results flow to next stage)
    |
    v
Stage 2: Fetch detailed metadata
    |
    v
Channel
    |
    v
Stage 3: Estimate costs
    |
    v
Postgres (insert)
```

Each stage runs concurrently, processing its slice of data.

---

## 4. Scanner Worker Implementation

### 4.1 High-Level Algorithm

```
1. Receive job: {accountId, orgId}
2. Fetch AWS account details (role ARN, external ID) from Postgres
3. AssumeRole via STS to get temporary credentials
4. For each region (fan-out):
   a. DescribeInstances
   b. DescribeVolumes
   c. DescribeDBInstances
   d. DescribeRDSSnapshots
   e. ListBuckets (once globally)
   f. Describe load balancers
   g. List ACM certificates
5. For each resource:
   a. Extract metadata (tags, region, state, name)
   b. Upsert into Postgres `resources` table
6. For each ACM certificate:
   a. Extract expiry, issuer, domains
   b. Upsert into `certificates` table
7. Optional: scan endpoints for TLS certificates (slow, defer to later)
8. Mark scan as complete; update `aws_accounts.last_scan_at`
```

### 4.2 AWS SDK v2 Setup (Go)

Use **AWS SDK v2** (v1 is EOL as of July 31, 2025). [web:251][web:254][web:257][web:269]

```bash
go get github.com/aws/aws-sdk-go-v2
go get github.com/aws/aws-sdk-go-v2/config
go get github.com/aws/aws-sdk-go-v2/service/ec2
go get github.com/aws/aws-sdk-go-v2/service/rds
go get github.com/aws/aws-sdk-go-v2/service/s3
go get github.com/aws/aws-sdk-go-v2/service/elasticloadbalancingv2
go get github.com/aws/aws-sdk-go-v2/service/acm
go get github.com/aws/aws-sdk-go-v2/service/sts
```

### 4.3 Project Structure

```
workers/
├── cmd/
│   ├── scanner/
│   │   └── main.go          # Scanner entry point
│   └── analyzer/
│       └── main.go          # Analyzer entry point
├── internal/
│   ├── analyzers/
│   │   ├── analyzer.go      # Analyzer interface
│   │   ├── orchestrator.go  # Analysis orchestration
│   │   ├── orphans.go       # Orphaned resources detection
│   │   ├── residency.go     # Data residency checks
│   │   └── ssl.go           # SSL certificate analysis
│   ├── awsclient/
│   │   ├── client.go        # AWS SDK client + AssumeRole
│   │   ├── regions.go       # Region listing
│   │   ├── ec2.go           # EC2 discovery
│   │   ├── rds.go           # RDS discovery
│   │   ├── s3.go            # S3 discovery
│   │   ├── alb.go           # ALB discovery
│   │   └── acm.go           # ACM certificate discovery
│   ├── config/
│   │   └── config.go        # Environment config + logging
│   ├── models/
│   │   ├── job.go           # Job types
│   │   ├── resource.go      # Resource model
│   │   ├── finding.go       # Finding model
│   │   └── certificate.go   # Certificate model
│   ├── queue/
│   │   ├── queue.go         # Queue interface
│   │   └── redis.go         # Redis implementation
│   ├── scanner/
│   │   ├── scanner.go       # Main scanner logic
│   │   └── result.go        # Scan result types
│   └── store/
│       ├── store.go         # Store interface
│       ├── postgres.go      # Postgres connection (pgx/v5)
│       ├── accounts.go      # AWS accounts queries
│       ├── resources.go     # Resources upsert
│       ├── certificates.go  # Certificates upsert
│       ├── findings.go      # Findings upsert
│       └── scans.go         # Scan status updates
├── Dockerfile
├── Makefile
├── go.mod
└── go.sum
```

### 4.4 Code Sketch (Scanner Worker)

```go
// job/job.go
package job

type ScanAccountJob struct {
    AccountID string `json:"account_id"`
    OrgID     string `json:"org_id"`
}

// internal/scanner/scanner.go
package scanner

import (
    "context"
    "sync"
    "github.com/aws/aws-sdk-go-v2/aws"
    "github.com/jackc/pgx/v5/pgxpool"
    "github.com/rs/zerolog/log"
)

type Scanner struct {
    pool *pgxpool.Pool
    cfg  aws.Config
}

// ScanAccount is the main entry point
func (s *Scanner) ScanAccount(ctx context.Context, job *ScanAccountJob) error {
    // 1. Fetch account details from DB
    account, err := s.getAccount(ctx, job.AccountID)
    if err != nil {
        return fmt.Errorf("fetch account: %w", err)
    }

    // 2. Assume role
    credentials, err := s.assumeRole(ctx, account.RoleARN, account.ExternalID)
    if err != nil {
        return fmt.Errorf("assume role: %w", err)
    }

    // 3. Create region-scoped AWS clients
    cfg := s.cfg.Copy()
    cfg.Credentials = credentials

    // 4. List regions
    regions, err := s.listRegions(ctx, cfg)
    if err != nil {
        return fmt.Errorf("list regions: %w", err)
    }

    // 5. Fan-out: scan each region concurrently
    results := make(chan *ScanResult, len(regions))
    var wg sync.WaitGroup
    
    for _, region := range regions {
        wg.Add(1)
        go func(r string) {
            defer wg.Done()
            res, err := s.scanRegion(ctx, cfg, job.AccountID, r)
            if err != nil {
                results <- &ScanResult{Error: err, Region: r}
                return
            }
            results <- res
        }(region)
    }

    // 6. Wait for all regions to complete
    go func() {
        wg.Wait()
        close(results)
    }()

    // 7. Fan-in: collect + persist results
    resourceCount := 0
    for res := range results {
        if res.Error != nil {
            log.Printf("Region %s scan failed: %v", res.Region, res.Error)
            continue
        }
        
        // Persist resources
        for _, r := range res.Resources {
            if err := s.persistResource(ctx, job.OrgID, job.AccountID, r); err != nil {
                log.Printf("Persist resource failed: %v", err)
                continue
            }
            resourceCount++
        }
        
        // Persist certificates
        for _, cert := range res.Certificates {
            if err := s.persistCertificate(ctx, job.OrgID, job.AccountID, cert); err != nil {
                log.Printf("Persist certificate failed: %v", err)
            }
        }
    }

    // 8. Mark scan complete
    if err := s.updateScanStatus(ctx, job.AccountID, resourceCount, "complete", ""); err != nil {
        return fmt.Errorf("update scan status: %w", err)
    }

    log.Printf("Scan complete: account=%s, resources=%d", job.AccountID, resourceCount)
    return nil
}

// scanRegion handles a single region (fan-out goroutine)
func (s *Scanner) scanRegion(ctx context.Context, cfg aws.Config, accountID, region string) (*ScanResult, error) {
    result := &ScanResult{Region: region}

    // Fan-out: call multiple AWS APIs concurrently
    resultChan := make(chan interface{}, 5)
    var wg sync.WaitGroup

    // EC2 instances
    wg.Add(1)
    go func() {
        defer wg.Done()
        instances, err := s.scanEC2(ctx, cfg, region)
        if err != nil {
            log.Printf("EC2 scan failed: %v", err)
            return
        }
        result.Resources = append(result.Resources, instances...)
    }()

    // EBS volumes
    wg.Add(1)
    go func() {
        defer wg.Done()
        volumes, err := s.scanEBS(ctx, cfg, region)
        if err != nil {
            log.Printf("EBS scan failed: %v", err)
            return
        }
        result.Resources = append(result.Resources, volumes...)
    }()

    // RDS instances
    wg.Add(1)
    go func() {
        defer wg.Done()
        dbs, err := s.scanRDS(ctx, cfg, region)
        if err != nil {
            log.Printf("RDS scan failed: %v", err)
            return
        }
        result.Resources = append(result.Resources, dbs...)
    }()

    // ALBs
    wg.Add(1)
    go func() {
        defer wg.Done()
        lbs, err := s.scanALB(ctx, cfg, region)
        if err != nil {
            log.Printf("ALB scan failed: %v", err)
            return
        }
        result.Resources = append(result.Resources, lbs...)
    }()

    wg.Wait()
    return result, nil
}

// scanEC2 example: fetch all instances in a region
func (s *Scanner) scanEC2(ctx context.Context, cfg aws.Config, region string) ([]Resource, error) {
    ec2Svc := ec2.NewFromConfig(cfg, func(o *ec2.Options) {
        o.Region = region
    })

    var resources []Resource
    paginator := ec2.NewDescribeInstancesPaginator(ec2Svc)

    for paginator.HasMorePages() {
        output, err := paginator.NextPage(ctx)
        if err != nil {
            return nil, fmt.Errorf("describe instances: %w", err)
        }

        for _, reservation := range output.Reservations {
            for _, instance := range reservation.Instances {
                resource := Resource{
                    ResourceID: aws.ToString(instance.InstanceId),
                    Service:    "ec2",
                    Region:     region,
                    Name:       s.getTagValue(instance.Tags, "Name"),
                    State:      string(instance.State.Name),
                    Tags:       s.tagsToMap(instance.Tags),
                    Raw:        instance, // Store full response
                }
                resources = append(resources, resource)
            }
        }
    }

    return resources, nil
}
```

### 4.5 Concurrency Best Practices [web:251][web:255][web:258]

1. **Create AWS clients once, reuse**:
   - Expensive to instantiate; reuse across goroutines
   - AWS SDK v2 is thread-safe

2. **Use buffered channels wisely**:
   - Fan-in channel size ≤ number of fan-out goroutines
   - Prevents goroutine leaks

3. **Handle context cancellation**:
   - Pass `context.Context` to all operations
   - Graceful shutdown on timeout or signal

4. **Avoid goroutine leaks**:
   - Always ensure goroutines can exit (close channels properly)
   - Use `defer` to clean up resources

5. **Pagination**: Use SDK's built-in paginators (handles cursor logic) [web:251]

6. **Error handling**: Log errors but continue scanning (resilience) [web:251]

---

## 5. Analyzer Worker Implementation

### 5.1 Algorithm: Orphaned Resources

```
1. Receive job: {accountId, orgId}
2. Query Postgres: SELECT * FROM resources WHERE aws_account_id = $1
3. For each resource:
   a. Determine if orphaned based on rules:
      - EBS volume: state = 'available' AND created_at < now() - 30 days
      - EIP: not associated AND created_at < now() - 7 days
      - RDS snapshot: manual AND created_at < now() - 90 days
   b. Check last_activity (from CloudWatch metrics, if available)
   c. Assign confidence score (0–1)
4. For high-confidence orphans:
   a. Calculate estimated monthly cost (from AWS pricing)
   b. Create finding entry in Postgres
5. Update `findings` with type='orphaned_*', severity, summary, details
```

### 5.2 Analyzer Code Sketch

```go
// internal/analyzers/analyzer.go
package analyzers

import (
    "context"
    "time"
    "github.com/jackc/pgx/v5/pgxpool"
    "github.com/rs/zerolog/log"
)

type Analyzer struct {
    pool *pgxpool.Pool
}

type Finding struct {
    ID             string
    Type           string // 'orphaned_volume', 'ssl_expiry', etc.
    Severity       string // 'low', 'medium', 'high'
    ResourceID     string
    Summary        string
    Details        map[string]interface{}
}

// AnalyzeOrphans detects orphaned resources
func (a *Analyzer) AnalyzeOrphans(ctx context.Context, accountID, orgID string) error {
    // 1. Fetch all resources for account using pgx
    query := `
        SELECT id, service, resource_id, region, created_at, tags
        FROM resources
        WHERE aws_account_id = $1 AND org_id = $2
    `
    rows, err := a.pool.Query(ctx, query, accountID, orgID)
    if err != nil {
        return fmt.Errorf("query resources: %w", err)
    }
    defer rows.Close()

    var findings []Finding

    for rows.Next() {
        var (
            id          string
            service     string
            resourceID  string
            region      string
            createdAt   time.Time
            tagsJSON    []byte
        )

        if err := rows.Scan(&id, &service, &resourceID, &region, &createdAt, &tagsJSON); err != nil {
            log.Error().Err(err).Msg("scan error")
            continue
        }

        // 2. Apply service-specific rules
        var finding *Finding
        switch service {
        case "ebs":
            finding = a.checkOrphanedEBS(id, resourceID, createdAt)
        case "eip":
            finding = a.checkOrphanedEIP(id, resourceID, createdAt)
        case "rds_snapshot":
            finding = a.checkOrphanedSnapshot(id, resourceID, createdAt)
        }

        if finding != nil {
            findings = append(findings, *finding)
        }
    }

    // 3. Persist findings
    for _, f := range findings {
        if err := a.persistFinding(ctx, orgID, accountID, &f); err != nil {
            log.Error().Err(err).Msg("persist finding failed")
        }
    }

    log.Info().Int("count", len(findings)).Msg("orphan analysis complete")
    return nil
}

// checkOrphanedEBS determines if EBS volume is orphaned
func (a *Analyzer) checkOrphanedEBS(id, resourceID string, createdAt time.Time) *Finding {
    ageInDays := time.Since(createdAt).Hours() / 24

    // Rule: unattached EBS > 30 days old
    if ageInDays > 30 {
        estimatedCost := 0.10 * ageInDays / 30 // $0.10/month (rough estimate)

        return &Finding{
            ID:         id,
            Type:       "orphaned_volume",
            Severity:   "medium",
            ResourceID: id,
            Summary:    fmt.Sprintf("Unattached EBS volume older than 30 days (age: %.0f days)", ageInDays),
            Details: map[string]interface{}{
                "resource_id":            resourceID,
                "age_days":               int(ageInDays),
                "estimated_monthly_cost": estimatedCost,
                "recommendation":         "Delete this volume if no longer needed",
            },
        }
    }

    return nil
}

// persistFinding inserts or updates a finding
func (a *Analyzer) persistFinding(ctx context.Context, orgID, accountID string, f *Finding) error {
    detailsJSON, _ := json.Marshal(f.Details)

    query := `
        INSERT INTO findings
        (org_id, aws_account_id, resource_id, type, severity, summary, details, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'open')
        ON CONFLICT (org_id, aws_account_id, resource_id, type)
        DO UPDATE SET updated_at = NOW()
    `

    _, err := a.pool.Exec(ctx, query,
        orgID, accountID, f.ResourceID, f.Type, f.Severity, f.Summary, detailsJSON)
    return err
}
```

### 5.3 SSL Certificate Analyzer

```go
func (a *Analyzer) AnalyzeSSL(ctx context.Context, accountID, orgID string) error {
    query := `
        SELECT id, not_after, primary_domain
        FROM certificates
        WHERE aws_account_id = $1 AND org_id = $2
    `
    rows, err := a.pool.Query(ctx, query, accountID, orgID)
    if err != nil {
        return fmt.Errorf("query certificates: %w", err)
    }
    defer rows.Close()

    now := time.Now()
    var findings []Finding

    for rows.Next() {
        var id, domain string
        var notAfter time.Time

        if err := rows.Scan(&id, &notAfter, &domain); err != nil {
            log.Error().Err(err).Msg("scan error")
            continue
        }

        daysLeft := notAfter.Sub(now).Hours() / 24

        // Rules: assign severity based on expiration timeline
        var severity string
        if daysLeft < 7 {
            severity = "high"
        } else if daysLeft < 30 {
            severity = "medium"
        } else if daysLeft < 60 {
            severity = "low"
        } else {
            continue // No finding
        }

        finding := Finding{
            ID:       id,
            Type:     "ssl_expiry",
            Severity: severity,
            Summary:  fmt.Sprintf("SSL certificate for %s expires in %.0f days", domain, daysLeft),
            Details: map[string]interface{}{
                "domain":      domain,
                "expires_at":  notAfter,
                "days_left":   int(daysLeft),
                "action":      "Renew certificate via ACM console",
            },
        }

        findings = append(findings, finding)
    }

    for _, f := range findings {
        if err := a.persistFinding(ctx, orgID, accountID, &f); err != nil {
            log.Error().Err(err).Msg("persist finding failed")
        }
    }

    return nil
}
```

---

## 6. Job Queue Management (Redis + Background Worker)

### 6.1 Simple Redis Queue Pattern

```go
// queue/redis.go
package queue

import "github.com/redis/go-redis/v9"

type JobQueue struct {
    client *redis.Client
}

// EnqueueJob pushes a job to Redis list
func (q *JobQueue) EnqueueJob(ctx context.Context, jobType string, payload []byte) error {
    key := "jobs:" + jobType
    return q.client.RPush(ctx, key, payload).Err()
}

// ConsumeJobs pops jobs from Redis (blocking)
func (q *JobQueue) ConsumeJobs(ctx context.Context, jobType string, handler func([]byte) error) {
    key := "jobs:" + jobType

    for {
        select {
        case <-ctx.Done():
            return
        default:
        }

        // BLPOP blocks until a job is available (timeout: 5s)
        result, err := q.client.BLPop(ctx, 5*time.Second, key).Result()
        if err == redis.Nil {
            continue // Timeout, try again
        }
        if err != nil {
            log.Printf("Redis error: %v", err)
            time.Sleep(1 * time.Second)
            continue
        }

        payload := []byte(result[1])

        // Process job
        if err := handler(payload); err != nil {
            log.Printf("Job error: %v, re-enqueueing", err)
            // Simple retry: re-push to queue
            q.client.RPush(ctx, key, payload)
        }
    }
}
```

### 6.2 Worker Main Loop

```go
// cmd/scanner/main.go
package main

import (
    "context"
    "os"
    "os/signal"
    "syscall"

    "github.com/jackc/pgx/v5/pgxpool"
    "github.com/rs/zerolog"
    "github.com/rs/zerolog/log"

    "github.com/maxbolgarin/scanorbit/internal/config"
    "github.com/maxbolgarin/scanorbit/internal/queue"
    "github.com/maxbolgarin/scanorbit/internal/scanner"
    "github.com/maxbolgarin/scanorbit/internal/store"
)

func main() {
    // Setup zerolog
    zerolog.TimeFieldFormat = zerolog.TimeFormatUnix
    log.Logger = log.Output(zerolog.ConsoleWriter{Out: os.Stderr})

    ctx, cancel := context.WithCancel(context.Background())
    defer cancel()

    cfg := config.Load()

    // Setup database (pgx pool)
    pool, err := pgxpool.New(ctx, cfg.DatabaseURL)
    if err != nil {
        log.Fatal().Err(err).Msg("database setup failed")
    }
    defer pool.Close()

    // Setup Redis
    rdb, err := queue.NewRedisClient(cfg.RedisURL)
    if err != nil {
        log.Fatal().Err(err).Msg("redis setup failed")
    }
    defer rdb.Close()

    // Setup workers
    st := store.New(pool)
    sc := scanner.New(st, cfg)
    jq := queue.New(rdb)

    // Graceful shutdown on SIGTERM/SIGINT
    sigChan := make(chan os.Signal, 1)
    signal.Notify(sigChan, syscall.SIGTERM, syscall.SIGINT)

    // Start job consumer
    go jq.Consume(ctx, "scan_account", sc.HandleJob)

    log.Info().Msg("scanner worker started, waiting for jobs...")

    // Wait for shutdown signal
    <-sigChan
    log.Info().Msg("shutting down gracefully...")
    cancel()
}
```

---

## 7. Deployment & Scaling

### 7.1 Docker Container (Dockerfile)

The workers use a multi-stage Dockerfile that builds both scanner and analyzer:

```dockerfile
# Build stage
FROM golang:1.23-alpine AS builder
WORKDIR /app
ENV GOTOOLCHAIN=auto
RUN apk add --no-cache git
COPY go.mod go.sum* ./
RUN go mod download
COPY . .

# Build scanner
FROM builder AS build-scanner
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o /scanner ./cmd/scanner

# Build analyzer
FROM builder AS build-analyzer
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o /analyzer ./cmd/analyzer

# Scanner production image
FROM alpine:3.21 AS scanner
RUN apk add --no-cache ca-certificates tzdata
WORKDIR /app
COPY --from=build-scanner /scanner .
USER nobody:nobody
ENTRYPOINT ["./scanner"]

# Analyzer production image
FROM alpine:3.21 AS analyzer
RUN apk add --no-cache ca-certificates tzdata
WORKDIR /app
COPY --from=build-analyzer /analyzer .
USER nobody:nobody
ENTRYPOINT ["./analyzer"]
```

### 7.2 Docker Compose Entry (docker-compose.yml)

```yaml
scanner-worker:
  build:
    context: ./workers
    target: scanner
  environment:
    DATABASE_URL: postgresql://postgres:postgres@postgres:5432/scanorbit
    REDIS_URL: redis://redis:6379
    AWS_REGION: eu-west-1
    LOG_LEVEL: info
  depends_on:
    - postgres
    - redis
  restart: always

analyzer-worker:
  build:
    context: ./workers
    target: analyzer
  environment:
    DATABASE_URL: postgresql://postgres:postgres@postgres:5432/scanorbit
    REDIS_URL: redis://redis:6379
    LOG_LEVEL: info
  depends_on:
    - postgres
    - redis
  restart: always
```

### 7.3 Scaling Strategy

- **Horizontal**: Run multiple worker instances (different queues or same queue with load distribution)
- **Vertical**: Increase goroutines per worker instance (control via env variable)
- **Job batching**: Group small jobs to reduce context-switching overhead

---

## 8. Monitoring & Observability

### 8.1 Logging

Use **zerolog** for structured JSON logging:

```go
import "github.com/rs/zerolog/log"

// Configure zerolog at startup (internal/config/config.go)
zerolog.TimeFieldFormat = zerolog.TimeFormatUnix
log.Logger = log.Output(zerolog.ConsoleWriter{Out: os.Stderr})

// Structured logging in workers
log.Info().
    Str("account_id", accountID).
    Str("region", region).
    Float64("duration_seconds", elapsed).
    Msg("scan started")

// Error logging
log.Error().
    Err(err).
    Str("region", region).
    Msg("failed to scan region")
```

### 8.2 Metrics to Track

- Jobs processed per minute
- Average job duration (by type)
- Error rate (by job type)
- Queue depth (pending jobs)
- Resource utilization (goroutines, memory)

### 8.3 Health Check

Add periodic health check to database/Redis:

```go
import (
    "github.com/jackc/pgx/v5/pgxpool"
    "github.com/redis/go-redis/v9"
)

func healthCheck(ctx context.Context, pool *pgxpool.Pool, rdb *redis.Client) error {
    if err := pool.Ping(ctx); err != nil {
        return fmt.Errorf("database unhealthy: %w", err)
    }
    if err := rdb.Ping(ctx).Err(); err != nil {
        return fmt.Errorf("redis unhealthy: %w", err)
    }
    return nil
}
```

---

## 9. Error Handling & Resilience

### 9.1 Retry Strategy

```go
func retryWithBackoff(maxAttempts int, fn func() error) error {
    var lastErr error
    for attempt := 1; attempt <= maxAttempts; attempt++ {
        err := fn()
        if err == nil {
            return nil
        }
        lastErr = err
        
        if attempt < maxAttempts {
            backoff := time.Duration(math.Pow(2, float64(attempt))) * time.Second
            log.Printf("Retry %d/%d after %v: %v", attempt, maxAttempts, backoff, err)
            time.Sleep(backoff)
        }
    }
    return lastErr
}
```

### 9.2 Graceful Degradation

- If one region fails, continue scanning others (don't block entire scan)
- If ACM is slow, deprioritize ACM scan but complete EC2/RDS/S3
- Log errors, create low-priority finding for operator review

---

## 10. Testing

### 10.1 Unit Tests for Analyzer Rules

```go
func TestCheckOrphanedEBS(t *testing.T) {
    analyzer := &Analyzer{}

    // Test: 40-day-old unattached volume = orphaned
    createdAt := time.Now().AddDate(0, 0, -40)
    finding := analyzer.checkOrphanedEBS("vol-123", "vol-123", createdAt)
    
    if finding == nil {
        t.Error("Expected finding for 40-day-old volume")
    }
    if finding.Severity != "medium" {
        t.Errorf("Expected medium severity, got %s", finding.Severity)
    }
}
```

### 10.2 Integration Tests

Mock AWS SDK with `github.com/aws/aws-sdk-go-v2/aws` mocks or use test fixtures.

---

## 11. Key Libraries

| Library | Purpose | Version |
|---------|---------|---------|
| `github.com/aws/aws-sdk-go-v2` | AWS API access | v2.x (v1 EOL July 2025) |
| `github.com/jackc/pgx/v5` | PostgreSQL driver (pure Go) | v5.8.x |
| `github.com/redis/go-redis/v9` | Redis client | v9.x |
| `github.com/rs/zerolog` | Structured JSON logging | v1.34.x |
| `github.com/google/uuid` | UUID generation | v1.6.x |
| `sync.WaitGroup` (built-in) | Goroutine synchronization | Built-in |

**Note:** The codebase uses **pgx/v5** instead of `lib/pq` for better performance and native PostgreSQL protocol support.

---

## 12. Next Steps

1. Implement `scanEC2`, `scanEBS`, `scanRDS`, `scanS3`, `scanALB`, `scanACM` functions
2. Add CloudWatch metrics polling for resource utilization (detect idle resources)
3. Implement optional endpoint TLS scanning (slower, can run separately)
4. Add metrics export (Prometheus format)
5. Set up health checks + alerting
6. Load test with real AWS account to verify performance

---

## Summary

Go workers provide:

- **Concurrency**: goroutines + channels scale to thousands of concurrent operations
- **Resilience**: error handling + retry logic + graceful degradation
- **Efficiency**: fast execution, low memory footprint
- **Simplicity**: single binary, minimal dependencies

Use **Fan-Out/Fan-In** for AWS API calls (parallel per region), **Worker Pools** for bounded concurrency, and **Pipelines** for multi-stage processing.
