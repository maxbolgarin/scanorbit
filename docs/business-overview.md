# ScanOrbit — Business Overview

## Product Overview

ScanOrbit is an agentless AWS infrastructure scanner delivered as a SaaS platform. It connects to customers' AWS accounts through read-only IAM roles, automatically discovers all cloud resources across every region, and analyzes them for security risks, compliance violations, cost waste, and operational issues.

The core value: organizations get complete visibility into their AWS infrastructure — what they have, what's at risk, what's costing them money, and what violates regulations — without installing anything on their servers.

**Domain:** Cloud security, infrastructure visibility, compliance automation, cost optimization.

**Hosted at:** scanorbit.cloud

---

## Target Users

- **DevOps / Platform engineers** managing AWS infrastructure who need a centralized inventory and automated security checks
- **Security engineers** responsible for identifying misconfigurations and ensuring best practices
- **CTOs / Engineering leaders** who need compliance reporting and cost oversight across teams
- **Startups and SMBs** that lack dedicated security teams but still need to meet compliance requirements (especially GDPR)

---

## Core Capabilities

### 1. Cloud Inventory Discovery
Scans AWS accounts and catalogs all resources across all regions. Supported services: EC2 instances, EBS volumes/snapshots, RDS databases/snapshots, S3 buckets, Application Load Balancers, Lambda functions, IAM users/roles/policies, KMS keys, Secrets Manager secrets, CloudWatch logs/alarms, and Security Groups.

Each resource is tracked with its metadata, tags, region, state, and estimated monthly cost.

### 2. Security Analysis
Detects security misconfigurations:
- Permissive security groups (open to the internet)
- Unencrypted resources (EBS volumes, RDS instances)
- Publicly accessible resources (S3 buckets, RDS databases)
- Insecure TLS/SSL configurations
- IAM issues: users without MFA, old/unused access keys, unused roles, overly permissive policies, risky cross-account trust

### 3. Compliance & Data Residency
Critical for GDPR-regulated organizations:
- Detects resources deployed outside EU regions (data residency violations)
- Enforces required tagging policies (e.g., Environment, Owner, CostCenter)
- Maintains audit logs of all platform access
- Supports Right to Erasure (account deletion with 30-day grace period)
- Supports Right to Data Portability (full data export in JSON)
- Configurable data retention policies

### 4. Cost Optimization
Identifies resources that are wasting money:
- Stopped EC2 instances still incurring costs
- Unattached EBS volumes and Elastic IPs
- Old-generation instance types
- Oversized instances and Lambda functions
- Unused KMS keys, log groups, and NAT Gateways
- Old RDS snapshots beyond retention thresholds

### 5. SSL/TLS Certificate Monitoring
Tracks certificate expiration for both AWS Certificate Manager (ACM) certificates and endpoint SSL certificates:
- Critical: expired or expiring within 7 days
- Medium: expiring within 30 days
- Low: expiring within 60 days

### 6. Orphaned Resource Detection
Finds resources that are no longer attached or in use:
- Unattached EBS volumes (idle >7 days)
- Unassociated Elastic IPs (idle >3 days, costing ~$3.65/month each)
- Unattached network interfaces
- Idle NAT Gateways
- Unused security groups
- Stopped EC2 instances

### 7. Resource Dependencies & Infrastructure Map
Tracks relationships between resources (e.g., a Lambda function using an IAM role, an EC2 instance in a VPC/security group). Provides a visual infrastructure dependency map so users can understand how their resources connect.

### 8. Finding Management
Every detected issue becomes a "finding" with a full lifecycle:
- **Statuses:** Open → Resolved / Snoozed / Ignored
- **Severity levels:** Critical, High, Medium, Low, Trivial
- Bulk update operations for managing findings at scale
- Finding history and timeline tracking
- Detection count tracking (how many times an issue reappears)

---

## How It Works

1. **Connect** — User adds their AWS account by creating a read-only IAM role with a unique external ID. No AWS credentials are stored by ScanOrbit.
2. **Scan** — ScanOrbit assumes the IAM role and scans all AWS regions concurrently, discovering resources across supported services.
3. **Analyze** — Eight specialized analyzers process the scan results: orphan detection, SSL monitoring, security analysis, IAM analysis, cost optimization, tagging compliance, data residency checks, and orchestration.
4. **Review** — Users see their complete infrastructure inventory, findings sorted by severity, cost estimates, and compliance status in the web dashboard.
5. **Act** — Users resolve, snooze, or ignore findings. They can re-scan to verify fixes. The platform tracks finding resolution over time.

---

## Subscription Tiers

### Free
- One successful scan ever (can retry on errors)
- Cannot access resource or finding lists
- No infrastructure map
- Maximum 1 AWS account
- Purpose: evaluation and first look

### Pro
- Unlimited scans with 60-minute cooldown between scans
- Full access to resources, findings, and infrastructure map
- Maximum 1 AWS account
- 7-day free trial (card required, no charge during trial)

