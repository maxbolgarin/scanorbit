# ScanOrbit Product Roadmap — Q2-Q3 2026

## Context

ScanOrbit is an agentless AWS infrastructure scanner SaaS with 11 AWS services, 8 analysis engines, and 3 pricing tiers (Free €0 / Pro €19 / Team €79). The primary goal is **acquiring more paying users**.

### Market Position
ScanOrbit occupies a unique and nearly empty market position: the **$30–$200/month self-serve band for combined security + cost scanning**. Key competitive context:
- Prowler Cloud: $79/account/month (security only, no cost optimization)
- Enterprise CSPM (Wiz, Prisma Cloud, Orca): $24k–$200k+/year, sales-required
- Cost-only tools (Vantage, Infracost): no security posture
- Open-source (Steampipe, Checkov): requires self-hosting and expertise

**ScanOrbit's unique angle:** Security + cost analysis in one self-serve tool at a startup-accessible price.

### Current Capabilities
- **11 AWS services:** EC2, RDS, S3, IAM, Lambda, KMS, ACM, CloudWatch, ALB, EBS, Secrets Manager
- **8 analyzers:** security, cost, orphans, SSL, data residency (GDPR), IAM, tagging
- **Infrastructure map** with resource dependency visualization
- **3 tiers:** Free (1 account, 1 scan), Pro (3 accounts, €19), Team (10 accounts, €79)

---

## Phase 1: Integrations & Notifications
**Timeline:** Month 1–2 | **Impact:** HIGH (acquisition + retention)

**Why:** Without notifications, users only get value when they manually log in. Every competitor has Slack/webhook. This is a retention killer and adoption blocker.

### 1.1 Webhook Improvements + Move to Pro Tier (S)
- Move `canConfigureWebhooks` from Team to Pro tier
- Add webhook event types: `scan.completed`, `finding.new_critical`, `finding.new_high`, `weekly_digest`
- Webhook payload: JSON with finding details, resource info, severity, remediation link
- Retry logic with exponential backoff (3 retries)
- Webhook delivery log visible in UI

**Key files:**
- `apps/api/src/types/index.ts` — update `TIER_LIMITS` for Pro
- `apps/api/src/services/` — new `webhookDeliveryService.ts`
- `apps/api/src/db/schema.ts` — `webhook_deliveries` table
- `apps/app/src/pages/` — webhook config UI with test button

### 1.2 Email Digest Reports (M)
- Weekly email summary: health score delta, new findings by severity, top 5 actionable items, cost savings
- Configurable per-user (daily/weekly/off)
- HTML email template with branded design

**Key files:**
- `apps/api/src/services/emailService.ts` — digest template and generation
- `apps/api/src/db/schema.ts` — `notification_preferences` table
- Cron job for scheduled generation

### 1.3 Slack Integration (M)
- Slack App with OAuth2 — "Add to Slack" button
- Store workspace tokens encrypted (reuse existing AES-256 encryption pattern)
- Notification triggers: new Critical/High findings, scan completion, weekly digest
- Channel selection per notification type

**Key files:**
- `apps/api/src/services/slackService.ts` — OAuth flow, message sending
- `apps/api/src/routes/slack.ts` — OAuth callback, channel list, preferences
- `apps/api/src/db/schema.ts` — `slack_integrations` table
- `apps/app/src/pages/` — Slack settings in org settings

### 1.4 GitHub Actions Integration (S)
- GitHub Action YAML wrapper around ScanOrbit Public API
- Trigger scan on `terraform apply` or scheduled
- Output findings as GitHub PR annotations
- Fail CI if new Critical findings (configurable threshold)
- Published to GitHub Marketplace

**Key files:**
- New directory or repo: `scanorbit-github-action/`
- `apps/api/src/routes/api/v1/` — ensure scan trigger and findings endpoints are complete

---

## Phase 2: Compliance Frameworks
**Timeline:** Month 2–3 (2-week sprint, overlaps with Phase 3) | **Impact:** CRITICAL (acquisition)

