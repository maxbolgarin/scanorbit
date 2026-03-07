# ScanOrbit — Listmonk Email Campaign Setup Guide

## Architecture Overview

You have 8 user segments but only **4 campaign tracks** — because the goal at each stage is the same within a track. The segments become **lists** in Listmonk; the campaigns are **drip sequences** triggered when subscribers enter each list.

```
TRACK 1: ACQUISITION          TRACK 2: ACTIVATION         TRACK 3: CONVERSION         TRACK 4: RETENTION
(get them to sign up)          (get them to scan)          (get them to pay)           (keep them, expand)
┌─────────────────────┐       ┌──────────────────┐       ┌──────────────────┐       ┌──────────────────┐
│ List: cold-leads    │──┐    │ List: free-new   │──┐    │ List: trial-new  │──┐    │ List: paid-pro   │
│ List: subscribers   │──┘    │ List: free-scanned│──┘   │ List: trial-active│──┘   │ List: paid-team  │
└─────────────────────┘       └──────────────────┘       └──────────────────┘       └──────────────────┘
        │                            │                           │                          │
   Sign up ──────────────>     First scan ──────────>     Payment ──────────>        Expand / retain
```

**Key principle:** subscribers move *forward* through lists, never backward. When a free user starts a trial, remove them from `free-*` lists and add to `trial-new`. Your ScanOrbit backend handles these transitions via the Listmonk API.

---

## Listmonk Setup

### Step 1: Create Lists (8)

| List Name | Type | Description |
|-----------|------|-------------|
| `cold-leads` | Private | Manually imported prospects (DevOps, CTOs, security engineers) |
| `subscribers` | Public | Opted in via website, blog, lead magnets — not yet users |
| `free-new` | Private | Signed up for free account, haven't scanned yet |
| `free-scanned` | Private | Completed their one free scan |
| `trial-new` | Private | Started Pro/Team trial, haven't done much yet |
| `trial-active` | Private | Trial users actively using the product |
| `paid-pro` | Private | Paying Pro customers |
| `paid-team` | Private | Paying Team customers |

### Step 2: Create Templates (3)

You only need 3 email templates — keep it simple:

1. **Transactional** — clean, minimal, single-column. For onboarding and product emails.
2. **Newsletter** — slightly more designed, for blog content and educational emails.
3. **Upgrade/CTA** — same as transactional but with a prominent button and urgency element.

All templates should be plain and professional. No heavy graphics — you're selling to engineers and CTOs.

### Step 3: Subscriber Movement (API Integration)

Your ScanOrbit backend must call the Listmonk API at these trigger points:

```
Event in ScanOrbit           →  Listmonk API Action
─────────────────────────────────────────────────────
User signs up (free)         →  Add to `free-new`, remove from `cold-leads` + `subscribers`
User completes first scan    →  Move from `free-new` to `free-scanned`
User starts trial            →  Move from `free-*` to `trial-new`
User runs 2+ scans on trial  →  Move from `trial-new` to `trial-active`
User pays (Pro)              →  Move from `trial-*` to `paid-pro`
User pays (Team)             →  Move from `trial-*` to `paid-team`
User upgrades Pro → Team     →  Move from `paid-pro` to `paid-team`
User cancels / churns        →  Move back to `subscribers` (they already know the product)
```

**Listmonk API calls:**

```bash
# Add subscriber to list
curl -u 'admin:password' -X PUT 'http://listmonk:9000/api/subscribers/lists' \
  -H 'Content-Type: application/json' \
  -d '{"ids": [SUBSCRIBER_ID], "action": "add", "target_list_ids": [LIST_ID]}'

# Remove from list
curl -u 'admin:password' -X PUT 'http://listmonk:9000/api/subscribers/lists' \
  -H 'Content-Type: application/json' \
  -d '{"ids": [SUBSCRIBER_ID], "action": "remove", "target_list_ids": [LIST_ID]}'
```

### Step 4: Campaign Scheduling

Listmonk doesn't have native drip automation (send email X days after subscriber joins). You have two options:

**Option A: Cron + Listmonk API (recommended for you)**
Write a simple script that runs daily via cron. It queries subscribers by list and `created_at` date, then sends the appropriate campaign via API. This gives you full control.

**Option B: Scheduled campaigns with dynamic segments**
Use Listmonk's SQL-based subscriber queries to create segments like "subscribers in `free-new` who joined 1-2 days ago" and send scheduled campaigns to those segments daily.

---

## Campaign Sequences

