# ScanOrbit Social Media Kit

> Ready-to-use social media templates for Twitter/X, LinkedIn, and Instagram

---

## Table of Contents

1. [Twitter/X Posts](#twitterx-posts)
2. [LinkedIn Posts](#linkedin-posts)
3. [Short-Form Content](#short-form-content)
4. [Hashtag Strategy](#hashtag-strategy)
5. [Posting Guidelines](#posting-guidelines)

---

## Twitter/X Posts

### Product Launch / General Awareness

**Post 1: Feature Overview**
```
Stop guessing what's wasting money in your AWS account.

ScanOrbit finds:
- Orphaned EBS volumes
- Unused Elastic IPs
- Expiring SSL certs
- GDPR compliance issues

5-minute setup. No agents. EU-hosted.

Try free: scanorbit.cloud
```

**Post 2: Hidden Tax Angle**
```
Your AWS bill has a hidden tax.

It's called orphaned resources:
- Unattached EBS volumes: $10-100/mo each
- Unused Elastic IPs: $3.65/mo each
- Forgotten snapshots: $0.05/GB/mo

We find them in 5 minutes.

Free scan: scanorbit.cloud
```

**Post 3: Before/After**
```
Before ScanOrbit: "Why is our AWS bill so high?"

After ScanOrbit: "Found 23 orphaned EBS volumes, 8 unused Elastic IPs, and 3 expiring SSL certs."

5 minutes. Read-only. EU-hosted.

scanorbit.cloud
```

### Technical / DevOps Focus

**Post 4: Tool Consolidation**
```
AWS Config + Cost Explorer + Certificate Manager + manual audits

Or...

One ScanOrbit scan.

Same visibility. 5 minutes. No agents.

Free tier available: scanorbit.cloud
```

**Post 5: Truth About AWS Accounts**
```
DevOps truth: You probably don't know everything in your AWS account.

Not because you're careless. Because:
- Teams change and knowledge leaves
- Terraform drift happens
- "Temporary" resources become permanent

Visibility is underrated.
```

**Post 6: IAM Simplicity**
```
"How hard is the setup?"

1. Create IAM role (we provide the policy)
2. Add our account ID as trusted
3. Paste the ARN

That's it. 5 minutes. No agents. No SSH keys. No modifications.

scanorbit.cloud
```

**Post 7: For Platform Teams**
```
Platform team checklist:

[ ] Know every resource in your AWS account
[ ] Track all SSL certificate expiry dates
[ ] Identify orphaned resources monthly
[ ] Verify GDPR data residency

ScanOrbit checks all boxes in one scan.
```

### Security / Compliance Focus

**Post 8: GDPR Reality Check**
```
"We're GDPR compliant"

Are you sure?

- Any S3 buckets in us-east-1?
- Any RDS in ap-southeast?
- Any snapshots in non-EU regions?

ScanOrbit flags all of them automatically.

EU-hosted. Privacy-first: scanorbit.cloud
```

**Post 9: Read-Only Advantage**
```
Read-only access isn't a limitation.

It's a feature.

ScanOrbit can't modify your infrastructure. Can't start instances. Can't delete data.

We only see. We only report.

Security by design.
```

**Post 10: Trust Architecture**
```
Our IAM policy has exactly 0 write permissions.

Only Describe* and List* actions.

We literally cannot:
- Start or stop instances
- Create or delete resources
- Modify any configuration

That's the point.
```

### Cost Optimization Focus

**Post 11: CFO Question**
```
CFO: "Why did our AWS bill go up 40%?"

You, without ScanOrbit: "Let me investigate..."

You, with ScanOrbit: "47 orphaned EBS volumes from last quarter's cleanup. Here's the list."

Be the second person.
```

**Post 12: Money Drain**
```
Resources that drain money while you sleep:

- Unattached EBS volumes
- Elastic IPs attached to stopped instances
- Snapshots of deleted volumes
- Stopped instances "we might need later"

Find them all: scanorbit.cloud
```

### SSL Certificate Focus

**Post 13: SSL Pain**
```
SSL certificate management shouldn't require:
- Spreadsheets
- Calendar reminders
- Panic on Friday nights

ScanOrbit scans ACM + your endpoints.
Alerts at 60, 30, 14, and 7 days.

Sleep better: scanorbit.cloud
```

**Post 14: Certificate Expiry**
```
Things that expire at the worst possible time:
- Milk
- Parking meters
- SSL certificates

Two of these won't take down your production.

Track all your certs: scanorbit.cloud
```

---

## LinkedIn Posts

### Thought Leadership

**Post 1: Visibility Problem**
```
The #1 problem for DevOps teams? They don't know everything in their AWS account.

Not because they're careless. Because:
- Teams change and knowledge leaves
- Terraform drift happens
- "Temporary" resources become permanent
- Multi-region complexity grows

We built ScanOrbit to solve this.

One read-only IAM role. 5 minutes. Complete visibility.

No agents. No SSH. No modifications to your infrastructure.

If you're responsible for AWS costs or compliance, try the free tier.

Link: scanorbit.cloud

#DevOps #AWS #CloudSecurity #InfrastructureCost
```

**Post 2: AWS Bill Conversation**
```
The awkward conversation every DevOps engineer dreads:

CFO: "Why did our AWS bill increase 40%?"

DevOps: "I... need to investigate."

Sound familiar?

Here's what we usually find:
- Orphaned EBS volumes from deleted EC2s
- Elastic IPs attached to nothing
- RDS snapshots from 2 years ago
- Stopped instances "we might need later"

ScanOrbit surfaces all of this in one dashboard.

With cost estimates.

So when the CFO asks, you already have the answer.

#CloudCosts #AWS #DevOps #FinOps
```

**Post 3: Trust Architecture**
```
When evaluating any tool that touches your AWS account, ask:

1. What permissions does it need?
2. Can it modify my infrastructure?
3. Where is my data stored?
4. Who has access?

For ScanOrbit, the answers are:
1. Read-only (Describe* and List* only)
2. No - technically impossible
3. EU data centers (Frankfurt)
4. Your team only

We designed it this way because we'd want the same answers if roles were reversed.

Security isn't a feature. It's the foundation.

#CloudSecurity #AWS #DevOps #TrustByDesign
```

### Problem-Solution Format

**Post 4: SSL Management**
```
SSL certificate management shouldn't be this hard.

Common scenario:
- Production cert expires on Friday night
- Users see "Your connection is not private"
- Support tickets pile up over the weekend

Preventable? Absolutely.

ScanOrbit scans your ACM certificates AND your endpoints.

Alerts at 60, 30, 14, and 7 days before expiry.

Never wake up to a certificate emergency again.

#SSL #DevOps #AWS #CertificateManagement
```

**Post 5: GDPR Challenge**
```
For EU-based teams, GDPR compliance isn't optional. It's the law.

But tracking data residency across AWS regions is genuinely hard:
- S3 buckets can be anywhere
- Snapshots inherit parent region
- Backups might cross borders
- Teams don't always document region choices

ScanOrbit automatically flags resources outside your preferred regions.

One scan. Complete visibility. EU-hosted (of course).

Because compliance shouldn't require manual audits.

#GDPR #AWS #DataPrivacy #Compliance
```

### Feature Highlights

**Post 6: Orphaned Resources**
```
What are "orphaned resources" and why do they matter?

Orphaned resources are AWS resources that:
- Exist in your account
- Incur charges
- Serve no current purpose

Common examples:
- EBS volumes from deleted EC2 instances
- Elastic IPs not attached to anything
- Snapshots of volumes that no longer exist

How much are you spending on resources you don't use?

ScanOrbit finds out in 5 minutes: scanorbit.cloud

#AWS #CloudCosts #DevOps #FinOps
```

**Post 7: Setup Simplicity**
```
"How long does it take to set up ScanOrbit?"

Actual answer: About 5 minutes.

Here's the process:
1. Sign up (30 seconds)
2. Create IAM role with our provided policy (3 minutes)
3. Paste the role ARN (30 seconds)
4. Run your first scan (automatic)

No agents to install. No SSH keys to manage. No modifications to your infrastructure.

The IAM role is read-only. We literally cannot make changes to your AWS account.

Try it free: scanorbit.cloud

#AWS #DevOps #CloudSecurity
```

### Industry Insights

**Post 8: Cloud Waste Statistics**
```
Industry research consistently shows 25-35% of cloud spend is wasted.

Where does it go?
- Orphaned storage (EBS, snapshots)
- Idle compute (stopped instances, oversized)
- Forgotten resources (test environments, POCs)
- Redundant services

The first step to reducing waste is visibility.

What's hiding in your AWS account?

#CloudCosts #FinOps #AWS #DevOps
```

---

## Short-Form Content

### Instagram / TikTok Captions

**Caption 1: POV Meme**
```
POV: You're a DevOps engineer and your AWS bill just increased 40%

*opens ScanOrbit*
*finds 47 orphaned EBS volumes*

Mystery solved.

Link in bio.
```

**Caption 2: Things That Cost Too Much**
```
Things that cost more than they should:
- Coffee in airports
- Ticketmaster fees
- Unused AWS resources

Fix at least one of these: scanorbit.cloud
```

**Caption 3: Famous Last Words**
```
"We'll delete that later"

- famous last words before an orphaned resource sits for 2 years costing $50/month
```

**Caption 4: Trust Issues**
```
Trust issues? Same.

That's why ScanOrbit:
- Can't modify your AWS
- Can't delete anything
- Can't start or stop resources
- Only reads metadata

Read-only access is a feature, not a limitation.
```

**Caption 5: DevOps Life**
```
DevOps life:

Monday: "I'll clean up those test resources"
Tuesday: *busy*
Wednesday: *meetings*
Thursday: *incident*
Friday: "I'll do it next week"

*2 years later*

Your AWS bill: *crying*
```

**Caption 6: Sleep Schedule**
```
Things keeping DevOps engineers up at night:
- SSL certificates expiring
- Unknown resources in production
- "What's that charge on the AWS bill?"

Things that help them sleep:
- Automated scanning
- Expiry alerts
- Complete visibility

Try free: scanorbit.cloud
```

### Twitter Thread Starter

**Thread: AWS Cost Optimization**
```
Thread: 5 resources quietly draining your AWS budget

Most teams have at least 3 of these. Here's what they are and what they cost:

1/6
```

**Thread Follow-ups:**
```
1. Unattached EBS volumes

When you delete an EC2, its EBS volumes don't automatically delete.

Cost: $0.10/GB/month for gp3
A forgotten 500GB volume = $50/month = $600/year

2/6
```

```
2. Unused Elastic IPs

AWS charges for EIPs not attached to running instances.

Cost: $0.005/hour = $3.65/month per IP

5 unused IPs = $219/year

3/6
```

```
3. Old EBS snapshots

Snapshots of deleted volumes stick around forever.

Cost: $0.05/GB/month
100GB of old snapshots = $60/year

Multiply by years of operation...

4/6
```

```
4. Stopped instances with attached resources

Stopped EC2s don't charge compute, but:
- EBS volumes still charge
- Elastic IPs still charge
- You're paying for resources doing nothing

5/6
```

```
5. Forgotten test environments

That "temporary" staging environment from 2 years ago?
Still running. Still charging.

ScanOrbit finds all of these in one scan.

Free tier: scanorbit.cloud

6/6
```

---

## Hashtag Strategy

### Primary Hashtags (High Relevance)
- `#AWS`
- `#DevOps`
- `#CloudSecurity`
- `#FinOps`

### Secondary Hashtags (Broader Reach)
- `#CloudComputing`
- `#InfrastructureAsCode`
- `#TechStartup`
- `#SaaS`

### Topic-Specific Hashtags

| Topic | Hashtags |
|-------|----------|
| Cost | `#CloudCosts` `#AWSBilling` `#CostOptimization` |
| Security | `#CyberSecurity` `#InfoSec` `#CloudSecOps` |
| Compliance | `#GDPR` `#DataPrivacy` `#Compliance` |
| SSL | `#SSL` `#CertificateManagement` `#TLS` |

### Platform-Specific Usage

| Platform | Hashtag Count | Placement |
|----------|---------------|-----------|
| Twitter/X | 2-3 | End of post |
| LinkedIn | 3-5 | End of post |
| Instagram | 5-10 | First comment or end |

---

## Posting Guidelines

### Frequency Recommendations

| Platform | Frequency | Best Times (UTC) |
|----------|-----------|------------------|
| Twitter/X | 1-2/day | 9:00, 14:00, 17:00 |
| LinkedIn | 2-3/week | Tuesday-Thursday, 8:00-10:00 |
| Instagram | 3-5/week | 11:00-13:00, 19:00-21:00 |

### Content Mix

| Content Type | Percentage | Examples |
|--------------|------------|----------|
| Educational | 40% | Tips, how-tos, explanations |
| Product | 30% | Features, updates, use cases |
| Engagement | 20% | Questions, polls, discussions |
| Social Proof | 10% | Testimonials, milestones |

### Voice Consistency

- **Always be helpful first** - Lead with value, not sales
- **Stay technically accurate** - Our audience knows AWS
- **Be direct** - No fluff or corporate speak
- **Show empathy** - We understand DevOps pain points

### Engagement Rules

1. **Respond to comments** within 24 hours
2. **Thank users** who share or mention us
3. **Never argue** with critics - offer to help via DM
4. **Credit sources** when sharing external content

---

## Content Calendar Template

| Day | Platform | Content Type | Topic |
|-----|----------|--------------|-------|
| Mon | Twitter | Educational | AWS tip of the week |
| Tue | LinkedIn | Thought Leadership | Industry insight |
| Wed | Twitter | Product | Feature highlight |
| Thu | Instagram | Engagement | Poll or question |
| Fri | Twitter | Educational | Weekend reading |

---

*Last updated: January 2025*