**Why:** Compliance framework mapping is the **#1 purchase trigger** for startup CTOs. Research shows:
- 29% YoY growth in multi-framework compliance adoption
- SOC2 audit readiness is the top reason startup CTOs buy security tools
- 68% of compliance leaders cite policy management as their biggest challenge
- Prowler has 1,000+ checks mapped to 10+ frameworks — this is expected at any price point

**The good news:** Most existing ScanOrbit findings already map to CIS and SOC2 controls. This is primarily a **mapping and scoring exercise**, not a new analysis engine.

### 2.1 CIS AWS Foundations Benchmark v3.0 (M)

The CIS benchmark is the universal baseline. Map existing findings to CIS controls:

| CIS Control Area | ScanOrbit Findings That Already Cover It |
|---|---|
| 1. Identity & Access Management | IAM MFA, old access keys, unused roles, root account |
| 2. Storage | S3 public access, S3 encryption, EBS encryption |
| 3. Logging | CloudWatch log groups (partial — need CloudTrail check) |
| 4. Monitoring | CloudWatch alarms (partial) |
| 5. Networking | Security group violations, VPC (after Phase 4) |

**Gaps to fill (new checks needed):**
- CloudTrail enabled in all regions
- CloudTrail log file validation enabled
- CloudTrail logs encrypted with KMS
- AWS Config enabled in all regions
- VPC flow logs enabled (comes with Phase 4 VPC scanner)
- Password policy requirements (IAM)
- Root account usage monitoring
- S3 bucket logging enabled
- RDS public accessibility check

**Implementation:**
- `workers/internal/analyzer/compliance/` — new package
- `workers/internal/analyzer/compliance/cis.go` — CIS control mapping (control ID → finding types)
- `workers/internal/analyzer/compliance/score.go` — scoring engine (pass/fail/not-applicable per control)
- API endpoint: `GET /api/compliance/:framework` returns score + control-by-control breakdown
- Frontend: compliance dashboard with score gauge, control list with pass/fail status

### 2.2 SOC2 Control Mapping (S-M)

SOC2 Trust Service Criteria map to many of the same underlying checks as CIS:

| SOC2 Category | Relevant ScanOrbit Checks |
|---|---|
| CC6.1 — Logical Access | IAM MFA, access key rotation, unused roles |
| CC6.3 — Encryption | EBS/RDS/S3 encryption at rest |
| CC6.6 — Network Security | Security group violations, public access |
| CC6.7 — Transmission Security | SSL certificates, TLS policies |
| CC7.1 — Monitoring | CloudWatch alarms, CloudTrail (new) |
| CC7.2 — Anomaly Detection | Unused resources, orphan detection |
| CC8.1 — Change Management | Tagging compliance (Environment, Owner) |
| A1.2 — Availability | RDS backups, multi-AZ (new check) |

**Implementation:**
- `workers/internal/analyzer/compliance/soc2.go` — SOC2 TSC mapping
- Reuse the same scoring engine from CIS
- Frontend: SOC2 readiness dashboard ("You pass 23/31 relevant controls")

### 2.3 HIPAA & PCI-DSS (S each — future)

Lower priority but unlocks healthcare and fintech segments:
- **HIPAA:** Encryption everywhere, access logging, audit trails, data residency
- **PCI-DSS:** Network segmentation (SGs), encryption, access control, logging

These map to largely the same underlying checks with different groupings. Add after CIS + SOC2 are proven.

### 2.4 Compliance Report Export (M)

- PDF/CSV export of compliance posture per framework
- Per-control evidence: which resources pass/fail, with timestamps
- Designed for auditors — include remediation guidance per failed control
- Gate behind Team tier (or new Growth tier)

**Key files:**
- `apps/api/src/services/complianceReportService.ts` — report generation
- `apps/api/src/routes/compliance.ts` — report endpoints
- `apps/app/src/pages/Compliance/` — dashboard, framework detail, export buttons

### Landing Page Impact

Add compliance as a primary feature on the landing page:
- "Know your SOC2 gaps before the auditor does"
- "CIS Benchmark score in one click"
- This is the single highest-converting message for startup CTOs

---

## Phase 3: AI Remediation & Fix Guides
**Timeline:** Month 2–4 | **Impact:** HIGH (conversion + retention)

