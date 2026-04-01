# ScanOrbit Competitive Analysis — Cloud Security & Infrastructure Scanning Market
**Date:** March 2026

---

## Executive Summary

The cloud security posture management (CSPM) market is on track to reach $10.63 billion by 2030, growing at 15.2% CAGR. The market is bifurcated between enterprise platforms priced well above $24,000/year and open-source tooling that requires significant self-hosting expertise. The $500–$5,000/year band for AWS-first, developer-friendly SaaS is sparsely populated, and that is the gap ScanOrbit is best positioned to own.

ScanOrbit's current stack — agentless IAM role assumption, Go workers for scanning and analysis, multi-category findings (security, cost, orphans, IAM, tagging, SSL, residency), and a React/Hono SaaS shell — is technically competitive for the AWS SMB segment. The product is not yet complete, but its architecture avoids the structural mistakes that make incumbents expensive and noisy.

---

## Part 1: Competitor Profiles

### 1.1 AWS-Focused Open-Source Scanners

---

#### Prowler

**Type:** Open-source CLI + commercial SaaS  
**Approach:** Agentless (read-only IAM, API-based)  
**Multi-cloud:** AWS, Azure, GCP, Kubernetes  

**Key features:**
- 1,000+ security checks across all major AWS services
- Compliance frameworks: CIS, PCI-DSS, ISO 27001, GDPR, HIPAA, FFIEC, SOC 2, ENS, AWS FTR
- Commercial tier adds continuous monitoring, dashboards, SSO, SIEM integrations, AWS Security Lake (Parquet), and an AI assistant ("Lighthouse AI")
- MCP Server (model context protocol) for AI tool integrations

**Pricing:**
- Open source: free (CLI, self-hosted)
- Cloud Advanced: $99/account/month or $79/account/month billed annually
- Cloud Enterprise: custom
- Optional add-ons: dedicated TAM ($50,000/year), custom checks ($10,000/check), custom training ($5,000/day)

**What makes users choose it:** The most established open-source AWS scanner. Large community, well-known compliance mappings, and the brand recognition of being the default CLI choice for AWS security audits. Teams that know it from penetration testing use the SaaS upgrade as an easy upsell.

**Weaknesses:** The open-source version requires self-hosting, pipelines, and report parsing. The SaaS pricing jumps steeply — $79/account/month means a company with 5 accounts pays $395/month ($4,740/year) before needing any enterprise features. No cost optimization angle.

---

#### ScoutSuite

**Type:** Open-source CLI only  
**Approach:** Agentless (API-based, Python)  
**Multi-cloud:** AWS, Azure, GCP, Oracle, IBM  

**Key features:**
- HTML reports of misconfigurations and security posture
- NCC Group provides commercial assessments built on top of it

**Pricing:** Free (CLI only). No SaaS product.

**Status:** Effectively stalled — last version (v5.14.0) released May 2024. Newer AWS services and API changes are not covered. Increasingly outdated.

**What makes users choose it:** Lightweight, no SaaS account required, generates a portable HTML report. Still used by penetration testers for one-off audits.

**Weaknesses:** No continuous monitoring, no SaaS offering, no cost analysis, increasingly lagging on new AWS services. Not a competitive threat; more an indicator of demand for simple HTML-style reports.

---

#### CloudSploit (Aqua)

**Type:** Open-source + SaaS (owned by Aqua Security)  
**Approach:** Agentless  
**Multi-cloud:** AWS, Azure, GCP, Oracle, GitHub  

**Key features:**
- Designed for ongoing monitoring (not just one-off audits)
- Open source under Aqua ownership
- SaaS offers dashboard, scheduled scans, alerting

**Pricing:** Free open source; SaaS starts at $8/month (limited). Full-featured plans require contact.

**What makes users choose it:** Extremely low-cost entry point. Multi-cloud from day one.

**Weaknesses:** Aqua's attention has shifted to CNAPP (full platform); CloudSploit receives minimal investment. Lacks cost optimization, advanced IAM analysis, and modern UX.

---

#### Steampipe

**Type:** Open-source SQL query engine + compliance mods  
**Approach:** Agentless (plugins connect to cloud APIs)  
**Multi-cloud:** AWS, Azure, GCP, Cloudflare, Alibaba, IBM, and 100+ plugins  

**Key features:**
- SQL interface over cloud APIs — query any resource like a database table
- Compliance mods: CIS, SOC 2, HIPAA, NIST, and more
- Powerpipe for dashboards and benchmarks on top of Steampipe data
- Turbot Pipes is the commercial SaaS layer

**Pricing:** Open source is free. Turbot Pipes (SaaS) has a free tier and paid plans by usage.

**What makes users choose it:** Engineers who want ad-hoc investigation power. Extremely flexible — if AWS adds a new service, a plugin can cover it without waiting for vendor updates.

**Weaknesses:** High learning curve. Requires writing or finding the right SQL queries. Not suited for non-technical stakeholders. No built-in cost analysis engine. Continuous monitoring requires orchestration setup.

---

### 1.2 Multi-Cloud CSPM / CNAPP Platforms