### TRACK 1: ACQUISITION

**Goal:** Get cold leads and subscribers to create a free ScanOrbit account.

#### List: `cold-leads`

These are people you found (LinkedIn, directories, communities). They didn't ask to hear from you, so keep it short, personal, and value-first. **Max 3 emails, then stop.**

**Email 1 — Day 0: The Pain Point**
```
Subject: Quick question about your AWS setup
From: Maksim <maksim@scanorbit.cloud>

Hi {first_name},

I built ScanOrbit because I kept finding the same problems in AWS accounts — 
unencrypted volumes, public S3 buckets, orphaned resources quietly burning money.

One thing that surprises people: most AWS accounts have 15-30% of spend going to 
resources that aren't doing anything. Stopped instances, unattached EBS volumes, 
old snapshots nobody remembers.

If you're curious what's hiding in yours, there's a free scan — no credit card, 
takes about 2 minutes to connect:

→ scanorbit.cloud

Either way, no hard feelings. Just thought it might save you some headaches.

Maksim
Founder, ScanOrbit
```

**Email 2 — Day 4: The GDPR Angle**
```
Subject: Where are your AWS resources actually running?
From: Maksim <maksim@scanorbit.cloud>

Hi {first_name},

Quick follow-up — one thing we see constantly with EU-based companies: resources 
accidentally deployed in US regions. An RDS snapshot here, a Lambda function there.

Under GDPR, that's a data residency issue. Most teams don't catch it because AWS 
doesn't make it obvious.

ScanOrbit flags every resource outside EU regions automatically. Free scan shows 
you the severity breakdown — takes 2 minutes.

→ scanorbit.cloud

Maksim
```

**Email 3 — Day 10: The Breakup**
```
Subject: Last one from me
From: Maksim <maksim@scanorbit.cloud>

Hi {first_name},

I'll keep this short — this is my last email.

If your AWS security and cost situation is already sorted, great. If not, 
the free scan is still there whenever:

→ scanorbit.cloud

Feel free to reply if you ever have questions about AWS security. Happy to help 
either way.

Maksim
```

#### List: `subscribers`

These people opted in — they're interested but haven't committed. Mix educational content with soft CTAs. **6-email sequence over ~3 weeks, then move to monthly newsletter.**

**Email 1 — Day 0: Welcome + Quick Win**
```
Subject: Welcome — here's what most AWS accounts get wrong
From: Maksim <maksim@scanorbit.cloud>

Hey {first_name},

Thanks for subscribing. I'm Maksim — I build ScanOrbit, a tool that scans AWS 
accounts for security risks, wasted money, and compliance gaps.

Here's something you can check right now without any tool:

Go to your AWS Console → EC2 → Elastic IPs. If any show "not associated," 
you're paying ~$3.65/month each for nothing. It adds up.

That's the kind of thing ScanOrbit catches automatically across your entire 
account — security groups, IAM, encryption, orphaned resources, GDPR 
data residency, all of it.

More useful stuff coming your way. And when you're ready to see what's in your 
account, the free scan is here:

→ scanorbit.cloud

Maksim
```

**Email 2 — Day 3: Educational — Security**
```
Subject: 5 AWS misconfigurations that show up in almost every account
From: Maksim <maksim@scanorbit.cloud>

Hey {first_name},

After scanning hundreds of AWS accounts, these are the top 5 issues I see 
almost everywhere:

1. Security groups with 0.0.0.0/0 on non-web ports
2. IAM users without MFA enabled
3. Unencrypted EBS volumes (often from older instances)
4. S3 buckets with overly permissive policies
5. Access keys that haven't been rotated in 6+ months

The tricky part isn't that these are hard to fix — it's that nobody notices 
them until something goes wrong.

If you want to see how many of these exist in your account:

→ scanorbit.cloud (free scan, no credit card)

Maksim
```

**Email 3 — Day 7: Educational — Cost**
```
Subject: Your AWS bill probably has 20% waste in it
From: Maksim <maksim@scanorbit.cloud>

Hey {first_name},

Here's a pattern I keep seeing:

A team spins up an EC2 instance for testing. They stop it when they're done. 
But "stopped" doesn't mean "free" — the EBS volumes attached to it keep 
charging. The Elastic IP keeps charging. The snapshots keep accumulating.

Multiply that across a team over a year and you get a meaningful chunk of 
wasted spend hiding in plain sight.

ScanOrbit categorizes every resource by state and flags anything that's 
costing money without contributing value. The free scan gives you the 
severity breakdown so you know if it's worth digging deeper.

→ scanorbit.cloud

Maksim
```