**Why:** Alert fatigue is the #1 churn reason across all CSPM tools. The fix is not fewer alerts — it's more context per alert so engineers can act faster.

### 3.1 Deterministic Fix Templates (M)

Each `FindingType` gets a structured remediation object:
```json
{
  "summary": "Why this matters",
  "impact": "What could go wrong if not fixed",
  "risk_level": "An attacker could...",
  "console_steps": ["Step 1...", "Step 2..."],
  "terraform_snippet": "resource \"aws_s3_bucket\" {...}",
  "cli_command": "aws s3api put-bucket-encryption...",
  "aws_doc_link": "https://docs.aws.amazon.com/..."
}
```

Stored as static data in the analyzer (Go structs) and served via API. Frontend renders as expandable remediation panel on finding detail page.

**Key files:**
- `workers/internal/analyzer/remediation/` — new package with templates per finding type
- `apps/api/src/routes/findings.ts` — include remediation in finding response
- `apps/app/src/pages/FindingDetails/` — remediation panel component
- Start with existing ~20 finding types, expand with new services

### 3.2 Contextual Severity Explanations (L)

Enhance finding generation to include attack-path context by cross-referencing related resources during analysis:

**Example:** "This security group allows SSH (port 22) from 0.0.0.0/0. The attached EC2 instance `i-abc123` has a public IP (`54.x.x.x`) and is in subnet `subnet-xyz` which has a route to an internet gateway. This creates a directly exploitable attack surface."

**Key files:**
- `workers/internal/analyzer/context_builder.go` — links resources (SG → EC2 → subnet → route table → IGW)
- Store context as structured JSON in finding metadata
- Requires the resource graph data that the infrastructure map already builds

### 3.3 LLM-Powered Suggestions (Future — L)

- Optional "AI Assist" button on findings — sends context + config to Claude API
- Returns tailored remediation specific to user's exact configuration
- Cache responses to avoid repeated LLM calls for identical patterns
- Gate behind Pro/Team tier
- **Defer this** — deterministic templates cover 80% of the value

---

## Phase 4: More AWS Services
**Timeline:** Month 3–5 (incremental) | **Impact:** HIGH (retention)

**Why:** AWS depth gaps are a bigger retention risk than multi-cloud absence. Users connect ScanOrbit but findings feel incomplete when key services are missing. Research shows AWS depth beats multi-cloud breadth for the current target segment.

### Architecture Pattern

Each new scanner follows the existing pattern in `workers/internal/scanner/`:
1. New Go file per service (e.g., `eks.go`, `route53.go`)
2. Register in scanner orchestrator (`scanner.go`)
3. Add resource types to DB schema
4. Add analysis rules in `workers/internal/analyzer/`
5. Add frontend resource type icons and detail views
6. Add remediation templates (Phase 3) for new finding types
7. Map new findings to CIS/SOC2 controls (Phase 2)

### Priority Services

#### 4.1 VPC & Networking (L)
- **Scan:** VPCs, subnets, route tables, VPC endpoints, flow logs, transit gateways
- **Security:** VPC flow logs disabled, default VPC in use, public subnets without NAT, missing VPC endpoints for S3/DynamoDB
- **Cost:** idle VPC endpoints, unused transit gateway attachments
- **Compliance:** VPC flow logs map to CIS 3.x and SOC2 CC7.1

#### 4.2 Route53 DNS (S)
- **Scan:** hosted zones, record sets, health checks
- **Security:** dangling DNS records (point to deleted resources), DNSSEC not enabled, public zones with internal records
- **Cost:** unused hosted zones, health checks for deleted endpoints

#### 4.3 CloudFront CDN (M)
- **Scan:** distributions, origins, behaviors, cache policies
- **Security:** HTTP-only origins, no WAF association, outdated TLS policy, missing access logging, default root object missing
- **Cost:** low-traffic distributions, suboptimal price class

#### 4.4 DynamoDB (M)
- **Scan:** tables, global tables, backups, streams
- **Security:** encryption at rest disabled, no point-in-time recovery, no backup plan
- **Cost:** over-provisioned capacity (vs on-demand), unused tables, no auto-scaling
- **Compliance:** encryption maps to CIS and SOC2 CC6.3

