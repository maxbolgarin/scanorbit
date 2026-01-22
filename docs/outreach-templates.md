# ScanOrbit Outreach Templates

> DM and email templates for cold outreach, warm follow-ups, partnerships, and events

---

## Table of Contents

1. [Cold Outreach](#cold-outreach)
2. [Warm Outreach](#warm-outreach)
3. [Partnership Outreach](#partnership-outreach)
4. [Event Follow-up](#event-follow-up)
5. [Outreach Best Practices](#outreach-best-practices)

---

## Cold Outreach

### For DevOps / Platform Engineers

**Template 1: Problem-First Approach**
```
Hey [Name],

Noticed you're working on [AWS/infrastructure at Company].

Quick question: when was the last time you audited for orphaned resources?

Common culprits that add up:
- Unattached EBS volumes
- Unused Elastic IPs
- Forgotten snapshots

Built a tool that finds them in 5 minutes, no agents needed.

Would a free scan be useful?
```

**Template 2: Specific Pain Point**
```
Hey [Name],

Saw your post about [specific AWS challenge - e.g., cost optimization, compliance, SSL management].

We built ScanOrbit to help with exactly that. It's an agentless scanner that [specific relevant benefit - e.g., "finds orphaned resources and shows estimated monthly cost"].

Free tier, 5-minute setup, EU-hosted if GDPR matters.

Happy to give you a walkthrough if interested.
```

**Template 3: Mutual Connection / Community**
```
Hey [Name],

Found you through [community/post/mutual connection - e.g., "the AWS subreddit", "DevOps Weekly newsletter", "our mutual connection Alex"].

Working on something that might help your team: agentless AWS scanning for orphaned resources, SSL expiry, and compliance.

No sales pitch - just curious if that's a problem you're dealing with. We're early stage and looking for feedback from people doing real DevOps work.

Worth a quick chat?
```

**Template 4: Content-Based**
```
Hey [Name],

Read your [blog post/talk/tweet] about [topic]. Solid insights on [specific point].

We're building something related - ScanOrbit scans AWS accounts for orphaned resources and compliance issues without agents.

Thought you might find it interesting given your work on [related area].

Here if you want to check it out: scanorbit.cloud
```

### For Engineering Managers / CTOs

**Template 5: Business Impact Focus**
```
Hey [Name],

Quick question for you: do you know how much [Company] spends on unused AWS resources?

Industry data says 25-35% of cloud spend is typically waste. For most teams, that's orphaned EBS volumes, forgotten snapshots, and stopped instances nobody remembers.

Built a tool that finds all of it in one scan. 5-minute setup, read-only access, EU-hosted.

Would a visibility report be useful for your next infrastructure review?
```

**Template 6: Compliance Angle**
```
Hey [Name],

For EU-based teams, GDPR data residency is non-negotiable. But tracking where your AWS resources actually live across regions?

That's harder than it should be.

We built ScanOrbit to automatically flag resources outside preferred regions - plus orphaned resources and expiring SSL certs.

Free tier available if you want to see what's in your account: scanorbit.cloud
```

### For FinOps Professionals

**Template 7: Cost Optimization**
```
Hey [Name],

Saw you're focused on cloud cost optimization at [Company].

Quick win we've seen help FinOps teams: scanning for orphaned resources.

Unattached EBS volumes, unused Elastic IPs, forgotten snapshots - they add up fast and are usually easy to clean up once found.

We built ScanOrbit to surface these in one scan. Free tier, no agents, 5 minutes.

Might be useful alongside your existing FinOps tools?
```

---

## Warm Outreach

### After Website Visit

**Template 1: Simple Check-In**
```
Hey [Name],

Saw you checked out ScanOrbit - thanks for looking!

Any questions I can answer? Happy to:
- Walk through a demo
- Explain the IAM setup
- Share what other teams have found

No pressure, just here if useful.
```

**Template 2: Value-Add Follow-up**
```
Hey [Name],

Noticed you visited scanorbit.cloud recently.

In case it helps, here's what most teams find on their first scan:
- 5-15 orphaned EBS volumes
- 2-5 unused Elastic IPs
- 1-3 SSL certs closer to expiry than expected

Free tier lets you scan one account - takes about 5 minutes to set up.

Let me know if you have any questions about the IAM permissions or setup.
```

### After Free Sign-up

**Template 3: Onboarding Check**
```
Hey [Name],

Welcome to ScanOrbit!

Did the first scan go okay?

Most people find:
- A few orphaned EBS volumes they forgot about
- Some SSL certs closer to expiry than expected
- Resources in regions they didn't expect

Let me know if anything looks confusing or if you want help interpreting the findings.
```

**Template 4: Usage Follow-up (No Scan Yet)**
```
Hey [Name],

Noticed you signed up for ScanOrbit but haven't run a scan yet.

Stuck on the IAM setup? Happy to help.

The role creation takes about 3 minutes:
1. Copy our IAM policy (it's all Describe* and List* actions)
2. Create a role with our account as trusted principal
3. Paste the ARN in your dashboard

Here if you need a hand.
```

**Template 5: Post-First-Scan**
```
Hey [Name],

Saw your first scan completed - nice!

How did it look? Find anything unexpected?

Common reactions:
- "Didn't know those EBS volumes existed"
- "That SSL cert expires sooner than I thought"
- "Why do we have resources in us-east-1?"

Happy to walk through the findings if useful.
```

### After Trial Period

**Template 6: Trial Ending**
```
Hey [Name],

Your ScanOrbit trial wraps up in [X days].

Before it does, wanted to check:
- Did you find the scans useful?
- Anything missing that would make the Pro plan worth it?
- Questions about how we compare to alternatives?

No hard sell - just want to make sure you have what you need to decide.
```

**Template 7: Trial Ended (No Conversion)**
```
Hey [Name],

Your ScanOrbit trial ended, and I noticed you didn't upgrade.

Totally fine - but curious: was there something that didn't work for you?

Feedback helps us improve, and if there's a specific blocker, sometimes we can help.

Either way, the free tier is still available if you want basic scanning.
```

---

## Partnership Outreach

### Complementary Tool Integration

**Template 1: Integration Proposal**
```
Hey [Name],

Love what you're building with [Their Product].

We're working on ScanOrbit - agentless AWS scanning for orphaned resources, SSL, and compliance.

Seeing potential synergy: [specific integration idea - e.g., "ScanOrbit findings could feed into your cost dashboards" or "your users could trigger scans from your platform"].

Would you be open to exploring a partnership or integration?

Either way, keep building - your tool is great.
```

**Template 2: Technical Integration**
```
Hey [Name],

[Their Product] + ScanOrbit could work well together.

Use case I'm thinking: [specific scenario - e.g., "your infrastructure monitoring + our compliance scanning = complete visibility"].

We have an API on our Team plan that could make integration straightforward.

Worth a 20-minute call to explore?
```

### Agency / Consultancy Partnerships

**Template 3: MSP/Agency Outreach**
```
Hey [Name],

Saw [Agency Name] does AWS consulting for [type of clients].

We built ScanOrbit - agentless scanning for orphaned resources, SSL, and compliance. Thinking it could help your clients.

Partnership options:
- Referral program (commission on conversions)
- White-label reports for your clients
- Bulk pricing for managed accounts

Interested in exploring?
```

**Template 4: DevOps Consultancy**
```
Hey [Name],

Quick question: when you do AWS audits for clients, how do you currently check for orphaned resources and compliance?

We built a tool that automates this - 5 minutes, read-only, gives you a report you can share with clients.

Some consultancies use it as part of their assessment process.

Want to try it on a client account?
```

### Content / Co-Marketing

**Template 5: Guest Post / Collaboration**
```
Hey [Name],

Big fan of [their blog/newsletter/podcast].

We're building ScanOrbit (AWS infrastructure scanning) and have some data on cloud waste patterns that might interest your audience.

Would you be open to a guest post or collaboration? Topics we could cover:
- Most common orphaned resources and their costs
- GDPR compliance pitfalls in multi-region AWS
- SSL certificate management best practices

Let me know if any of these fit.
```

---

## Event Follow-up

### After Conference / Meetup

**Template 1: Met in Person**
```
Hey [Name],

Great meeting you at [Event]!

As promised, here's the link to ScanOrbit: scanorbit.cloud

The free tier lets you scan one AWS account - should give you a sense of what we find.

Let me know if you run into any issues or have questions after trying it.

Talk soon.
```

**Template 2: Exchanged Cards**
```
Hey [Name],

Good connecting at [Event] - enjoyed our conversation about [specific topic].

Here's that tool I mentioned: scanorbit.cloud

It does agentless AWS scanning for orphaned resources, SSL expiry, and GDPR compliance. Free tier available.

Let me know if you check it out - happy to walk through anything.
```

**Template 3: Attended Talk / Workshop**
```
Hey [Name],

Caught your talk at [Event] on [topic]. Really liked your point about [specific insight].

We're building something related - ScanOrbit scans AWS for [relevant feature based on their talk topic].

Thought you might find it interesting. Here if you want to chat more about it.
```

### After Webinar / Online Event

**Template 4: Webinar Attendee**
```
Hey [Name],

Thanks for joining our [webinar/demo] on [topic]!

Quick follow-ups:
- Recording: [link if applicable]
- Free trial: scanorbit.cloud
- Questions? Reply here

What was most useful from the session?
```

**Template 5: Didn't Attend (Registered)**
```
Hey [Name],

Sorry we missed you at the [webinar/demo]!

In case you're still interested:
- Recording: [link]
- TL;DR: ScanOrbit finds orphaned resources, SSL issues, and compliance gaps in AWS. 5-minute setup, read-only.

Let me know if you want a personal walkthrough instead.
```

---

## Outreach Best Practices

### Do's

| Practice | Why It Matters |
|----------|----------------|
| **Personalize the first line** | Shows you did research, not mass outreach |
| **Lead with their problem** | They care about their challenges, not your product |
| **Keep it short** | Respect their time - under 150 words ideal |
| **Include one clear CTA** | Don't confuse with multiple asks |
| **Follow up once** | Persistence works, but only once |
| **Mention free tier** | Removes friction and risk |

### Don'ts

| Avoid | Why |
|-------|-----|
| **"I hope this finds you well"** | Generic opener that signals mass outreach |
| **Feature lists** | They don't care about features, they care about outcomes |
| **Pressure tactics** | Creates negative association with brand |
| **Multiple messages same day** | Comes across as desperate |
| **Attaching PDFs/decks** | Too much friction, low open rates |
| **Fake urgency** | Destroys trust |

### Follow-up Cadence

| Touchpoint | Timing | Channel |
|------------|--------|---------|
| Initial outreach | Day 0 | DM / Email |
| Follow-up 1 | Day 3-5 | Same channel |
| Follow-up 2 | Day 10-14 | Different channel (optional) |
| Break | 30+ days | - |
| Re-engage | 60+ days | New angle/reason |

### Personalization Checklist

Before sending, verify you've included:

- [ ] Their name (spelled correctly)
- [ ] Their company or role
- [ ] Something specific to them (post, project, challenge)
- [ ] Relevant benefit for their situation
- [ ] Clear, single call to action
- [ ] Your name and easy way to respond

### Response Templates

**When they say "Not interested":**
```
Totally understand - thanks for letting me know.

If anything changes or you want to revisit later, I'm here.

Good luck with [their project/role]!
```

**When they say "Maybe later":**
```
No problem - timing matters.

Mind if I check back in [timeframe they mentioned, or 2-3 months]?

In the meantime, free tier is always available: scanorbit.cloud
```

**When they ask about pricing:**
```
Good question!

Free: 1 AWS account, single scan, 7-day retention
Pro: €19/month - unlimited scans, 90-day retention, all tools
Team: €79/month - multiple accounts, API access, priority support

Free tier is a good way to see what we find before committing.

Want me to set up a call to discuss what fits your needs?
```

**When they ask about security:**
```
Great question - security is core to how we built this.

Key points:
- Read-only IAM role (Describe* and List* only)
- We cannot modify your infrastructure - technically impossible
- All data encrypted (AES-256 at rest, TLS 1.3 in transit)
- EU-hosted (Frankfurt)
- We only store metadata, never actual resource data

Happy to share the exact IAM policy or jump on a call to walk through our architecture.
```

---

## Tracking & Metrics

### Key Metrics to Track

| Metric | Target | Notes |
|--------|--------|-------|
| Response rate | 15-25% | Higher for warm outreach |
| Positive response rate | 5-10% | Interest in demo/trial |
| Conversion to free trial | 50%+ | Of positive responses |
| Trial to paid | 10-20% | Industry benchmark |

### CRM Tags (Suggested)

- `cold-outreach-sent`
- `warm-follow-up`
- `responded-interested`
- `responded-not-now`
- `responded-not-interested`
- `trial-started`
- `trial-converted`
- `partnership-potential`

---

*Last updated: January 2025*