---

#### Wiz

**Type:** Enterprise CNAPP SaaS  
**Approach:** 100% agentless  
**Multi-cloud:** AWS, Azure, GCP, OCI, Alibaba Cloud, VMware  

**Key features:**
- Single platform covering CSPM, KSPM, CWPP, CIEM, DSPM, IaC scanning, vulnerability management, container/Kubernetes security
- "Security Graph" — correlates resources, identities, and data across environments to surface toxic attack paths, not just isolated alerts
- Automated remediation workflows
- Recognized Forrester CNAPP Leader Q1 2026

**Pricing:**
- Wiz Essential: ~$24,000/year for 100 workloads
- Wiz Advanced: ~$38,000/year for 100 workloads
- Typical contract range: $24,000–$354,000, median spend ~$111,500/year

**What makes users choose it:** The Security Graph is genuinely differentiated — instead of 4,700 isolated findings, it surfaces 5 critical attack paths. Developer experience is reportedly best-in-class. Google acquired Wiz at $32 billion valuation, validating its market position.

**Weaknesses:** Price is prohibitive for startups and small teams. Minimum practical spend is ~$24,000/year. No self-serve signup — requires sales contact and demo. The breadth of the platform creates a very long sales cycle. SMBs cannot justify the cost or complexity.

---

#### Orca Security

**Type:** Enterprise CNAPP SaaS  
**Approach:** Agentless (patented SideScanning technology — reads block storage snapshots without deploying agents)  
**Multi-cloud:** AWS, Azure, GCP  

**Key features:**
- SideScanning reads disk snapshots for deep vulnerability and malware detection without performance impact
- Full CSPM, vulnerability management, compliance, threat detection
- "In-Account" mode keeps data in customer's cloud for compliance-sensitive customers

**Pricing:** Custom quotes; described as "reasonable but high." Community feedback places it below Wiz but above Prisma Cloud in price-to-value. Typically $40,000–$150,000/year for mid-market accounts.

**What makes users choose it:** SideScanning is unique — deep workload inspection without an agent. Good for companies that need vulnerability scanning AND posture management in one tool.

**Weaknesses:** Still enterprise-only pricing and sales cycle. No transparent self-serve pricing. Cost optimization is not a core focus. Like Wiz, not designed for small teams or single-account setups.

---

#### Lacework (FortiCNAPP)

**Type:** Enterprise CNAPP SaaS (now Fortinet FortiCNAPP after acquisition)  
**Approach:** Primarily agent-based, with agentless options  
**Multi-cloud:** AWS, Azure, GCP  

**Key features:**
- Behavioral anomaly detection using ML (not just rule-based checks)
- Polygraph data model — maps all entities and behaviors to identify unusual patterns
- CSPM, vulnerability management, threat detection, IaC scanning
- Now bundled with Fortinet's broader security portfolio

**Pricing:**
- Starts around $25,000–$80,000/year
- 100 seats: ~$9,800 list price; significant discounts available at scale
- Agentless packages ~20–30% cheaper than agent-based equivalents

**What makes users choose it:** ML-based anomaly detection catches threats rules miss. Good fit for enterprises already in the Fortinet ecosystem post-acquisition.

**Weaknesses:** The Fortinet acquisition has introduced integration complexity. Agent-first history means full agentless coverage is newer. High minimum cost. The Lacework brand is being absorbed into FortiCNAPP, creating customer uncertainty.

---

#### Prisma Cloud (Palo Alto Networks)

**Type:** Enterprise CNAPP SaaS  
**Approach:** Agent + agentless hybrid  
**Multi-cloud:** AWS, Azure, GCP, OCI, Alibaba Cloud  

**Key features:**
- Most comprehensive compliance framework coverage in the market (SOC 2, PCI DSS, HIPAA, HITRUST, FedRAMP, GDPR, ISO 27001, NIST, CIS, and more)
- IaC scanning (includes Checkov under the hood), runtime protection, DSPM
- Credit-based consumption model for granular module control

**Pricing:**
- Credit-based model: $9,000 per 100 credits entry point
- Total cost very hard to forecast due to credit consumption per feature per resource per hour
- Actual contracts range from $60,000 to $500,000+/year for enterprise
- Described by users as "expensive and hard to digest"

**What makes users choose it:** Deepest compliance coverage and longest track record. Mandated by procurement in many regulated industries (finance, healthcare). Tightly integrated with Palo Alto's broader security platform.

**Weaknesses:** The credit model is the most complained-about aspect — budgeting is unpredictable. Complexity is extreme; requires dedicated security team to operate. Not remotely accessible to SMBs. Alert volume is a persistent complaint even at the enterprise level.

---

#### Aqua Security

**Type:** Enterprise CNAPP SaaS  
**Approach:** Agent + agentless hybrid (patented SideScanning inherited from merged tfsec/Trivy lineage)  
**Multi-cloud:** AWS, Azure, GCP  

**Key features:**
- Container and Kubernetes security is the original strength; CSPM added later
- Now covers CSPM, KSPM, IaC scanning, runtime protection, supply chain security
- Maintains Trivy and Checkov as open-source projects (strategic OSS anchors)
- Supply chain security is an emerging differentiator