#### 4.5 API Gateway (M)
- **Scan:** REST APIs, HTTP APIs, WebSocket APIs, stages, authorizers
- **Security:** no authorization on endpoints, missing WAF, no access logging, open CORS, no throttling
- **Cost:** unused APIs (no recent invocations)

#### 4.6 SQS/SNS Messaging (S)
- **Scan:** SQS queues, SNS topics, subscriptions
- **Security:** public access policies, no encryption, no DLQ configured (SQS), cross-account access
- **Cost:** empty queues with no consumers

#### 4.7 ElastiCache (S-M)
- **Scan:** Redis/Memcached clusters, replication groups, snapshots
- **Security:** no encryption in transit/at rest, no auth token, public accessibility, outdated engine version
- **Cost:** over-provisioned nodes, unused clusters

#### 4.8 EKS/ECS Containers (XL — last due to complexity)
- **Scan:** EKS clusters, node groups, Fargate profiles; ECS clusters, services, task definitions
- **Security:** public API endpoint, outdated K8s version, privileged containers, no encryption, missing logging
- **Cost:** over-provisioned node groups, idle clusters

### DB & Frontend Changes
- Extend resource type enum in `apps/api/src/db/schema.ts` for each new service
- No structural schema changes — existing resource/finding model supports new types
- Resource type icons, colors, and detail views in frontend
- Filter options in resource/finding list pages

---

## Phase 5: Multi-Cloud Architecture
**Timeline:** Month 5–6 | **Impact:** MEDIUM (future growth)

**Why:** Even though only AWS ships first, designing the abstraction now prevents a painful rewrite later when adding Azure/GCP.

### 5.1 Provider Abstraction Layer (XL, incremental)

**Current:** Scanners directly import AWS SDK and return AWS-specific types.

**Target architecture:**
```
workers/
  internal/
    providers/
      provider.go        # Provider interface
      aws/
        scanner.go       # AWS implementation
        ec2.go, rds.go, s3.go...
      azure/             # Future
        scanner.go
      gcp/               # Future
        scanner.go
    scanner/
      scanner.go         # Orchestrator uses Provider interface
    analyzer/
      analyzer.go        # Works on normalized Resource model
    models/
      resource.go        # Cloud-agnostic resource model
      finding.go         # Cloud-agnostic finding model
```

**Common Resource Model:**
```go
type Resource struct {
    ID           string
    Provider     string                 // "aws", "azure", "gcp"
    AccountID    string                 // AWS account, Azure subscription, GCP project
    Service      string                 // normalized service name
    ResourceType string
    Region       string
    Name         string
    Tags         map[string]string
    Metadata     map[string]interface{} // provider-specific data
    CreatedAt    time.Time
    State        string
}
```

**Approach:** Start with the interface definition, then migrate existing AWS scanners one at a time. Keep analyzer rules cloud-agnostic where possible (encryption, public access, tagging).

### 5.2 Database Schema Changes
- Add `provider` column to resources table (default: "aws")
- Add `provider` column to accounts table
- Generalize "AWS account" → "cloud account" in API/frontend
- Provider-specific account config (AWS: role ARN, Azure: tenant/subscription, GCP: project/SA key)

### 5.3 Frontend Changes
- Provider selector in account setup flow
- Provider icon/badge on resources and findings
- Filter by provider in resource/finding lists
- Provider-specific detail views

---

## Pricing Adjustment

Research shows a gap between Pro (€19, 3 accounts) and Team (€79, 10 accounts). The €19→€79 jump loses users who need 4–7 accounts but don't need team collaboration.

| Tier | Price | Accounts | Key Features |
|---|---|---|---|
| Free | €0/mo | 1 | 1 scan ever |
| Pro | €19/mo | 3 | + webhooks, email digests, finding remediation |
| **Growth (NEW)** | **€39/mo** | **5** | + all Pro features, compliance dashboards |
| Team | €79/mo | 10 | + team collab, API keys, audit logs, export, compliance PDF reports |

**Changes:**
- Move webhooks from Team-only to Pro tier
- Add Growth tier in `apps/api/src/types/index.ts` and Stripe
- Compliance dashboards available from Growth tier, PDF export from Team tier