**Email 4 — Day 11: Educational — Compliance/GDPR**
```
Subject: Is your AWS infrastructure actually GDPR-compliant?
From: Maksim <maksim@scanorbit.cloud>

Hey {first_name},

GDPR data residency is one of those things that seems simple until you 
actually check.

"We deploy everything in eu-west-1" — except for that Lambda function 
someone created in us-east-1 during a tutorial. Or the RDS snapshot that 
AWS replicated to a US region. Or the S3 bucket with a global policy.

ScanOrbit scans every AWS region and flags any resource outside the EU. 
It also checks tagging compliance — because auditors will ask about 
Environment, Owner, and CostCenter tags.

By the way — ScanOrbit itself is hosted entirely in Amsterdam. EU company, 
EU infrastructure, EU data processing. No US cloud dependency.

→ scanorbit.cloud

Maksim
```

**Email 5 — Day 16: Social Proof / Use Case**
```
Subject: What a first scan usually reveals
From: Maksim <maksim@scanorbit.cloud>

Hey {first_name},

When someone runs their first ScanOrbit scan, here's what typically shows up:

— 3-8 critical security findings (usually open security groups and missing MFA)
— 10-20 medium findings (unencrypted resources, old access keys)
— 5-15 cost optimization opportunities (orphaned volumes, stopped instances)
— 2-5 compliance gaps (resources in wrong regions, missing tags)

The free scan shows you the counts and severity breakdown for your account.
If you see something worth investigating, Pro gives you the full details 
plus unlimited re-scans to verify fixes.

→ scanorbit.cloud

Maksim
```

**Email 6 — Day 21: Direct CTA**
```
Subject: Your free AWS scan is waiting
From: Maksim <maksim@scanorbit.cloud>

Hey {first_name},

I've been sending you tips about AWS security and cost — but honestly, 
nothing beats seeing your own data.

The free scan takes about 2 minutes to set up:
1. Create an account on scanorbit.cloud
2. Connect your AWS account with a read-only IAM role
3. Hit scan

You'll see exactly how many findings you have, broken down by severity. 
No credit card. No sales call. Just data.

→ scanorbit.cloud

After this, I'll switch to monthly updates with AWS security tips and 
product news. You can always unsubscribe.

Maksim
```

**After sequence: move to monthly newsletter cadence** (blog posts, product updates, AWS security tips).

---

### TRACK 2: ACTIVATION

**Goal:** Get free users to run their first (and only) scan, then convert to trial/paid.

#### List: `free-new` (signed up, hasn't scanned)

**Email 1 — Immediately after signup**
```
Subject: Your account is ready — here's how to run your first scan
From: ScanOrbit <hello@scanorbit.cloud>

Hey {first_name},

Welcome to ScanOrbit! Your account is set up. Here's what to do next:

1. Go to your dashboard → Add AWS Account
2. Create the read-only IAM role (we provide the CloudFormation template)
3. Click "Scan"

The whole thing takes about 2 minutes. We use a read-only role with a 
unique external ID — we never store your AWS credentials.

→ Go to Dashboard

If you hit any snags, just reply to this email.

Maksim
```

**Email 2 — Day 2: Address the hesitation**
```
Subject: Connecting your AWS account is safe — here's why
From: ScanOrbit <hello@scanorbit.cloud>

Hey {first_name},

I noticed you haven't run your first scan yet. Totally fine — connecting a 
third-party tool to your AWS account deserves some thought.

Here's how ScanOrbit handles it:

— Read-only access: the IAM role can only describe/list/get resources. 
  No modifications, no deletions, no writes.
— No stored credentials: we use temporary role assumption (STS). 
  Your access keys never leave your account.
— External ID protection: prevents confused deputy attacks. 
  Each account gets a unique external ID.
— You can revoke access anytime by deleting the IAM role.

The CloudFormation template is transparent — you can inspect every 
permission before deploying it.

→ Set up your first scan

Maksim
```

**Email 3 — Day 5: Urgency + value preview**
```
Subject: What are you missing in your AWS account?
From: ScanOrbit <hello@scanorbit.cloud>

Hey {first_name},

Across accounts we've scanned, the average has:

— 6 critical or high-severity security issues
— $50-200/month in wasted resources
— 3+ GDPR data residency concerns

Your free scan will show you the counts and severity breakdown for your 
account. It's the fastest way to know if something needs attention.

→ Run your free scan

The free tier includes one full scan. If you want to dig into the details 
and re-scan after fixing issues, you can start a 7-day Pro trial anytime.

Maksim
```

