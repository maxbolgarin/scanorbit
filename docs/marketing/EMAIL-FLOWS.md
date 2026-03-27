# ScanOrbit — Email Flows

All automated email sequences, triggers, timing, and transition rules.

---

## How Subscribers Move Through the System

```
                    ┌──────────┐
    Website form ──>│subscribers│──> signs up ──> free-new
    Blog opt-in ──> │          │                    │
    Lead magnet ──> └──────────┘                    │
                                              runs first scan
    Imported      ┌───────────┐                     │
    prospects ───>│cold-leads │──> signs up ──> free-new
                  └───────────┘                     │
                                                    ▼
                                              ┌──────────────┐
                                              │ free-scanned │
                                              └──────┬───────┘
                                                     │
                                              starts trial (card)
                                                     │
                                                     ▼
                                              ┌───────────┐
                                              │ trial-new │
                                              └─────┬─────┘
                                                    │
                                              2+ scans (engaged)
                                                    │
                                                    ▼
                                             ┌──────────────┐
                                             │ trial-active │
                                             └──────┬───────┘
                                                    │
                                          ┌─────────┴─────────┐
                                     pays Pro            pays Team
                                          │                   │
                                          ▼                   ▼
                                    ┌──────────┐       ┌───────────┐
                                    │ paid-pro │       │ paid-team │
                                    └──────────┘       └───────────┘
                                          │                   │
                                     cancels              cancels
                                          │                   │
                                          └─────────┬─────────┘
                                                    │
                                                    ▼
                                              ┌──────────┐
                                              │subscribers│ (knows product,
                                              └──────────┘  might return)
```

---

## Sequence 1: Cold Leads

**List:** cold-leads
**Who:** Manually imported prospects — DevOps engineers, security engineers, CTOs at AWS-paying EU companies. Found via LinkedIn, directories, communities.
**Goal:** Get them to sign up for a free account.
**Tone:** Personal, from Maksim. Short. No marketing feel.
**Sender:** Maksim <maksim@scanorbit.cloud>

| Day | Email | Purpose |
|-----|-------|---------|
| 0 | The pain point | Introduce the problem (orphaned resources, hidden costs). Mention free scan. Soft arrow link to scanorbit.cloud. |
| 4 | The GDPR angle | Highlight data residency risk — resources accidentally in US regions. Position ScanOrbit as EU-hosted. Arrow link. |
| 10 | The breakup | Last email, say so explicitly. Leave the door open. Arrow link. No follow-up after this. |

**After sequence:** Stop. Do not send again. If they sign up, they move to free-new automatically and the cold-leads sequence stops.

**Stop condition:** Subscriber signs up → removed from cold-leads, added to free-new.

---

## Sequence 2: Subscribers

**List:** subscribers
**Who:** People who opted in via website, blog, or lead magnet. Interested but not yet users.
**Goal:** Educate, build trust, drive them to create a free account and scan.
**Tone:** Helpful, educational. From Maksim. Mix of tips and soft CTAs.
**Sender:** Maksim <maksim@scanorbit.cloud>

| Day | Email | Purpose |
|-----|-------|---------|
| 0 | Welcome + quick win | Thanks for subscribing. Give an immediate actionable tip (check Elastic IPs in console). Introduce ScanOrbit. |
| 3 | Security education | Top 5 AWS misconfigurations seen across accounts. Practical, specific. Soft CTA to free scan. |
| 7 | Cost education | Explain how "stopped" doesn't mean "free" — EBS, EIPs, snapshots keep billing. Soft CTA. |
| 11 | Compliance / GDPR | Data residency issues. Resources in wrong regions. ScanOrbit is EU-hosted in Amsterdam. Soft CTA. |
| 16 | Social proof | What a typical first scan reveals — average finding counts by severity. Build curiosity. |
| 21 | Direct CTA | Last nurture email. Clear 3-step setup (create account, connect IAM role, scan). Announce switch to monthly newsletter. |

**After sequence:** Move to monthly newsletter cadence. Send newsletters via Listmonk campaign UI (not automated). Typically monthly — product updates, blog posts, AWS security tips.

**Stop condition:** Subscriber signs up → removed from subscribers, added to free-new. All remaining scheduled emails stop.

---

## Sequence 3: Free — New

**List:** free-new
**Who:** Signed up for a free account but hasn't run their first scan yet.
**Goal:** Get them to connect their AWS account and run the free scan.
**Tone:** Product-focused, helpful. From ScanOrbit. Overcome the IAM role hesitation.
**Sender:** ScanOrbit <hello@scanorbit.cloud>

| Day | Email | Purpose |
|-----|-------|---------|
| 0 | Welcome + setup steps | Account is ready. Three steps: add AWS account, create IAM role, click scan. Link to dashboard. Sent immediately. |
| 2 | Address the hesitation | Explain why connecting is safe: read-only access, no stored credentials, external ID protection, revoke anytime. Transparent CloudFormation template. |
| 5 | Value preview + urgency | Average account has 6 critical issues, $50–200/month waste, 3+ GDPR concerns. Your scan will show you. CTA to dashboard. |