### Team
- Unlimited scans with no cooldown
- All Pro features
- Unlimited AWS accounts
- Multi-user organization support with role-based access (Admin, Member)
- Organization overview dashboard
- 7-day free trial (card required, no charge during trial)

---

## Business Rules

| Rule | Detail |
|------|--------|
| Scan cooldown (Pro) | 60 minutes between scans per account |
| Scan cooldown (Team) | None |
| Free tier limit | 1 successful scan ever; retries allowed on errors |
| Trial period | 7 days for Pro and Team tiers (card required) |
| Access token lifetime | 5 minutes |
| Refresh token lifetime | 7 days |
| Resource retention (stale) | 90 days |
| Resolved finding retention | 180 days |
| Scan history retention | 365 days |
| Audit log retention | 730 days (2 years) |
| Deletion grace period | 30 days after account deletion request |
| Retention cleanup schedule | Daily at 03:00 UTC |
| Required tags (default) | Environment, Owner, CostCenter |

---

## Platform Components

| Component | Role |
|-----------|------|
| **Web Application** | React-based dashboard where users view resources, findings, scans, and settings |
| **Landing Page** | Astro-based marketing site at the root domain |
| **API** | Central backend handling authentication, data access, billing, and orchestration |
| **Scanner Worker** | Background service that connects to AWS and discovers resources |
| **Analyzer Worker** | Background service that processes scan results through 8 specialized analyzers |
| **Database** | PostgreSQL storing all application data with encrypted connections |
| **Cache & Queue** | Redis for job queuing (scan/analysis tasks) and caching |
| **Reverse Proxy** | Caddy handling HTTPS, automatic TLS certificates, and subdomain routing |
| **Monitoring Stack** | Prometheus + Grafana + Loki + Alertmanager for observability and alerting |
| **Backup Service** | Automated daily encrypted backups to EU-based object storage |

---

## External Integrations

| Integration | Purpose |
|-------------|---------|
| **AWS (IAM Role Assumption)** | Read-only access to scan customer infrastructure; no credentials stored |
| **Stripe** | Subscription billing, checkout sessions, customer portal, webhooks |
| **Google OAuth** | Social login for user authentication |
| **GitHub OAuth** | Social login for user authentication |
| **SMTP / Resend** | Transactional emails (verification, password reset, notifications) |
| **Scaleway Object Storage** | Encrypted backup storage in Amsterdam (EU/GDPR-compliant) |
| **Let's Encrypt** | Automatic TLS certificate provisioning via Caddy |
| **Slack** | Alert notifications for operational monitoring |
| **Telegram** | Alert notifications for operational monitoring |

---

## Security & Compliance

**Authentication:**
- Email/password with email verification
- Google and GitHub OAuth
- Two-factor authentication (TOTP) with encrypted secrets and recovery codes
- Short-lived access tokens (5 min) with refresh token rotation (7 days)

**Data Protection:**
- TLS encryption for all connections (external and internal)
- Encrypted database backups stored in EU region
- No AWS credentials stored — uses temporary role assumption
- OAuth tokens encrypted at rest
- Password hashing with bcrypt

**GDPR Compliance:**
- All infrastructure hosted in EU (Amsterdam)
- Data residency analyzer flags non-EU resources in customer accounts
- Full audit logging of all API access (user, action, timestamp, IP)
- Consent tracking for terms of service and marketing
- Right to Erasure: 30-day grace period, then permanent deletion
- Right to Data Portability: full JSON export of user data
- Configurable data retention policies with automated cleanup

**Operational Security:**
- Prometheus-based monitoring with alerting to Slack and Telegram
- Health checks on all services with automatic restarts
- Database and cache connection monitoring
- Job queue health monitoring with dead letter queue tracking

---

## Domain Glossary

| Term | Definition |
|------|------------|
| **Resource** | An AWS infrastructure item (EC2 instance, S3 bucket, IAM role, etc.) discovered during a scan |
| **Finding** | A detected issue — security risk, compliance violation, cost waste, or operational problem — with severity and lifecycle status |
| **Scan** | A single execution of the discovery process across all regions of an AWS account |
| **Analysis** | The post-scan phase where 8 analyzers evaluate resources and generate findings |
| **Organization** | A team workspace that owns AWS accounts and contains members with roles |
| **AWS Account** | A customer's AWS account connected via IAM role for scanning |
| **Severity** | Finding importance: Critical > High > Medium > Low > Trivial |
| **Finding Status** | Lifecycle state: Open (active issue), Resolved (fixed), Snoozed (temporarily deferred with expiry), Ignored (dismissed) |
| **IAM Role Assumption** | The mechanism by which ScanOrbit temporarily gains read-only access to a customer's AWS account without storing credentials |
| **External ID** | A unique identifier used during IAM role assumption to prevent confused deputy attacks |
| **Data Residency** | The requirement that data and resources reside within specific geographic regions (e.g., EU for GDPR) |
| **Retention Policy** | Rules defining how long different types of data (resources, findings, scans, audit logs) are kept before automated cleanup |
| **Infrastructure Map** | A visual graph showing how resources relate to each other (dependencies, VPC membership, role usage, etc.) |
