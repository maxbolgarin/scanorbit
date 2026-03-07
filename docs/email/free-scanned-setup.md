# Free-Scanned Sequence — Setup Cheatsheet

## Overview

| # | Day | Subject Line | Template | From | Angle |
|---|-----|-------------|----------|------|-------|
| 1 | 0 (immediate) | Your scan results are ready | 03-upgrade-cta | ScanOrbit \<hello@scanorbit.cloud\> | Show what they found → feature list → trial CTA |
| 2 | 2 | About your critical findings | 03-upgrade-cta | ScanOrbit \<hello@scanorbit.cloud\> | Explain what critical means → urgency → trial CTA |
| 3 | 5 | About those cost findings... | 03-upgrade-cta | ScanOrbit \<hello@scanorbit.cloud\> | Cost savings angle → ROI argument → trial CTA |
| 4 | 10 | Your scan data has a shelf life | 01-transactional | Maksim \<maksim@scanorbit.cloud\> | Soft breakup → data retention reminder → arrow link |

## Listmonk Setup Steps

### For Emails 1-3 (transactional API — recommended)

These emails use dynamic scan data, so it's best to send them from your ScanOrbit backend via the transactional API:

```bash
curl -u 'admin:password' 'http://listmonk:9000/api/tx' -X POST \
  -H 'Content-Type: application/json' \
  -d '{
    "subscriber_email": "user@example.com",
    "template_id": UPGRADE_TEMPLATE_ID,
    "data": {
      "critical_count": 4,
      "high_count": 8,
      "medium_count": 15,
      "cost_count": 7,
      "total_findings": 34
    },
    "content_type": "html",
    "body": "PASTE_CAMPAIGN_HTML_HERE"
  }'
```

Your backend should:
1. After scan completes → immediately send Email 1
2. Track `scan_completed_at` timestamp per user
3. Cron job at 9:00 AM daily → check for users at Day 2 and Day 5 → send emails 2 and 3

### For Email 4 (regular campaign or transactional)

Email 4 doesn't use dynamic scan data, so you can either:
- **Option A:** Send via transactional API from the same cron job (Day 10 check)
- **Option B:** Create as a regular Listmonk campaign targeting a segment

### Segment query for Option B (Email 4)

In Listmonk, create a campaign targeting `free-scanned` list with this subscriber query:

```sql
subscribers.created_at <= NOW() - INTERVAL '10 days'
AND subscribers.created_at >= NOW() - INTERVAL '11 days'
```

Run this as a daily scheduled campaign.

## Dynamic Data Contract

Your ScanOrbit backend should pass this data when sending via transactional API:

```json
{
  "critical_count": 4,      // findings with severity = critical
  "high_count": 8,          // findings with severity = high
  "medium_count": 15,       // findings with severity = medium
  "cost_count": 7,          // findings in cost optimization category
  "total_findings": 34,     // sum of all findings
  "total_resources": 187    // total resources discovered
}
```

## Stop Conditions

**Remove from this sequence immediately when:**
- User starts a Pro or Team trial → move to `trial-new` list
- User pays for Pro or Team → move to `paid-pro` or `paid-team` list
- User deletes account

This prevents someone from getting "start your trial" emails after they already started one.

## Testing Checklist

- [ ] Email 1: send test to yourself with sample data, verify stats render
- [ ] Email 2: verify the red critical-findings box looks right
- [ ] Email 3: verify bullet list spacing
- [ ] Email 4: confirm it uses the Transactional template (not Upgrade)
- [ ] All: check CTA links point to correct billing/trial page
- [ ] All: test on mobile (Gmail app, Apple Mail)
- [ ] All: verify unsubscribe link works
- [ ] All: check dark mode rendering (Apple Mail)