**After sequence:** Stop. If they haven't scanned after 5 days, they're not ready. Don't keep pushing.

**Stop condition:** User completes scan → removed from free-new, added to free-scanned. Day-0 email of free-scanned fires immediately.

---

## Sequence 4: Free — Scanned

**List:** free-scanned
**Who:** Completed their one free scan. Can see severity counts and summary but not finding details.
**Goal:** Convert to paid trial (7 days, card required, $0 first week).
**Tone:** Data-driven, conversion-focused. Show them what they're missing. From ScanOrbit for emails 1–3, personal Maksim for the breakup.
**Sender:** ScanOrbit <hello@scanorbit.cloud> (emails 1–3), Maksim <maksim@scanorbit.cloud> (email 4)

**Dynamic data used:** critical_count, high_count, cost_count from their actual scan results.

| Day | Email | Purpose |
|-----|-------|---------|
| 0 | Scan results ready | Show their actual numbers (critical, high, cost savings in a visual stats block). List what Pro unlocks. CTA: "Try Pro Free for 7 Days." Sent immediately after scan completes. |
| 2 | Critical findings explained | Explain what critical findings typically mean (open ports, no MFA, public databases). Red alert box. "Pro shows you exactly which resources." Frame 7-day trial as enough time to resolve critical findings. |
| 5 | Cost angle | Itemize common cost wasters with dollar amounts (EBS $2.50–10/mo, EIPs $3.65/mo, old-gen instances 20–40% more). ROI argument: if cleanup saves $50/mo, Pro pays for itself. Green callout box. |
| 10 | Breakup | Softer tone, personal sender. Data retention reminder (90 days). Soft arrow-link CTA. Explicitly say "this is my last email about the upgrade." |

**After sequence:** Stop. No more conversion emails. They stay in free-scanned unless they start a trial.

**Stop condition:** User starts trial → removed from free-scanned, added to trial-new.

---

## Sequence 5: Trial — New

**List:** trial-new
**Who:** Started a paid trial (card attached, $0 first week) but hasn't shown much engagement yet.
**Goal:** Activate them — get them scanning, reviewing findings, fixing issues.
**Tone:** Onboarding, supportive. From ScanOrbit.
**Sender:** ScanOrbit <hello@scanorbit.cloud>

| Day | Email | Purpose |
|-----|-------|---------|
| 0 | Trial welcome | Confirm trial is active. List what they now have access to. Suggested first steps: run scan, review critical findings, fix easy wins, re-scan. Mention cancel anytime. Sent immediately. |
| 3 | Are you stuck? | Check in. Common questions: IAM role setup, understanding severities, how to re-scan. Invite them to reply for direct help. |

**After sequence:** If they stay in trial-new, no more emails. The goal is to get them to trial-active via engagement.

**Stop condition:** User runs 2+ scans → removed from trial-new, added to trial-active.

---

## Sequence 6: Trial — Active

**List:** trial-active
**Who:** Trial users actively using the product (2+ scans). Card is attached.
**Goal:** Ensure they see enough value to keep the subscription when the trial ends. The card is already attached so if they don't cancel, they convert automatically.
**Tone:** Deepening engagement, then gentle urgency near trial end. From ScanOrbit for product emails, Maksim for win-back.
**Sender:** ScanOrbit <hello@scanorbit.cloud> (emails 1–3), Maksim <maksim@scanorbit.cloud> (email 4)

**Important:** Day counts are from trial_started_at, not from when they entered trial-active.

| Day | Email | Purpose |
|-----|-------|---------|
| 3 | Deepen engagement | Power-user features they might not know: bulk finding updates, finding history, data residency report filter. |
| 5 | Trial ending warning (2 days left) | Amber urgency banner. Remind what happens after trial: lose access to details, re-scanning, infrastructure map. Mention subscription continues automatically. Offer Team plan if they have multiple accounts. Link to billing. |
| 6 | Last day | Amber urgency banner. Final reminder. If they want to keep Pro, do nothing — it continues. If not, cancel in Settings → Billing. |
| 9 | Win-back (2 days after expiry) | Personal tone from Maksim. Data is still there. Can pick up where they left off. Soft arrow link to reactivate. Only sent if they cancelled during trial. |