---

## Implementation Timeline

```
Month 1–2: Phase 1 — Integrations & Notifications
  ├── 1.1 Webhooks → Pro tier (S)
  ├── 1.2 Email digests (M)
  ├── 1.3 Slack integration (M)
  └── 1.4 GitHub Action (S)

Month 2–3: Phase 2 — Compliance Frameworks
  ├── 2.1 CIS AWS Foundations Benchmark mapping (M)
  ├── 2.2 SOC2 control mapping (S-M)
  ├── 2.4 Compliance dashboard + export (M)
  └── New scanner checks needed for compliance gaps (CloudTrail, Config, password policy)

Month 2–4: Phase 3 — AI Remediation & Fix Guides
  ├── 3.1 Deterministic fix templates (M)
  └── 3.2 Contextual severity explanations (L)

Month 3–5: Phase 4 — More AWS Services (incremental)
  ├── 4.1 VPC & Networking (L)
  ├── 4.2 Route53 (S)
  ├── 4.3 CloudFront (M)
  ├── 4.4 DynamoDB (M)
  ├── 4.5 API Gateway (M)
  ├── 4.6 SQS/SNS (S)
  ├── 4.7 ElastiCache (S-M)
  └── 4.8 EKS/ECS (XL)

Month 5–6: Phase 5 — Multi-Cloud Architecture
  ├── 5.1 Provider abstraction layer
  ├── 5.2 DB schema additions
  └── 5.3 Frontend provider support

Anytime: Pricing tier adjustment (Growth tier)
```

---

## Competitive Differentiation Messages

Five core messages that are true today (or soon) and not claimed by any competitor at this price:

1. **"Security and cost analysis in one AWS scan"** — The only self-serve tool under €200/month that finds both what is insecure and what is wasting money.

2. **"5-minute setup, no agents, no code"** — Agentless via IAM role assumption. Nothing to install, maintain, or update.

3. **"Know your SOC2 gaps before the auditor does"** — Explicit positioning for the audit readiness journey every B2B startup faces.

4. **"Built for the team building it"** — Designed for engineers who own their own cloud security, not for a dedicated security team.

5. **"Deeper on AWS than anything else at this price"** — AWS-specialist depth vs. multi-cloud generalist breadth.

---

## Verification Plan

- **Phase 1:** Test webhook delivery with webhook.site, test Slack OAuth flow end-to-end, verify email digest rendering, test GitHub Action in sample repo
- **Phase 2:** Validate CIS control mappings against official CIS benchmark document, verify scoring with known-state AWS account, test PDF export with sample data
- **Phase 3:** Review fix templates against current AWS documentation, test contextual explanations with real multi-resource attack paths
- **Phase 4:** For each scanner: run against test AWS account with known resources, verify findings match expected, check frontend rendering
- **Phase 5:** Verify existing AWS scanning works after provider abstraction, run full test suite after each migration step

---

## Appendix A: Deep Competitive Intelligence (April 2026)

### Closest Competitors by Market Segment

#### Aikido Security (all-in-one for startups, $300-$600/month)
- Covers SAST, SCA, secrets, DAST, IaC, container, CSPM, runtime in one product
- **Why users pay:** 75-92% noise reduction via reachability analysis. User quote: "With Snyk it was 'here's everything, good luck.' With Aikido, the triaging is just done."
- **Secondary trigger:** Jira/Linear + Drata/Vanta integration — becomes evidence feeder for SOC2 audit
- **Weakness:** Cloud/infrastructure coverage is shallow vs. application code scanning; $0→$300 jump is steep
- **ScanOrbit advantage:** Deeper AWS coverage at 1/4 the price; ScanOrbit is specialist, Aikido is generalist

#### Intruder (vulnerability scanner for SMBs, $149-$499/month)
- External vuln scanning + cloud account integration + emerging threat monitoring
- **Why users pay:** Emerging Threat Scans (ETS) — when a new critical CVE drops, Intruder auto-scans all targets before it's fully documented. This is the explicit paywall feature (Cloud tier and above only)
- **Secondary trigger:** Auto-discovery of new cloud resources as infrastructure scales
- **Weakness:** No IaC scanning, shallow cloud misconfig checks vs dedicated CSPM, no cost analysis
- **ScanOrbit opportunity:** Build an "emerging threat" equivalent — auto-rescan when AWS publishes new security advisories