#### List: `free-scanned` (completed their scan)

This is the most critical conversion point. They've seen their data — now they need a reason to upgrade.

**Email 1 — Immediately after scan completes**
```
Subject: Your scan results are ready
From: ScanOrbit <hello@scanorbit.cloud>

Hey {first_name},

Your scan just finished! Here's what we found:

[DYNAMIC: Pull severity summary from their actual scan]
— Critical: X findings
— High: X findings  
— Medium: X findings
— Cost optimization: X opportunities

You can see the severity breakdown in your dashboard. To view the full 
details of each finding — what's affected, why it matters, and what 
to do — start your 7-day Pro trial.

→ View your results

Maksim
```

**Email 2 — Day 2: Highlight what they're missing**
```
Subject: You have {critical_count} critical findings — here's what that means
From: ScanOrbit <hello@scanorbit.cloud>

Hey {first_name},

Your scan found {critical_count} critical findings. These typically include 
things like:

— Security groups allowing unrestricted access to sensitive ports
— IAM users without MFA on accounts with broad permissions
— Publicly accessible databases or storage buckets

The free tier shows you that these exist. Pro shows you exactly which 
resources are affected, with specific remediation guidance.

You also get unlimited re-scans so you can verify fixes as you go.

→ Start 7-day Pro trial

Maksim
```

**Email 3 — Day 5: Cost angle**
```
Subject: About those cost findings...
From: ScanOrbit <hello@scanorbit.cloud>

Hey {first_name},

Your scan flagged {cost_count} cost optimization opportunities. In our 
experience, the average account saves $50-200/month by cleaning up 
orphaned resources alone.

Pro gives you the full breakdown: which resources, how much each one 
costs, and how long they've been idle. The 7-day trial is free —
if the savings from one cleanup cover a month of Pro, it pays for itself.

→ Start free trial

Maksim
```

**Email 4 — Day 10: Final nudge**
```
Subject: Your scan results expire in 80 days
From: ScanOrbit <hello@scanorbit.cloud>

Hey {first_name},

Just a heads up — scan data is retained for 90 days. After that, 
you'd need to re-scan (which requires Pro or Team).

If you found the severity breakdown useful, the full details in Pro 
will give you actionable next steps. 7-day free trial.

→ Upgrade to Pro

Or if you have questions about your results, just reply here.

Maksim
```

---

### TRACK 3: CONVERSION

**Goal:** Convert trial users to paid before the 7-day trial ends.

#### List: `trial-new` (started trial, low activity)

**Email 1 — Day 0: Trial welcome**
```
Subject: Your 7-day Pro trial is active
From: ScanOrbit <hello@scanorbit.cloud>

Hey {first_name},

Your Pro trial is live! Here's what you now have access to:

— Full finding details with remediation guidance
— Unlimited scans (60-min cooldown between scans)
— Complete resource inventory with cost estimates
— Infrastructure dependency map
— Finding lifecycle management (resolve, snooze, ignore)

Suggested first steps:
1. Run a scan if you haven't already
2. Review critical and high findings first
3. Fix the easy wins, then re-scan to verify

→ Go to Dashboard

Your trial runs until {trial_end_date}. No credit card needed until 
you decide to continue.

Maksim
```

**Email 2 — Day 3: Are they stuck?**
```
Subject: Need help getting started?
From: ScanOrbit <hello@scanorbit.cloud>

Hey {first_name},

Just checking in — you started your Pro trial a few days ago. 
Are you running into anything?

Common things people ask about:
— Setting up the IAM role (we have a one-click CloudFormation template)
— Understanding finding severities (critical = fix now, high = fix soon)
— How to re-scan after making changes

If something's not clear, reply to this email and I'll help directly.

→ Go to Dashboard

Maksim
```

**Email 3 — Day 7: Mid-trial value reminder**
```
Subject: You're halfway through your trial
From: ScanOrbit <hello@scanorbit.cloud>

Hey {first_name},

Quick update — you have 7 days left on your Pro trial.

If you haven't yet, now's a good time to:
— Run a second scan to see if any new issues appeared
— Check the cost optimization tab for savings opportunities
— Look at the infrastructure map to understand resource dependencies

Pro is $X/month after the trial. If you're getting value from it, 
you can add a payment method anytime in Settings → Billing.

→ Go to Billing

Maksim
```