**Pricing:** Custom subscription based on workloads and modules; typically enterprise-range.

**What makes users choose it:** Best container/Kubernetes runtime security, now combined with CSPM. Teams running containerized workloads heavily on AWS EKS gravitate here.

**Weaknesses:** Trivy suffered a supply chain compromise in March 2026 (GitHub Actions tags hijacked, malicious images published to Docker Hub, vulnerability DB suspended as of March 25, 2026) — significant reputational damage at the time of this analysis. Pricing remains opaque and enterprise-oriented.

---

### 1.3 Cost Optimization Tools

---

#### Vantage

**Type:** Multi-cloud cost management SaaS  
**Approach:** API-based (no agents)  
**Coverage:** AWS, Azure, GCP, Kubernetes, Snowflake, Datadog, OpenAI, MongoDB, and 20+ others  

**Key features:**
- Cost allocation with virtual tagging (no engineering changes required)
- Automated FinOps Agent removes waste (unattached EBS volumes, obsolete snapshots) based on configurable policies
- Real-time cost anomaly detection
- Hierarchical budgeting at org scale
- Autopilot: autonomous optimization priced at 5% of savings generated

**Pricing:**
- Subscription tiers based on monthly tracked cloud spend (not user seats)
- Autopilot charged separately at 5% of savings
- Free tier available; paid tiers scale with spend volume

**What makes users choose it:** Best-in-class multi-cloud cost visibility with the simplest pricing model. No per-seat costs. The FinOps Agent for automated waste removal is a strong differentiator.

**Weaknesses:** Pure cost focus — zero security posture or compliance. Does not replace a CSPM tool. Engineers who want both security and cost in one place must buy two products.

---

#### CloudHealth (VMware/Broadcom)

**Type:** Multi-cloud cost management and governance SaaS  
**Approach:** API-based  

**Key features:**
- Multi-cloud spend visibility, RI/Savings Plan management, chargeback/showback
- Governance policies for cost and compliance tagging
- Strong enterprise reporting

**Pricing:** Enterprise pricing, typically $50,000+/year. Broadcom acquisition has raised concerns about price increases and product direction.

**What makes users choose it:** Deep enterprise integrations, mature product, established in large organizations.

**Weaknesses:** Broadcom ownership has created significant customer anxiety about long-term roadmap and pricing. Heavy, not suited to SMBs. No security posture features.

---

#### Infracost

**Type:** Open-source CLI + commercial SaaS  
**Approach:** Shift-left cost analysis (IaC-based, not runtime)  
**Coverage:** AWS, Azure, GCP (Terraform/CloudFormation/CDK-based)  

**Key features:**
- Shows cost impact of Terraform/IaC changes in CI/CD pull requests before deployment
- AutoFix generates PRs with cost-optimized infrastructure
- Tagging policy enforcement at the code level
- AWS Compute Optimizer integration

**Pricing:**
- CLI: free, open source
- Cloud platform (team features, CI/CD, Slack): starts at $50/month

**What makes users choose it:** The only tool that catches expensive changes before they reach production. Beloved by DevOps/platform engineering teams. Very developer-friendly.

**Weaknesses:** Does not analyze running infrastructure — it only looks at IaC. Cannot detect costs from manual console changes or workloads not managed by IaC. Complementary to (not a replacement for) runtime cost scanners.

---

#### Spot.io (NetApp)

**Type:** Enterprise cloud infrastructure optimization  
**Approach:** Agent + API  
**Coverage:** AWS, Azure, GCP  

**Key features:**
- Spot Instance management — automatically replaces on-demand instances with Spot instances with interruption handling
- Elastigroup and Ocean for container workload optimization
- Claims 60–90% compute cost reductions through Spot orchestration

**Pricing:** Enterprise, percentage-of-savings model. Minimum viable customer is a mid-market company spending $100,000+/month on compute.

**What makes users choose it:** For companies with large EC2 or EKS fleets, the savings are dramatic and the ROI is clear. Best-in-class Spot Instance orchestration.

**Weaknesses:** Completely inaccessible to small teams or startups. Requires engineering investment to integrate. Zero security posture features.

---

### 1.4 Open-Source IaC / Static Scanners

---

#### Checkov (Palo Alto / Bridgecrew)

**Type:** Open-source IaC security scanner  
**Approach:** Static analysis (pre-deployment)  
**Coverage:** Terraform, CloudFormation, Kubernetes, Helm, Dockerfile, ARM, Bicep, CDK, Kustomize, OpenTofu, Serverless Framework  