#### Vanta / Drata / Secureframe (compliance automation, $7k-$80k/year)
- Not deep scanners — they are evidence collection + control mapping platforms
- **Why users pay:** First enterprise customer asks for SOC2 report. This is a REVENUE decision, not a security decision
- Cloud scanning is bundled but shallow (basic S3, IAM, SG checks)
- **ScanOrbit opportunity:** Position as the deeper cloud scanning layer that feeds evidence into Vanta/Drata. "Your Vanta setup needs quarterly scans — we generate the scan evidence automatically."

#### Mondoo (unified security + compliance, custom pricing)
- Open-source engines (cnspec/cnquery) + commercial platform
- **Why users pay:** Compliance policy auto-updates (CIS, NIST, ISO) + AI "Remediation Agent" that generates Ansible playbooks/Terraform snippets
- **ScanOrbit opportunity:** The AI remediation direction is where the market is heading. Deterministic fix templates (Phase 3) serve the same need with lower complexity

#### AWS Native Stack (Security Hub + GuardDuty + Inspector + Config + Trusted Advisor)
- **Real cost for 5 AWS accounts:** $400-$1,200/month total, plus $100/month Business Support for full Trusted Advisor
- **Why people still buy third-party:** Fragmentation (5 separate tools), no prioritization, no compliance reports, no cost analysis, no "fix these 5 things first" guidance, no unified multi-account view
- **ScanOrbit pitch:** "Everything you'd get from enabling Security Hub, Config, Trusted Advisor, and a cost analyzer — in one 5-minute setup, at €19/month"

---

## Appendix B: Top 10 Must-Have Features That Convert Free Users to Paying

Ranked by evidence strength across competitor research, user reviews, and practitioner surveys.

### 1. Noise-Reduced, Prioritized Findings (not raw dumps)
**Evidence: Overwhelming** — cited by every competitor's users as the primary value driver.

Every AWS account produces 100-400 raw findings. If all land with equal visual weight, the tool is useless. The conversion happens when users see "You have 187 findings but only 8 require immediate action."

**Implementation:** Risk score per finding combining: severity class + exploitation likelihood (is this internet-facing?) + impact (production DB vs dev S3 bucket). Default view shows max 10-15 critical items. Full list is secondary.

**Build complexity:** Low — scoring algorithm + UI filter. Data already collected.

### 2. Continuous Monitoring with Change-Based Alerts
**Evidence: Strong** — Intruder's entire business model is built on this.

Point-in-time scans leave a gap (dev deploys Monday, scan runs Sunday = 6 days exposed). Users want: scheduled scans + alerts on NEW findings only.

**Implementation:** Compare current scan to previous, alert only on changes. "What changed since last scan" digest email is the minimum viable version.

**Build complexity:** Medium — diff logic on scan results + job queue (Redis exists).

### 3. Compliance-Framed Reports (SOC2, CIS, ISO 27001)
**Evidence: Strong** — 75% of orgs increasing compliance spend in 2025. SOC2 requirement is the #1 purchase trigger.

A raw CSV doesn't satisfy auditors. A PDF labeled "Vulnerability Management Report — Q1 2026 — Meets SOC2 CC7.1 requirements" does.

**Implementation:** Mapping table (finding type → CIS control ID → SOC2 TSC) + PDF template. Already planned in Phase 2.

**Build complexity:** Low-Medium — 2-4 weeks research + template work.

### 4. Actionable Remediation Steps with Exact Commands
**Evidence: Strong** — Mondoo's Remediation Agent, Aikido's AutoFix, Wiz's one-click remediation are all flagship paid features.

The gap between "your S3 bucket has public access" and "run this CLI command to fix it" is the difference between a tool that gets ignored and one that delivers daily value.

**Implementation:** Each finding gets: AWS Console steps, CLI command, Terraform snippet. Already planned in Phase 3.