#### List: `trial-active` (actively using the product)

These users are engaged — focus on deepening usage and making the case for continued payment.

**Email 1 — Day 5: Deepen engagement**
```
Subject: Getting more from your scans
From: ScanOrbit <hello@scanorbit.cloud>

Hey {first_name},

I see you've been running scans — great. Here are a few things 
you might not have tried yet:

— Bulk update findings: select multiple findings and resolve/snooze 
  them at once (useful for known-accepted risks)
— Finding history: click any finding to see when it was first 
  detected and how many times it's reappeared
— Data residency report: filter findings by "compliance" category 
  for a quick GDPR audit view

→ Go to Dashboard

Maksim
```

**Email 2 — Day 10: Trial ending soon**
```
Subject: 4 days left on your trial
From: ScanOrbit <hello@scanorbit.cloud>

Hey {first_name},

Your Pro trial ends on {trial_end_date}. Here's what you've found so far:

[DYNAMIC: Their stats]
— Total scans: X
— Findings resolved: X
— Resources discovered: X

After the trial, you'll keep your account but lose access to finding 
details, resource lists, and re-scanning.

To continue without interruption, add your payment method:

→ Go to Billing

If you manage multiple AWS accounts or need team access, check out 
the Team plan — unlimited accounts, no scan cooldown, and 
role-based access for your team.

Maksim
```

**Email 3 — Day 13: Last day**
```
Subject: Your trial ends tomorrow
From: ScanOrbit <hello@scanorbit.cloud>

Hey {first_name},

Final reminder — your Pro trial expires tomorrow.

Without Pro, you won't be able to:
— See finding details or remediation steps
— Run new scans
— Access the infrastructure map
— View your full resource inventory

If ScanOrbit has been useful, you can keep everything going:

→ Add payment method

If now isn't the right time, your account stays active and your 
historical data is retained. You can upgrade whenever.

Maksim
```

**Email 4 — Day 16 (3 days after expiry): Win-back**
```
Subject: Your findings are still there
From: ScanOrbit <hello@scanorbit.cloud>

Hey {first_name},

Your trial ended a few days ago, but your scan data is still available. 
If you found value in the findings, you can pick up right where you 
left off by upgrading to Pro.

Everything you discovered is still there — the resources, the findings, 
the history. You just need Pro access to see the details again.

→ Upgrade to Pro

Questions? Reply to this email.

Maksim
```

---

### TRACK 4: RETENTION & EXPANSION

**Goal:** Keep paying customers happy, reduce churn, upsell Pro → Team.

#### List: `paid-pro`

Low frequency — monthly to bi-monthly. Don't annoy paying customers.

**Email 1 — Day 0: Welcome to Pro**
```
Subject: Welcome to Pro — you're all set
From: ScanOrbit <hello@scanorbit.cloud>

Hey {first_name},

Thanks for upgrading to Pro! Your subscription is active.

Quick reminders:
— Scans: unlimited with 60-minute cooldown
— Finding lifecycle: use resolve, snooze, and ignore to manage your backlog
— Billing: manage your subscription anytime in Settings → Billing

Pro tip: set a weekly rhythm — scan Monday morning, review findings, 
fix the critical ones during the week, re-scan next Monday to verify.

→ Go to Dashboard

Maksim
```

**Monthly: Product update + tips**
```
Subject: ScanOrbit update — {month}
From: ScanOrbit <hello@scanorbit.cloud>

Hey {first_name},

Here's what's new this month:
[DYNAMIC: Product updates, new analyzers, improvements]

Your account this month:
[DYNAMIC: Their monthly stats — findings resolved, new findings, etc.]

Tip: [Rotating AWS security or cost tip]

→ Go to Dashboard

Maksim
```

**Quarterly: Team upsell (subtle)**
```
Subject: Managing multiple AWS accounts?
From: ScanOrbit <hello@scanorbit.cloud>

Hey {first_name},

As your infrastructure grows, you might need:
— Multiple AWS accounts under one view
— Team members with their own logins
— No scan cooldown for continuous monitoring
— Organization-level dashboards

That's what the Team plan is for. If your setup is expanding, 
take a look:

→ Compare plans

No pressure — Pro is great for single-account setups. But if 
you're juggling multiple accounts, Team makes it much easier.

Maksim
```

#### List: `paid-team`

Minimal email. These are your highest-value customers. Focus on making them successful and collecting feedback.