**Key features:**
- 1,000+ IaC policies including 800 graph-based cross-resource checks
- Detects relationships between resources (e.g., whether an S3 bucket's policy allows public access via multiple paths)
- CLI + CI/CD integration
- Maintained by Palo Alto (Prisma Cloud's open-source anchor)

**Pricing:** Free, Apache 2.0. Palo Alto's commercial Prisma Cloud builds on top.

**What makes users choose it:** The deepest IaC policy coverage, especially for Terraform. Cross-resource graph checks catch things other static scanners miss.

**Weaknesses:** Static only — does not scan live infrastructure or detect configuration drift. If a resource was created via the console, Checkov cannot see it. Runtime posture requires a separate tool.

---

#### tfsec / Trivy (Aqua Security)

**Type:** Open-source scanner (IaC + containers + Kubernetes + SBOM)  
**Approach:** Static + runtime  
**Coverage:** Terraform, CloudFormation, Kubernetes, container images, SBOMs, dependencies  

**Key features:**
- tfsec was merged into Trivy — the standalone tfsec repo now redirects to Trivy
- Single binary covering IaC, container images, dependencies, live Kubernetes clusters, license scanning
- Breadth over depth: catches most common misconfigurations, but lacks Checkov's cross-resource graph checks

**Pricing:** Free, Apache 2.0.

**Status warning:** As of March 2026, Trivy's release infrastructure was compromised in a supply chain attack (GitHub Actions tags hijacked, malicious Docker Hub images, vulnerability DB updates suspended as of March 25, 2026). Organizations using Trivy in CI/CD should be aware and verify integrity before running.

**What makes users choose it:** One tool for everything from IaC to containers. Simpler than running Checkov + a separate container scanner.

**Weaknesses:** Supply chain incident damages trust. No live cloud infrastructure scanning. No cost analysis.

---

#### KICS (Checkmarx)

**Type:** Open-source IaC security scanner  
**Approach:** Static analysis  
**Coverage:** Terraform, CloudFormation, Kubernetes, Dockerfile, Ansible, Helm, and more  

**Key features:**
- 2,000+ queries across infrastructure frameworks
- Owned by Checkmarx; commercial integrations available

**Pricing:** Free, Apache 2.0.

**What makes users choose it:** Very broad framework coverage, good for polyglot infrastructure shops.

**Weaknesses:** No runtime scanning, no cost optimization, no live AWS scanning.

---

## Part 2: Feature Comparison Matrix

| Capability | ScanOrbit (current) | Prowler Cloud | Wiz | Orca | Lacework | Vantage | Checkov |
|---|---|---|---|---|---|---|---|
| **Agentless AWS scanning** | Yes | Yes | Yes | Yes | Partial | Yes | Static only |
| **Multi-cloud** | AWS only | AWS/Azure/GCP/K8s | 6 clouds | AWS/Azure/GCP | AWS/Azure/GCP | 20+ | AWS/Azure/GCP |
| **Security findings** | Yes | Yes | Yes | Yes | Yes | No | Yes (IaC) |
| **Cost optimization findings** | Yes | No | No | No | No | Yes | Partial |
| **IAM analysis** | Yes | Yes | Yes | Yes | Yes | No | Partial |
| **SSL/TLS certificate tracking** | Yes | Yes | No | No | No | No | No |
| **Orphan resource detection** | Yes | Partial | No | No | No | Yes | No |
| **Tagging compliance** | Yes | Partial | Yes | Yes | Yes | Yes | Yes |
| **Data residency checks** | Yes | No | Yes | Yes | No | No | No |
| **Compliance frameworks** | None built-in | CIS, PCI, SOC2, HIPAA, etc. | CIS, PCI, SOC2, HIPAA, etc. | CIS, PCI, SOC2, etc. | CIS, SOC2, HIPAA, etc. | None | CIS, PCI, SOC2 |
| **Continuous/scheduled scans** | Yes (team tier) | Yes | Yes | Yes | Yes | Yes | CI/CD only |
| **Infrastructure map/graph** | Yes | No | Security Graph | No | Polygraph | No | No |
| **Webhooks/alerts** | Yes (team tier) | Yes | Yes | Yes | Yes | Yes | CI/CD hooks |
| **API access** | Yes (team tier) | Yes | Yes | Yes | Yes | Yes | CLI only |
| **Automated remediation** | No | No (SaaS) | Yes | Yes | Yes | Yes (Autopilot) | AutoFix (IaC) |
| **Self-serve signup** | Yes | Yes | No | No | No | Yes | N/A |
| **Entry price** | TBD | $79/account/mo | ~$24,000/yr | ~$40,000/yr | ~$25,000/yr | Usage-based | Free |
| **AI/LLM features** | No | Lighthouse AI | Yes | Yes | Yes | Yes | No |

---

## Part 3: Pricing Comparison

| Tool | Model | Entry Cost | Mid-Market Cost | Notes |
|---|---|---|---|---|
| **Prowler Cloud** | Per account/month | $79/acc/mo (annual) | $395/mo (5 accounts) | 20% discount for annual; enterprise custom |
| **Wiz** | Per workload / % cloud spend | ~$24,000/yr (100 workloads) | $111,500/yr median | Requires sales call; no self-serve |
| **Orca Security** | Custom / per asset | ~$40,000–$60,000/yr | $100,000+/yr | High but described as "reasonable ROI" |
| **Lacework** | Per seat (custom) | ~$25,000/yr | $49,000–$98,000/yr (500–1000 seats) | 21–46% discounts at scale; agentless 20–30% cheaper |
| **Prisma Cloud** | Credit-based | ~$9,000/100 credits | $60,000–$500,000+/yr | Unpredictable budgeting; complexity tax |
| **Aqua Security** | Per workload (custom) | Enterprise only | Enterprise only | No self-serve |
| **Vantage** | % of tracked cloud spend | Free tier available | Scales with spend | Autopilot: 5% of savings generated |
| **CloudHealth** | Enterprise custom | ~$50,000+/yr | $100,000+/yr | Broadcom pricing concerns |
| **Infracost** | Per user/seat | $0 (CLI) / $50/mo (teams) | ~$200–500/mo | Only shift-left, not runtime |
| **Aikido** | Per team/accounts | $0 (free, 1 cloud account) | $300–$600/mo (10 accounts) | Dev-first, broad app security scope |
| **CloudSploit** | Freemium + SaaS | Free / $8/mo | Unknown | Low investment from Aqua |
| **Prowler OSS** | Free | $0 | $0 | Self-hosted, no SaaS UI |
| **Checkov / Trivy / KICS** | Free | $0 | $0 | Static/IaC only |

**Pricing gap identified:** The $30–$200/month self-serve SaaS band for 1–10 AWS accounts with genuine security + cost analysis in one product is essentially empty. Prowler Cloud is the closest at $79/account/month but has no cost optimization angle. Aikido covers the price band but is a broad app security product, not an AWS-specialist.

---

## Part 4: Compliance Frameworks — Current vs. Needed

ScanOrbit currently has **no built-in compliance framework mapping**. This is a significant gap versus Prowler Cloud and the enterprise CSPM platforms.

| Framework | Prowler | Wiz | Orca | Prisma | ScanOrbit |
|---|---|---|---|---|---|
| CIS AWS Foundations v1.4 / v2.0 / v3.0 | Yes | Yes | Yes | Yes | No |
| SOC 2 | Yes | Yes | Yes | Yes | No |
| PCI DSS | Yes | Yes | Yes | Yes | No |
| HIPAA | Yes | Yes | Yes | Yes | No |
| GDPR | Yes | Yes | Yes | Yes | No |
| ISO 27001 | Yes | Yes | Yes | Yes | No |
| NIST 800-53 | Yes | No | Yes | Yes | No |
| AWS FTR (Foundational Technical Review) | Yes | No | No | No | No |

The most demanded compliance frameworks for the AWS SMB/startup segment (in order) are:

1. **CIS AWS Foundations Benchmark** — universally expected, well-understood
2. **SOC 2** — required for most B2B SaaS customers
3. **HIPAA** — healthcare segment gating requirement
4. **PCI DSS** — e-commerce and fintech gating requirement
5. **ISO 27001** — European market and enterprise procurement

---

## Part 5: Positioning Map

```
                    HIGH PRICE
                        |
     Prisma Cloud       |      Wiz
     (complex/opaque)   |  (best UX, enterprise)
                        |
   Lacework             |     Orca
   (ML anomaly)         |  (SideScanning)
                        |
------- SECURITY -------+------- SECURITY+COST ------
     (only security)    |     (both)
                        |
   Prowler Cloud        |     Aikido
   (security/compliance)|  (dev-first, broad)
                        |
   CloudSploit          | ** ScanOrbit gap **
   (multi-cloud cheap)  |  (AWS-deep, sec+cost)
                        |
     Vantage            |    Infracost
    (cost only)         |   (shift-left cost)
                        |
                    LOW PRICE
```

**ScanOrbit's intended position:** Low-to-mid price, AWS-specialized, security + cost combined, self-serve, agentless, developer-friendly. No direct competitor occupies this exact position at scale.

---

## Part 6: Market Gaps and Opportunities

### Gap 1: Combined Security + Cost in One Affordable Product

Every CSPM platform ignores cost optimization. Every cost optimization tool ignores security. Teams must buy and maintain two products, two integrations, two dashboards, and two billing relationships.

ScanOrbit already has both security findings (permissive SGs, unencrypted resources, public access, IAM risks) and cost findings (orphaned EBS volumes, stopped instances, oversized instances, old-gen RDS, unused NAT gateways) in the same scan pipeline. This is a genuine differentiator that none of the enterprise platforms offer.

**Opportunity:** Market ScanOrbit explicitly as "the only AWS tool that tells you both what is insecure AND what is wasting money in one scan."

---

### Gap 2: Transparent, Predictable Self-Serve Pricing for 1–10 Accounts

Enterprise platforms require sales calls, demos, and annual contracts. Prowler Cloud is the only AWS-focused SaaS with a self-serve model, but at $79–$99/account/month it becomes expensive quickly. A team with 3 AWS accounts (dev, staging, prod) pays $237–$297/month just for Prowler's security scanning — with zero cost optimization.

**Opportunity:** A flat-rate pricing model targeting the most common configuration (1–5 accounts) in the $49–$149/month range is dramatically cheaper than Prowler Cloud and completely unavailable from enterprise vendors. Credit-card-first, immediate access, no demo required.

---

### Gap 3: The "Startup Security Baseline" Use Case

Startups and scale-ups preparing for SOC 2 Type 2 certification, ISO 27001, or their first enterprise security questionnaire have a specific and well-defined need: "tell me what I need to fix to pass this audit." No tool in the market is explicitly positioned for this journey.

Prowler Cloud covers the compliance frameworks but is priced for teams that have already passed the audit. Checkov covers IaC but not the live AWS environment. AWS Security Hub is AWS-only and requires significant manual setup.

**Opportunity:** Position ScanOrbit as the "security readiness" tool for startups. "Connect your AWS account, see your SOC 2 gaps, fix them before the auditor comes." This is a landing page angle, not a feature change.

---

### Gap 4: Alert Fatigue Reduction

The number one complaint across all CSPM platforms, including Wiz (which is the market leader in UX quality), is alert volume. Enterprise platforms generate thousands of findings. Traditional tools generate isolated alerts without context.

ScanOrbit's current finding model already has structured severity levels (critical/high/medium/low/trivial), finding lifecycle (open/resolved/snoozed/ignored), and historical detection tracking. The foundation for intelligent deduplication and context-aware severity scoring exists.

**Opportunity:** Build a small-team-first "noise budget" — never show more than N critical/high findings at once, group related findings (e.g., "12 EBS volumes are unencrypted" as one grouped finding with one remediation), and provide a "fix this week" queue rather than a raw list. This directly addresses the biggest complaint against incumbents.

---

### Gap 5: AWS-Only Depth vs. Multi-Cloud Breadth

Wiz, Orca, and Prisma Cloud do everything across every cloud but do it at the deepest level on no single cloud. AWS Security Hub understands AWS best but is fragmented across services and lacks relationship mapping.

ScanOrbit is currently AWS-only. Rather than rushing to add Azure/GCP, it should go deeper on AWS — adding services the enterprise platforms cover superficially: EKS, ECS, EventBridge, Step Functions, API Gateway, Cognito, ElastiCache, DynamoDB, SQS, SNS, CodeBuild.

**Opportunity:** Be the tool that AWS engineers trust because it catches things the multi-cloud generalists miss. "Deeper on AWS than anything else at this price."

---

### Gap 6: Developer Experience and CI/CD Integration

Infracost owns the shift-left cost angle (IaC PRs). Checkov owns the shift-left security angle (IaC PRs). Neither scans live infrastructure. Wiz and Orca are excellent but require sales, procurement, and a 90-day security team onboarding.

There is no self-serve product that an AWS engineer can connect to their account in 5 minutes, run in GitHub Actions on a schedule, and get a Slack notification with "3 new critical findings since yesterday" — at a price a startup can justify.

**Opportunity:** ScanOrbit's existing API key auth, webhook support, and public API (in TEAM tier) are the foundation. A GitHub Action that runs a ScanOrbit scan on a cron schedule and posts findings to Slack is a 1-day integration project with high acquisition value.

---

## Part 7: Most Requested Missing Features (Across the Market)

Based on user complaints and review analysis across G2, Gartner Peer Insights, PeerSpot, and Reddit:

1. **Compliance framework reports** — "Show me my CIS score" or "Generate my SOC 2 evidence" is the most common ask for SMBs. All enterprise tools have this; ScanOrbit does not yet.

2. **Automated remediation** — Users want a "Fix it" button or at minimum a one-click Terraform/CloudFormation patch. Wiz, Orca, and Vantage all have versions of this. Even Infracost AutoFix (IaC only) is praised. ScanOrbit has findings but no remediation.

3. **Slack/Teams/PagerDuty alerting** — Real-time notification for new critical findings is expected at every price point. ScanOrbit has webhook support in the TEAM tier, but Slack/Teams native integrations (not just raw webhooks) are the ask.

4. **Trend and drift reporting** — "How has my security posture changed over the last 30 days?" Detection history exists in the ScanOrbit data model (FirstDetectedAt, LastDetectedAt, DetectionCount) but is not surfaced in the UX.

5. **Multi-account organization overview** — Viewing findings across all accounts in one dashboard is gated to TEAM tier in ScanOrbit. This is the right call for monetization but should be clearly marketed as the TEAM tier's headline feature.

6. **Cost savings estimation** — Every cost finding should show estimated monthly savings in dollars. "This stopped instance costs you ~$47/month" is far more actionable than "stopped_instance severity:medium." ScanOrbit has a pricing module in the workers that should surface this prominently.

7. **One-click IAM role setup** — CloudFormation/Terraform template that provisions the read-only role directly in the customer's account. Currently ScanOrbit generates the IAM policy JSON, but a CFN StackSet or Terraform module dramatically reduces onboarding friction.

8. **Suppression/exception management** — "I know this S3 bucket is public intentionally" needs to be suppressible per resource, not just global ignore. The current model (snoozed/ignored status) is the right data model — it needs a UI surface.

9. **AI-assisted remediation guidance** — Not necessarily a full AI agent, but structured remediation steps per finding type with links to AWS docs. Prowler added Lighthouse AI; this is becoming table stakes.

10. **Export to PDF/CSV for auditors** — Compliance auditors want a report they can attach to evidence folders. The export feature is gated to TEAM tier in ScanOrbit, which is correct for monetization.

---

## Part 8: Pricing Strategy Recommendations

### Current ScanOrbit Tiers (Observed)

| Tier | Accounts | Key Limits |
|---|---|---|
| FREE | 1 | One scan ever, no resource/finding list view, no infra map |
| PRO | 3 | 1-hour scan cooldown, full resource/finding views, infra map |
| TEAM | 10 | Unlimited scans, org overview, exports, audit logs, webhooks, API keys |

The free tier is intentionally very limited (one scan ever) — it functions as a demo, not a freemium product. This is a deliberate conversion driver: users see findings from one scan but cannot act on them without upgrading.

### Recommended Pricing Strategy

**Principle 1: Price per account, not per seat.**
The primary value unit for ScanOrbit is an AWS account being scanned. Seat-based pricing (like Lacework's per-user model) creates friction for small teams and doesn't align with the customer's perceived value. Account-based pricing is intuitive: "I pay for what I'm protecting."

**Principle 2: Anchor against Prowler Cloud.**
Prowler Cloud at $79/account/month is the natural comparison for security-only buyers. A ScanOrbit pricing that is meaningfully cheaper AND includes cost optimization creates a compelling "why pay more for less?" narrative.

**Principle 3: The "3-account sweet spot."**
The most common startup AWS footprint is dev + staging + prod = 3 accounts. A plan priced for exactly this configuration (flat rate, not per-account) removes the mental math and converts this specific segment efficiently.

**Recommended Tier Structure:**

| Tier | Price | Accounts | Positioning |
|---|---|---|---|
| **Free** | $0 | 1 | One-time scan, summary only (current model is correct) |
| **Starter** | $29/mo | 1 | Solo developer or single-account project, full findings |
| **Growth** | $79/mo | 3 | The startup dev+staging+prod configuration |
| **Scale** | $149/mo | 10 | Multi-project teams or small agencies |
| **Enterprise** | Custom | Unlimited | Large org, SSO, SIEM, priority support |

This structure:
- Undercuts Prowler Cloud significantly (3 accounts: $79 vs. Prowler's $237)
- Self-serve at every tier except Enterprise
- Creates a natural upgrade path as the customer's account count grows
- Keeps annual pricing accessible (Growth annual: ~$790 vs. Prowler $2,844)

**Annual discount:** 20% (following Prowler's model) — $63/mo for Growth annually.

**Principle 4: Compliance reports as a paid add-on or tier gate.**
Compliance framework reports (CIS, SOC 2, HIPAA) should be gated to Scale or higher, or offered as a $20/month add-on. This creates a clear monetization event for the audit readiness use case without raising the base price.

---

## Part 9: Differentiation Strategy for ScanOrbit

### Core Differentiators to Build and Market

**1. "Security + Cost, One Scan"**
No competitor at the SMB price point does both. This is the headline message. Every marketing asset should emphasize that ScanOrbit finds both security risks and wasted money in the same agentless scan.

**2. "5-Minute Setup, No Agent, No Code"**
Agentless via IAM role is already implemented. The setup friction reduction (one-click CFN template, step-by-step in-app wizard) should be a first-class feature. Measurable goal: time-to-first-finding under 5 minutes.

**3. "Plain English, Not Alert Noise"**
Group findings, surface only what matters, always show estimated dollar impact next to cost findings. Position against Wiz's 4,700 finding problem even though Wiz is out of the price range — users have heard the horror stories.

**4. "Built for the Team Building It, Not the Security Team Reviewing It"**
Prowler, Prisma Cloud, and Wiz are designed for security engineers. ScanOrbit should be designed for the engineering team that is also responsible for their own cloud security (the dominant model at startups and scale-ups under 200 people). The tone, UX, and documentation should reflect developer values: CLI-friendly, API-first, Terraform-compatible.

**5. "AWS Deep, Not AWS Plus Everything Else"**
Do not rush to Azure or GCP. Instead, add more AWS services and go deeper on the ones already scanned. Add EKS cluster security, RDS parameter group analysis, S3 intelligent-tiering cost recommendations, Lambda cold start optimization signals. Depth beats breadth at the SMB price point.

### Features to Prioritize for Competitive Parity (Next 6 Months)

These are the minimum table-stakes features needed to compete with Prowler Cloud for AWS-focused buyers:

1. **CIS AWS Foundations Benchmark v3.0 compliance report** — maps existing findings to CIS controls, generates a pass/fail scorecard. Most existing finding types already cover the majority of CIS controls; this is primarily a mapping and report generation task.

2. **Dollar savings estimates on all cost findings** — the pricing module already exists in the Go workers; surface estimated monthly savings in the finding's details field and in the UI.

3. **Slack integration** — one-way: post a daily/weekly summary of new findings to a Slack channel. Builds habit, reduces churn, provides visible value to the team.

4. **Grouped findings UI** — "12 unencrypted EBS volumes" as one entry with expand-to-see-all, rather than 12 separate rows. Directly addresses the alert fatigue problem.

5. **One-click AWS CloudFormation template for IAM role** — reduces onboarding from 10 minutes to 2 minutes.

### Features to Prioritize for Differentiation (Next 12 Months)

These create moats that competitors cannot easily copy at the SMB price point:

1. **Cost savings dashboard** — "ScanOrbit has identified $X,XXX/month in waste since you connected." This is the ROI story that justifies the subscription price and becomes a churn prevention mechanism.

2. **Remediation playbooks** — structured, copy-paste-ready remediation steps per finding type. Not AI-generated each time — curated once and maintained. Links to the exact AWS Console page, the relevant Terraform resource block, and the AWS documentation.

3. **Scan-over-time trend graph** — "Your security score improved from 62 to 78 over the last 30 days." Gives teams a sense of progress and creates a regular check-in habit.

4. **GitHub Actions / CI workflow** — scheduled scan trigger via API, findings posted as PR comments or GitHub Issues. Turns ScanOrbit from a dashboard product into a workflow product.

5. **SOC 2 evidence export** — generates a structured PDF report mapping findings to SOC 2 Common Criteria. This is the strongest feature for the "startup preparing for audit" use case and justifies a $20/month add-on or Scale-tier gate.

---

## Part 10: Summary Table — Competitive Positioning

| Dimension | ScanOrbit vs. Market |
|---|---|
| **Price** | Cheapest self-serve option with security+cost combined |
| **Ease of setup** | Competitive (agentless IAM); needs 1-click CFN template to win |
| **Security depth (AWS)** | Good foundation; needs more services and CIS mapping |
| **Cost optimization** | Unique at this price point — only tool combining both |
| **Compliance reports** | Not yet built — critical gap vs. Prowler Cloud |
| **Multi-cloud** | AWS only — intentional; go deeper, not wider |
| **Enterprise features** | Limited — not the target market |
| **Developer experience** | Good architecture; needs CLI/GitHub Actions, better docs |
| **AI features** | None — table stakes becoming, not yet required for SMB |
| **Alert quality** | Good data model; needs grouped findings UI |

---

## Sources

- [Prowler Cloud Pricing](https://prowler.com/pricing)
- [Prowler Pro Pricing 2026 — TrustRadius](https://www.trustradius.com/products/prowler-pro/pricing)
- [Wiz CSPM Solutions](https://www.wiz.io/solutions/cspm)
- [Wiz Pricing Overview — UnderDefense](https://underdefense.com/industry-pricings/wiz-pricing-ultimate-guide-for-security-products/)
- [Wiz Software Pricing & Plans 2026 — Vendr](https://www.vendr.com/marketplace/wiz)
- [Orca Security vs Wiz — PeerSpot](https://www.peerspot.com/products/comparisons/orca-security_vs_wiz)
- [Lacework Pricing Guide 2026 — RiscLens](https://risclens.com/soc-2/lacework)
- [Best 8 CSPM Pricing and Plans — AIMultiple](https://aimultiple.com/cspm-pricing)
- [Prisma Cloud Pricing Experience — PeerSpot](https://www.peerspot.com/questions/what-is-your-experience-regarding-pricing-and-costs-for-prisma-cloud-by-palo-alto-networks-147312)
- [Aqua CNAPP Pricing — Capterra](https://www.capterra.com/p/201051/Aqua/)
- [Aikido Security Pricing](https://www.aikido.dev/pricing)
- [Vantage Cloud Cost Platform](https://www.vantage.sh/)
- [Vantage Pricing Explained — nOps](https://www.nops.io/blog/vantage-pricing-explained/)
- [Infracost Pricing](https://www.infracost.io/pricing/)
- [Best Spot.io Alternatives 2026 — Spendark](https://www.spendark.com/blog/spot-io-alternative/)
- [Checkov vs Trivy 2026 — AppSecSanta](https://appsecsanta.com/iac-security-tools/checkov-vs-trivy)
- [Trivy tfsec Alternatives Comparison — CodeNote](https://codenote.net/en/posts/trivy-tfsec-alternatives-security-scanning-tools-comparison/)
- [Prowler vs ScoutSuite — HAIT Blog](https://haitmg.pl/blog/aws-security-scanners-compared/)
- [Essential AWS Pentesting Tools — CyberSapiens](https://cybersapiens.com.au/essential-aws-pentesting-tools/)
- [Why Alert Volume Isn't Security — CY5](https://www.cy5.io/blog/why-alert-volume-isnt-security-hidden-cost-traditional-cspm/)
- [CSPM Market Research Report 2026 — GlobeNewswire](https://www.globenewswire.com/news-release/2026/01/29/3228791/0/en/Cloud-Security-Posture-Management-Research-Report-2026-Global-Market-Size-Trends-Opportunities-and-Forecasts-2021-2025-2026-2031.html)
- [AWS Security Hub CSPM Limitations — Upwind](https://www.upwind.io/glossary/cloud-security-posture-management-cspm-in-aws)
- [Top 16 CSPM Tools 2026 — Aikido Blog](https://www.aikido.dev/blog/top-cloud-security-posture-management-cspm-tools)