**Build complexity:** Low — 1-2 weeks of content work for top 20-50 findings.

### 5. Emerging Threat Auto-Scan
**Evidence: Strong** — Intruder's explicit paywall feature and primary upgrade conversion mechanism.

When a new critical CVE drops, the tool auto-scans all accounts and tells you "you're affected / you're safe" within hours. Worth the subscription price alone.

**Implementation:** Monitor AWS security bulletins (SNS/RSS), trigger targeted scans for paid accounts, send proactive alerts.

**Build complexity:** Medium — advisory monitoring + targeted scan trigger.

### 6. Historical Trend / Security Score Over Time
**Evidence: Moderate-Strong** — prevents churn by creating dependency. CTOs show boards "our score went from 58 to 74 this quarter."

**Implementation:** ScanOrbit already stores scan history. Calculate weighted score per scan, display trend chart, generate delta summary.

**Build complexity:** Low — arithmetic on existing data + chart component.

### 7. Jira Integration (Findings → Sprint Tickets)
**Evidence: Strong for retention** — findings in Jira get fixed; findings in a dashboard get ignored.

User quote: "With automations, a Jira ticket gets created, the engineering team reviews it, and resolves security issues within a few days."

**Implementation:** OAuth2 Jira integration, create issues from findings with severity/remediation/resource details. Auto-close when finding is resolved.

**Build complexity:** Medium — Jira OAuth + issue creation API.

### 8. Slack/Email Alerts with Context-Rich Notifications
**Evidence: Moderate** — present in virtually every paid tier as a deliberate paywall.

Not just "you have a new finding" but: what changed, why it matters, how to fix it, in the same notification.

**Implementation:** Already planned in Phase 1.

### 9. Cost + Security Combined View (ScanOrbit's Unique Position)
**Evidence: Moderate** — no competitor offers this combination at €19-€79/month. This is the clearest gap.

"This ElasticSearch cluster is misconfigured AND costs €340/month AND hasn't served a request in 6 weeks." The dollar amount creates urgency that pure security findings don't.

**Implementation:** AWS Cost Explorer API or resource pricing data per resource. Combined findings view.

**Build complexity:** Medium.

### 10. Shareable Security Report / Trust Page
**Evidence: Moderate** — Vanta charges $10k+/year partly because Trust Center is a public credibility signal.

Use case: enterprise prospect asks "can you share your security posture?" A one-page PDF with company name, score, findings summary, and ScanOrbit badge answers this.

**Implementation:** PDF export + optional shareable public URL with token access.

**Build complexity:** Low-Medium.

---

## Appendix C: Key Purchase Trigger Evidence

**The #1 purchase trigger is compliance, not security fear.**
- 75% of orgs plan to increase compliance spending in 2025 (Prowler State of Cloud Security 2025)
- The trigger: an enterprise prospect sends a vendor security questionnaire or requires SOC2 Type II. The CTO has 60 days to respond or lose the deal.

**The #1 churn driver is alert fatigue.**
- SOC teams receive 4,484 alerts/day average; 67% are ignored (IBM 2024)
- 71% of orgs use 10+ security tools, nearly half receive 500+ alerts daily (Upwind 2024)
- 84% of cybersecurity professionals reported burnout in 2024

**The conversion window is 30 minutes.**
- Wiz: "Mean time to visibility dropped from 12 days to under 30 minutes"
- Orca: "Implementation completed in less than an hour"
- If the tool hasn't shown at least 1 actionable critical finding in the first session, conversion collapses

**Pricing model matters as much as price.**
- Per-seat pricing kills adoption for small teams (penalizes adding viewers)
- Per-resource (Prowler: $0.001/resource/day) or flat-fee (Aikido: $300/month for 10 users) works best
- Enterprise quote-based pricing is a complete blocker for self-serve segment
- ScanOrbit's flat per-tier pricing is well-positioned

**Non-obvious retention drivers:**
- Jira/Slack integration that routes findings into existing workflows
- Responsive founder-level support in first 90 days
- Fast feature velocity that signals the product isn't stagnant
- Historical trend data that creates dependency ("I can't lose my 6 months of posture history")