**Email 1 — Day 0: Team welcome**
```
Subject: Your Team plan is active
From: ScanOrbit <hello@scanorbit.cloud>

Hey {first_name},

Welcome to the Team plan! Here's what's available:

— Unlimited AWS accounts: add them all in Settings → AWS Accounts
— Team members: invite your team in Settings → Organization
— Roles: Admin (full access) and Member (view + scan)
— No scan cooldown: scan as often as you need
— Org dashboard: see all accounts at a glance

If you need help onboarding your team or connecting multiple 
accounts, reply here and I'll walk you through it.

→ Go to Organization Settings

Maksim
```

**Monthly: Account health summary**
```
Subject: ScanOrbit — your monthly summary
From: ScanOrbit <hello@scanorbit.cloud>

Hey {first_name},

Your organization this month:
[DYNAMIC: Org-level stats]
— AWS accounts connected: X
— Total findings: X (Y resolved this month)
— Team members: X
— Critical findings remaining: X

[DYNAMIC: Product updates if any]

→ View Organization Dashboard

Maksim
```

**Quarterly: Feedback request**
```
Subject: Quick question about ScanOrbit
From: Maksim <maksim@scanorbit.cloud>

Hey {first_name},

You've been on the Team plan for a while now, and I'd love to hear 
how it's going.

Two quick questions:
1. What's the most useful thing ScanOrbit does for your team?
2. What's one thing you wish it did better?

No form, no survey — just reply to this email. Every response 
goes directly to me and shapes what I build next.

Thanks,
Maksim
```

---

## Implementation Checklist

### Listmonk Configuration

- [ ] Create all 8 lists with correct names and types (private/public)
- [ ] Create 3 email templates (transactional, newsletter, upgrade/CTA)
- [ ] Configure SMTP settings and verify deliverability
- [ ] Set up bounce and complaint handling
- [ ] Configure unsubscribe page

### Backend Integration (ScanOrbit → Listmonk)

- [ ] On user signup: add to appropriate list via Listmonk API
- [ ] On first scan: move from `free-new` to `free-scanned`
- [ ] On trial start: move from `free-*` to `trial-new`
- [ ] On trial engagement (2+ scans): move from `trial-new` to `trial-active`
- [ ] On payment: move to `paid-pro` or `paid-team`
- [ ] On plan change: move between `paid-pro` and `paid-team`
- [ ] On churn: move to `subscribers`

### Campaign Scheduling (cron job)

Create a daily script that:

1. Queries each list for subscribers by `created_at` date
2. Matches them to the correct email in the sequence (Day 0, Day 2, Day 5, etc.)
3. Sends via Listmonk transactional API (or creates targeted campaigns)
4. Logs what was sent to avoid duplicates

```
# Example cron schedule
0 9 * * * /path/to/send-drip-emails.sh   # Run daily at 9:00 AM CET
```

### Dynamic Content

These emails reference dynamic data. For the ones marked [DYNAMIC], you have two options:

1. **Template variables in Listmonk**: Use subscriber attributes to store scan stats and inject them with `{{ .Subscriber.Attribs.critical_count }}`
2. **Send via transactional API**: Build the email body in your backend where you have access to the user's data, and send through Listmonk's transactional endpoint

Option 2 is better for scan-result emails (Track 2 post-scan and Track 3 trial-ending emails).

### Deliverability Setup

- [ ] SPF record configured
- [ ] DKIM signing configured
- [ ] DMARC policy set (start with `p=none`, move to `p=quarantine`)
- [ ] Warm up sending volume: start with 20-50/day, increase over 2-4 weeks
- [ ] Monitor bounce rates (keep under 2%)
- [ ] Monitor spam complaint rates (keep under 0.1%)

---

## Email Volume Summary

| Track | List | Emails in sequence | Then |
|-------|------|--------------------|------|
| Acquisition | cold-leads | 3 (over 10 days) | Stop |
| Acquisition | subscribers | 6 (over 21 days) | Monthly newsletter |
| Activation | free-new | 3 (over 5 days) | Stop |
| Activation | free-scanned | 4 (over 10 days) | Stop |
| Conversion | trial-new | 3 (over 7 days) | — |
| Conversion | trial-active | 4 (over 16 days) | — |
| Retention | paid-pro | 1 welcome + monthly + quarterly | Ongoing |
| Retention | paid-team | 1 welcome + monthly + quarterly | Ongoing |

**Total unique email templates to write: ~27**  
**Total Listmonk lists: 8**  
**Campaign tracks: 4**