**Note on email 4 (win-back):** This should only go to users whose trial expired without converting to paid. If the card charged successfully (they didn't cancel), they move to paid-pro/paid-team and get the welcome email instead. Your backend should check subscription status before sending.

**Stop conditions:**
- Payment succeeds → removed from trial-active, added to paid-pro or paid-team.
- Trial expires + cancels → stays in trial-active for win-back email, then no more.

---

## Sequence 7: Paid — Pro

**List:** paid-pro
**Who:** Paying Pro customers (single AWS account).
**Goal:** Reduce churn. Help them get value. Occasionally surface Team plan.
**Tone:** Low frequency. Helpful, not salesy. From ScanOrbit for product emails.
**Sender:** ScanOrbit <hello@scanorbit.cloud>

| Timing | Email | Purpose |
|--------|-------|---------|
| Day 0 | Welcome to Pro | Confirm subscription. Quick reminders: scan cooldown, finding lifecycle, billing management. Pro tip about weekly scan rhythm. Sent immediately. |
| Monthly | Product update | What's new this month. Their account stats if available (findings resolved, new findings). One useful tip. Sent as a manual Listmonk campaign, not automated. |
| Quarterly | Team upsell (subtle) | "Managing multiple AWS accounts?" List Team benefits: unlimited accounts, team members, no cooldown, org dashboard. Only if relevant. No pressure. Sent as a manual campaign. |

**Stop conditions:**
- Upgrades to Team → removed from paid-pro, added to paid-team.
- Cancels → removed from paid-pro, added to subscribers.

---

## Sequence 8: Paid — Team

**List:** paid-team
**Who:** Paying Team customers (multiple accounts, team access). Highest-value customers.
**Goal:** Make them successful. Collect feedback. Minimize churn.
**Tone:** Minimal email. Respectful of their time. From ScanOrbit for product, Maksim for feedback.
**Sender:** ScanOrbit <hello@scanorbit.cloud> (product), Maksim <maksim@scanorbit.cloud> (feedback)

| Timing | Email | Purpose |
|--------|-------|---------|
| Day 0 | Welcome to Team | Confirm plan. Walkthrough: add multiple accounts, invite team members, roles (Admin vs Member), org dashboard. Offer personal help for onboarding. Sent immediately. |
| Monthly | Account health summary | Org-level stats: accounts connected, total findings, findings resolved this month, team members, critical findings remaining. Sent as a manual campaign. |
| Quarterly | Feedback request | Personal email from Maksim. Two questions: what's most useful, what's one thing to improve. No form, no survey — just reply. Every response shapes the product. |

**Stop condition:** Cancels → removed from paid-team, added to subscribers.

---

## Transition Rules Summary

| Event | Remove from | Add to | Immediate email |
|-------|-------------|--------|-----------------|
| Signs up (free) | cold-leads, subscribers | free-new | free-new day 0 |
| Subscribes via website | — | subscribers | subscribers day 0 |
| Completes first scan | free-new | free-scanned | free-scanned day 0 |
| Starts trial (card attached) | free-new, free-scanned, subscribers, cold-leads | trial-new | trial-new day 0 |
| Runs 2+ scans during trial | trial-new | trial-active | — (next scheduled email) |
| First payment succeeds (Pro) | trial-new, trial-active, free-* | paid-pro | paid-pro day 0 |
| First payment succeeds (Team) | trial-new, trial-active, free-* | paid-team | paid-team day 0 |
| Upgrades Pro → Team | paid-pro | paid-team | paid-team day 0 |
| Cancels / churns | paid-pro, paid-team, trial-* | subscribers | — |
| Deletes account | all lists | — | — |

---

## Email Volume per Subscriber

Maximum emails a subscriber can receive across their full lifecycle:

| Stage | Automated emails | Manual campaigns |
|-------|-----------------|------------------|
| Subscribers (before signup) | 6 over 21 days | Monthly newsletter |
| Free-new | 3 over 5 days | — |
| Free-scanned | 4 over 10 days | — |
| Trial-new | 2 over 3 days | — |
| Trial-active | 4 over 9 days | — |
| Paid-pro | 1 welcome | Monthly + quarterly |
| Paid-team | 1 welcome | Monthly + quarterly |

**Worst case (full funnel, no overlap):** 21 automated emails + ongoing monthly/quarterly. In practice, most users skip stages (e.g., sign up directly without being a subscriber first), so they receive far fewer.

---

## Timing Principles

- **Day-0 emails fire immediately** from your event handler (not the daily cron). The user just took an action — strike while it's warm.
- **All other emails send at 9:00 AM CET** via the daily cron job. Morning sends get higher open rates for EU business audience.
- **Breakup emails are always last.** Explicitly say "this is my last email about X." Respect the recipient.
- **Cold outreach maximum 3 emails.** Anything more damages your reputation and brand.
- **No overlapping sequences.** A subscriber is in exactly one list at a time. Moving to a new list stops the old sequence automatically.
- **Card-required trial changes the CTA.** Every trial CTA includes risk reversal: "$0 for 7 days, cancel anytime."
- **Personal sender for soft emails.** Use "Maksim <maksim@...>" for cold outreach, breakup emails, win-back emails, and feedback requests. Use "ScanOrbit <hello@...>" for product and conversion emails.
