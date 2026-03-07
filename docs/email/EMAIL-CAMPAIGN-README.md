# Email Campaign System — Listmonk + SaaS Product Integration

Complete guide to setting up automated email campaigns using Listmonk as the email platform and a SaaS product backend (Node.js/TypeScript) as the trigger system. Written using ScanOrbit (AWS infrastructure scanner) as the working example, but the architecture applies to any SaaS product with a free → trial → paid funnel.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Concepts](#2-concepts)
3. [Listmonk Installation](#3-listmonk-installation)
4. [Domain and SMTP Configuration](#4-domain-and-smtp-configuration)
5. [Deliverability Setup (SPF / DKIM / DMARC)](#5-deliverability-setup-spf--dkim--dmarc)
6. [Lists — Segmenting Your Audience](#6-lists--segmenting-your-audience)
7. [Templates — Email Design System](#7-templates--email-design-system)
8. [Transactional Templates — Drip Email Content](#8-transactional-templates--drip-email-content)
9. [Backend Integration — Subscriber Lifecycle](#9-backend-integration--subscriber-lifecycle)
10. [Drip Scheduler — Automated Sequences](#10-drip-scheduler--automated-sequences)
11. [Bounce Handling](#11-bounce-handling)
12. [Warm-Up Strategy](#12-warm-up-strategy)
13. [Manual Campaigns — Newsletters](#13-manual-campaigns--newsletters)
14. [Monitoring and Analytics](#14-monitoring-and-analytics)
15. [Troubleshooting](#15-troubleshooting)
16. [File Reference](#16-file-reference)

---

## 1. Architecture Overview

The system has two halves: Listmonk manages content, sending, tracking, and unsubscribe. Your backend manages timing, subscriber state, and lifecycle transitions.

```
YOUR SAAS BACKEND                              LISTMONK
┌─────────────────────────────┐               ┌──────────────────────────────┐
│                             │               │                              │
│  User events:               │               │  Owns:                       │
│    signup                   │               │    email content (templates)  │
│    scan complete            │  POST /api/*  │    unsubscribe pages + links  │
│    trial start         ────────────────────>│    bounce processing          │
│    payment                  │               │    open/click tracking        │
│    churn                    │               │    analytics dashboard        │
│                             │               │    SMTP sending               │
│  Drip scheduler (cron):     │               │                              │
│    checks who needs email   │  POST /api/tx │  Sends:                      │
│    sends template ID + data ────────────────>│    renders template + data   │
│                             │               │    adds tracking pixel        │
│  Bounce bridge:             │               │    adds unsubscribe link      │
│    receives SMTP webhook    │  POST /web    │    delivers via SMTP          │
│    forwards to Listmonk    ────────────────>│    records for analytics      │
│                             │  hooks/bounce │                              │
└─────────────────────────────┘               └──────────────────────────────┘
```

**Key principle: content lives in Listmonk, logic lives in code.** When you want to edit email copy, you do it in Listmonk's browser UI. When you want to change timing or targeting, you edit code. They never overlap.

---

## 2. Concepts

**List** — A segment of subscribers. Each list represents a stage in your funnel. Subscribers move between lists as they progress (signup → scan → trial → paid). Lists are created in the Listmonk UI.

**Campaign Template** — A reusable HTML wrapper (header, footer, styles) used for manual newsletter campaigns. Contains `{{ template "content" . }}` where campaign content gets injected. You typically need 2–3 of these.

**Transactional Template** — A complete, standalone email (subject + full HTML body) used for automated drip sequences. Your backend sends these via the Listmonk API by passing a template ID and dynamic data. This is where all your drip email content lives.

**Campaign** — A manual send to a list. Used for newsletters, announcements, one-off emails. Composed and sent from the Listmonk UI.

**Transactional Send** — An API-triggered send to a single subscriber. Used by your drip scheduler and event handlers. Your backend calls `POST /api/tx` with a template ID, subscriber email, and data.

**Subscriber Attributes** — Key-value data attached to a subscriber (e.g., `critical_count: 4`, `trial_ends_at: "2026-03-14"`). Your backend stores these when events happen. Templates access them via `{{ .Tx.Data.key }}`.

**Drip Sequence** — A series of emails sent at timed intervals after a subscriber enters a list. Example: when someone completes a scan, they get email 1 immediately, email 2 on day 2, email 3 on day 5, email 4 on day 10.

**Bounce** — A rejected email. Hard bounces (address doesn't exist) are permanent. Soft bounces (mailbox full, server down) are temporary. Bounce handling automatically stops sending to dead addresses to protect your sender reputation.

---

## 3. Listmonk Installation

Listmonk is a single Go binary with a PostgreSQL database. The simplest deployment is Docker Compose.

Create `docker-compose.listmonk.yml`:

```yaml
version: "3.7"
services:
  listmonk:
    image: listmonk/listmonk:latest
    container_name: listmonk
    ports:
      - "9000:9000"
    environment:
      - TZ=Europe/Amsterdam
    volumes:
      - ./listmonk-config.toml:/listmonk/config.toml
    depends_on:
      - listmonk-db
    restart: unless-stopped

  listmonk-db:
    image: postgres:15-alpine
    container_name: listmonk-db
    environment:
      - POSTGRES_USER=listmonk
      - POSTGRES_PASSWORD=CHANGE_ME
      - POSTGRES_DB=listmonk
    volumes:
      - listmonk-data:/var/lib/postgresql/data
    restart: unless-stopped

volumes:
  listmonk-data:
```

Create `listmonk-config.toml`:

```toml
[app]
address = "0.0.0.0:9000"
admin_username = "admin"
admin_password = "CHANGE_ME"

[db]
host = "listmonk-db"
port = 5432
user = "listmonk"
password = "CHANGE_ME"
database = "listmonk"
ssl_mode = "disable"
```

Run:

```bash
# First time: initialize the database
docker compose -f docker-compose.listmonk.yml run --rm listmonk ./listmonk --install

# Start
docker compose -f docker-compose.listmonk.yml up -d
```

Listmonk is now at `http://localhost:9000`. Log in with the admin credentials from the config.

If Listmonk runs in the same Docker network as your SaaS backend, use `http://listmonk:9000` as the internal URL. Expose port 9000 only to your backend, not to the public internet.

### API Access

Go to Settings → API and create an API user. You'll need the username and token for your backend's environment variables:

```bash
LISTMONK_URL=http://listmonk:9000
LISTMONK_USER=api_user
LISTMONK_TOKEN=your-generated-token
```

---

## 4. Domain and SMTP Configuration

Go to **Settings → SMTP** in Listmonk.

| Field | Value |
|-------|-------|
| Host | Your SMTP server hostname |
| Port | 587 (STARTTLS) or 465 (SSL) |
| Auth protocol | Login |
| Username | Your SMTP username |
| Password | Your SMTP password |
| TLS | STARTTLS or SSL depending on port |
| Default "From" email | `hello@yourdomain.com` |
| Default "From" name | Your Product Name |

Click "Send test email" to verify.

### Custom headers (optional but recommended)

In the SMTP settings, add custom headers for bounce handling:

```
[{"Return-Path": "bounces@yourdomain.com"}]
```

This routes bounce notifications to a dedicated address rather than the "From" address.

### ScanOrbit example

ScanOrbit uses Scaleway Transactional Email as the SMTP provider, with `hello@scanorbit.cloud` as the default sender and `Maksim <maksim@scanorbit.cloud>` as the personal sender for cold outreach and breakup emails.

---

## 5. Deliverability Setup (SPF / DKIM / DMARC)

Without these three DNS records, Gmail and Outlook will reject or spam-folder your emails. This is non-negotiable.

### SPF (Sender Policy Framework)

Tells receiving servers which IPs are allowed to send email for your domain.

```
Type: TXT
Host: @
Value: v=spf1 include:your-smtp-provider.com ~all
```

Replace `your-smtp-provider.com` with your SMTP provider's SPF include. For Scaleway TEM, check their documentation for the exact include domain.

### DKIM (DomainKeys Identified Mail)

A digital signature proving the email wasn't tampered with. Your SMTP provider gives you a DKIM record to add.

```
Type: TXT (or CNAME, depending on provider)
Host: provider-selector._domainkey
Value: (provided by your SMTP provider)
```

### DMARC (Domain-based Message Authentication)

Tells receiving servers what to do if SPF/DKIM fail.

Start with monitoring mode:

```
Type: TXT
Host: _dmarc
Value: v=DMARC1; p=none; rua=mailto:dmarc@yourdomain.com
```

After 2–4 weeks of clean sending, upgrade to quarantine:

```
Value: v=DMARC1; p=quarantine; rua=mailto:dmarc@yourdomain.com
```

### Verification

Use an online tool like [MXToolbox](https://mxtoolbox.com) or [Mail Tester](https://www.mail-tester.com) to verify all three records are correctly configured. Send a test email and check the score.

---

## 6. Lists — Segmenting Your Audience

Lists represent stages in your user funnel. Create them in **Subscribers → Lists → + New**.

### Recommended list structure for a SaaS product

| List | Type | Purpose |
|------|------|---------|
| cold-leads | Private | Manually imported prospects (outbound) |
| subscribers | **Public** | Opted in via website, blog, lead magnets (inbound) |
| free-new | Private | Signed up for free account, no key action yet |
| free-activated | Private | Completed the key free action (e.g., first scan, first project) |
| trial-new | Private | Started paid trial, low engagement |
| trial-active | Private | Trial user actively using the product |
| paid-basic | Private | Paying customer, lower tier |
| paid-premium | Private | Paying customer, higher tier |

Set `subscribers` as **Public** (it's the opt-in list for your website forms). All others are **Private** (managed by your backend code).

### ScanOrbit example

ScanOrbit uses exactly this structure with product-specific names: `free-new` (signed up), `free-scanned` (ran first scan), `trial-new`, `trial-active`, `paid-pro`, `paid-team`.

### List rules

- Subscribers move **forward** through lists, never backward (except churn → subscribers).
- A subscriber should only be in **one list at a time** (your backend removes them from the old list when adding to the new one).
- Your backend manages all list transitions via the Listmonk API. Users never interact with lists directly.

### Creating lists via API

You can create lists programmatically instead of manually:

```bash
curl -u 'api_user:token' -X POST 'http://listmonk:9000/api/lists' \
  -H 'Content-Type: application/json' \
  -d '{"name": "free-new", "type": "private", "optin": "single", "tags": ["auto"]}'
```

Note the returned `id` — you'll need it for your backend config.

---

## 7. Templates — Email Design System

Listmonk has two types of templates: **Campaign templates** (wrappers for manual newsletters) and **Transactional templates** (complete standalone emails for automated sends).

### Campaign Templates (wrappers)

You typically need 2–3 campaign templates. These are HTML wrappers with `{{ template "content" . }}` where the campaign body gets inserted.

**Template 1: Personal / Transactional** — Minimal design, plain-text feel. Best for onboarding emails, cold outreach, anything that should feel like a personal message. Highest deliverability because it doesn't look like marketing.

**Template 2: Newsletter** — Branded header and footer, structured layout. For monthly updates, blog digests, educational content.

**Template 3: Upgrade / CTA** — Same minimal wrapper but designed to work with urgency banners, stats blocks, and prominent CTA buttons.

### Design best practices (2025–2026)

- **Single column layout** — 560px max width for personal feel, 600px for newsletters.
- **Mobile first** — 16px minimum body text, 48px minimum button height, touch-friendly spacing. Over 60% of emails are opened on mobile.
- **System font stack** — `-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif`. Renders natively everywhere, loads instantly.
- **Dark mode support** — Include `prefers-color-scheme: dark` media queries. Test in Apple Mail.
- **Single CTA per email** — One primary action. Don't compete with yourself.
- **Plain-text style for B2B** — Engineers and CTOs respond better to emails that look personal, not marketing blasts. Heavy HTML templates trigger spam filters and lower engagement.
- **Table-based layout** — Required for Outlook compatibility. Use `role="presentation"` on all tables.
- **MSO conditionals** — VML roundrect buttons for Outlook: `<!--[if mso]>...<![endif]-->`.

### Template variables

In campaign templates:

```
{{ .Subscriber.FirstName }}    — subscriber name
{{ .Subscriber.Email }}        — subscriber email
{{ template "content" . }}     — where campaign body gets inserted
{{ UnsubscribeURL }}           — auto-generated unsubscribe link
{{ TrackView }}                — tracking pixel (place before closing </body>)
```

Create campaign templates in **Campaigns → Templates → + New** (Type: **Campaign**).

---

## 8. Transactional Templates — Drip Email Content

This is where all your automated email content lives. Each drip email is a **transactional template** — a complete, self-contained HTML email with its own subject line.

### How they work

Your backend sends a transactional email by calling the Listmonk API with a template ID and dynamic data:

```bash
curl -u 'api_user:token' -X POST 'http://listmonk:9000/api/tx' \
  -H 'Content-Type: application/json' \
  -d '{
    "subscriber_email": "user@example.com",
    "template_id": 15,
    "data": {
      "first_name": "Alex",
      "critical_count": 4,
      "trial_ends_at": "March 14, 2026"
    }
  }'
```

Listmonk renders the template with the data, adds the tracking pixel and unsubscribe link, and sends via SMTP. Your code never touches HTML.

### Variables in transactional templates

```
{{ .Tx.Data.first_name }}      — from the "data" object in the API call
{{ .Tx.Data.critical_count }}  — any key you pass
{{ .Tx.Data.trial_ends_at }}   — dates, numbers, strings
{{ UnsubscribeURL }}           — auto-generated
{{ TrackView }}                — tracking pixel
```

### Structuring drip sequences

Group transactional templates by sequence. Name them with the pattern `{sequence}-day{N}-{description}`:

```
free-scanned-day0-results
free-scanned-day2-critical
free-scanned-day5-cost
free-scanned-day10-breakup
```

This makes them easy to find in the Listmonk UI and map to your drip config in code.

### Creating transactional templates via API

```bash
curl -u 'api_user:token' -X POST 'http://listmonk:9000/api/templates' \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "free-scanned-day0-results",
    "type": "tx",
    "subject": "Your scan results are ready",
    "body": "<html>...full email HTML...</html>"
  }'
```

The `type: "tx"` makes it a transactional template. Note the returned `id`.

You can script creation of all templates at once — read HTML files from a directory and POST each one.

### ScanOrbit example

ScanOrbit has 24 transactional templates across 8 sequences:

| Sequence | Emails | Goal |
|----------|--------|------|
| cold-leads | 3 (day 0, 4, 10) | Get prospects to sign up |
| subscribers | 6 (day 0, 3, 7, 11, 16, 21) | Educate → free scan CTA |
| free-new | 3 (day 0, 2, 5) | Get them to run first scan |
| free-scanned | 4 (day 0, 2, 5, 10) | Convert to paid trial |
| trial-new | 2 (day 0, 3) | Activate trial user |
| trial-active | 4 (day 3, 5, 6, 9) | Retain through trial end |
| paid-pro | 1 (day 0) | Welcome, reduce churn |
| paid-team | 1 (day 0) | Welcome, onboard team |

### Editing content later

When you want to change email copy: Campaigns → Templates → find the transactional template → edit in browser → save. No code changes, no deployments. The next API call to that template ID uses the updated content automatically.

---

## 9. Backend Integration — Subscriber Lifecycle

Your backend needs a thin integration layer that maps product events to Listmonk list transitions.

### The Listmonk client

A minimal HTTP wrapper around the Listmonk API. Only needs these operations:

| Function | Listmonk API | Purpose |
|----------|-------------|---------|
| `upsertSubscriber()` | `POST /api/subscribers` | Create or update subscriber |
| `findSubscriber()` | `GET /api/subscribers?query=...` | Find by email |
| `updateAttribs()` | `PUT /api/subscribers/{id}` | Update subscriber attributes |
| `addToLists()` | `PUT /api/subscribers/lists` | Add to lists |
| `removeFromLists()` | `PUT /api/subscribers/lists` | Remove from lists |
| `moveToLists()` | (remove + add) | Move between lists |
| `sendTx()` | `POST /api/tx` | Send transactional email |
| `queryByList()` | `GET /api/subscribers?query=...` | Query subscribers in a list |

### Event → list transition mapping

Each product event triggers a single function call that moves the subscriber to the correct list and stores relevant data as attributes.

| Event | List transition | Attributes stored |
|-------|----------------|-------------------|
| User signs up | → free-new | `signup_at`, `tier: free` |
| Key free action (e.g., first scan) | free-new → free-activated | `action_completed_at`, product-specific data |
| Trial starts (card attached) | free-* → trial-new | `trial_started_at`, `trial_ends_at`, `plan` |
| Trial engagement (2+ key actions) | trial-new → trial-active | `scan_count` or equivalent |
| First payment succeeds | trial-* → paid-basic/premium | `paid_at`, `plan` |
| Plan upgrade | paid-basic → paid-premium | `upgraded_at` |
| Churn (subscription cancelled) | paid-* / trial-* → subscribers | `churned_at` |
| Account deleted | Remove from all lists | — |
| Newsletter opt-in (website) | → subscribers | `subscribed_at`, `source` |

### Implementation rules

- **Fire-and-forget** — wrap every lifecycle call in try/catch. Email marketing should never block your core product flow. If Listmonk is down, the user still signs up / scans / pays.
- **One subscriber, one list** — always remove from old lists before adding to new ones. A subscriber in multiple funnel lists will get overlapping emails.
- **Don't downgrade** — if someone subscribes via your website but is already a paying user, don't add them to the subscribers list.
- **Store data as attributes** — any data your drip emails need (scan results, trial end date, plan name) should be stored on the subscriber when the event happens, not fetched later.

### ScanOrbit example

ScanOrbit stores scan results (critical_count, high_count, cost_count, etc.) as subscriber attributes when a scan completes. The drip scheduler passes these to the transactional API, and the email template renders them as a visual stats block.

---

## 10. Drip Scheduler — Automated Sequences

Listmonk does not have built-in drip automation. You need a scheduler that runs daily, checks who needs which email, and sends it.

### The config table

A pure data structure mapping (list, day) → template ID:

```typescript
const SEQUENCES = [
  {
    name: 'free-scanned',
    listId: LISTS.FREE_SCANNED,
    dateAttrib: 'scan_completed_at',  // count days from this attribute
    steps: [
      { day: 0,  templateId: 13 },   // "Your scan results are ready"
      { day: 2,  templateId: 14 },   // "About your critical findings"
      { day: 5,  templateId: 15 },   // "Your AWS account is probably wasting money"
      { day: 10, templateId: 16, fromEmail: 'Maksim <maksim@scanorbit.cloud>' },
    ],
  },
  // ... more sequences
];
```

### How the scheduler works

1. Runs daily (e.g., 9:00 AM via cron, node-cron, or BullMQ repeatable job).
2. For each sequence, queries all subscribers in that list.
3. For each subscriber, calculates how many days since they entered the sequence (using `dateAttrib` or `created_at`).
4. If a step matches today's day count, checks the `drip_log` table for duplicates.
5. If not already sent, calls `POST /api/tx` with the template ID and subscriber data.
6. Records the send in `drip_log`.

### Database table for duplicate prevention

```sql
CREATE TABLE drip_log (
  id                SERIAL PRIMARY KEY,
  subscriber_email  TEXT NOT NULL,
  sequence_name     TEXT NOT NULL,
  email_day         INTEGER NOT NULL,
  sent_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(subscriber_email, sequence_name, email_day)
);
```

The unique constraint ensures the same email is never sent twice to the same subscriber.

### Day-0 emails (immediate sends)

Day-0 emails should be sent immediately from your event handler, not from the daily cron. Create a `sendImmediate()` function that looks up the day-0 step for a sequence and sends it right away.

Example: when a scan completes, your scan-complete handler calls `sendImmediate({ sequenceName: 'free-scanned', email, name, data: scanResults })`. The user gets their results email within seconds, not the next morning.

### Cron setup options

**BullMQ** (recommended if you already use Redis):

```typescript
const queue = new Queue('drip', { connection: redis });
await queue.add('run', {}, { repeat: { pattern: '0 8 * * *' } });
new Worker('drip', async () => runDripScheduler(), { connection: redis });
```

**node-cron** (simple, in-process):

```typescript
import cron from 'node-cron';
cron.schedule('0 8 * * *', () => runDripScheduler());
```

**System cron** (standalone):

```bash
0 8 * * * cd /app && node dist/drip-scheduler.js >> /var/log/drip.log 2>&1
```

### Stop conditions

When a subscriber moves to a new list (e.g., trial starts), they leave the old list. The drip scheduler only queries subscribers in the current list, so they automatically stop getting emails from the old sequence. No explicit stop logic needed.

---

## 11. Bounce Handling

### What bounces are

A **hard bounce** means the email address doesn't exist (permanent). A **soft bounce** means temporary failure (mailbox full, server down). If you keep sending to hard-bounced addresses, email providers flag you as a spammer and your deliverability drops for everyone.

### Listmonk bounce configuration

Go to **Settings → Bounces**:

- **Enable bounce processing**: Yes
- **Hard bounce action**: Blocklist subscriber (after 1–2 bounces)
- **Soft bounce action**: Send a warning (after 3–5 bounces)

Blocklisted subscribers won't receive any emails. Your drip scheduler skips them automatically.

### Getting bounce data into Listmonk

There are three approaches depending on your SMTP provider:

**Option A: SMTP provider webhook → your backend → Listmonk** (recommended)

Your SMTP provider sends a webhook when an email bounces. Your backend receives it and forwards to Listmonk's bounce endpoint:

```
POST /webhooks/bounce
{
  "email": "bounced@example.com",
  "source": "api",
  "type": "hard",
  "meta": "{\"provider\": \"scaleway\", \"reason\": \"mailbox not found\"}"
}
```

**Option B: POP3 mailbox polling**

Configure a bounce mailbox (e.g., `bounces@yourdomain.com`) and set it in Listmonk's bounce settings. Listmonk polls the mailbox periodically and processes bounce emails using heuristic keyword matching.

**Option C: Provider's built-in blocklist**

Some providers (like Scaleway) automatically blocklist bounced addresses at the SMTP level. This protects your reputation but Listmonk won't know about it — your scheduler will keep making API calls that get silently dropped. Acceptable to start, but add Option A for better analytics.

### ScanOrbit example

ScanOrbit uses Scaleway TEM which has automatic SMTP-level blocklisting (Option C) as the baseline, plus a small webhook bridge endpoint (Option A) that forwards `email_dropped` and `email_mailbox_not_found` events to Listmonk's `/webhooks/bounce` API.

---

## 12. Warm-Up Strategy

If your domain is new or hasn't sent marketing emails before, you need to gradually increase volume. Sending 1,000 emails on day one from a cold domain will get you flagged as spam.

### Week 1–2: Product emails only

- Enable only product-triggered sequences: free-new, free-scanned, trial, paid welcome emails.
- These go to people who just interacted with your product — highest engagement, lowest spam risk.
- Target: 20–50 emails/day.

### Week 3–4: Add subscriber sequence

- Enable the subscriber nurture sequence (educational emails to opted-in subscribers).
- Target: 50–100 emails/day.

### Week 5+: Add cold outreach

- Enable cold-leads sequence only after 3–4 weeks of clean sending.
- Start with small batches (10–20/day), scale based on bounce and complaint rates.

### Metrics to watch

| Metric | Healthy | Warning | Action |
|--------|---------|---------|--------|
| Bounce rate | < 2% | 2–5% | Clean your list, check for typos |
| Spam complaint rate | < 0.1% | 0.1–0.3% | Review content, check targeting |
| Open rate | 20–40% | < 15% | Improve subject lines, check spam folder |
| Click rate | 2–5% | < 1% | Improve CTA, check link placement |

If bounce rate exceeds 5% or complaint rate exceeds 0.3%, **stop sending immediately** and clean your list before resuming.

---

## 13. Manual Campaigns — Newsletters

For monthly product updates, blog digests, and one-off announcements, use Listmonk's campaign system directly. No code needed.

### Creating a newsletter

1. **Campaigns → + Create New**
2. **Name**: internal label (e.g., "March 2026 Newsletter")
3. **Subject**: the email subject line
4. **From**: sender email and name
5. **Lists**: select which lists to send to (e.g., `subscribers`, `paid-pro`, `paid-team`)
6. **Template**: select your Newsletter campaign template
7. **Content**: write in the WYSIWYG editor or switch to HTML mode
8. **Preview** → review → **Send test** to yourself
9. **Schedule** for a specific date/time, or **Start** to send immediately

### Best practices for newsletters

- Send monthly or bi-monthly to paying customers. Don't spam them.
- Send weekly or bi-weekly to subscribers (they opted in for content).
- Never send newsletters to cold-leads (they didn't ask for it).
- Include a mix: product updates, tips/tutorials, industry news.
- End every newsletter with a CTA appropriate to the audience (free users → trial, paid users → feature discovery or upsell).

---

## 14. Monitoring and Analytics

### Listmonk dashboard

Listmonk's built-in dashboard shows:

- **Campaign stats**: open rate, click rate, bounce rate per campaign
- **Subscriber stats**: total count, growth over time, list distribution
- **Link clicks**: which CTAs people click in each campaign

### What to track in your own database

Listmonk tracks email-level metrics. For funnel-level metrics, track these in your product database:

| Metric | How to calculate |
|--------|-----------------|
| Free → activated conversion rate | Users who completed key action / total signups |
| Activated → trial conversion rate | Users who started trial / activated users |
| Trial → paid conversion rate | Users who paid / trial starters |
| Time to activation | Average days from signup to key action |
| Email-influenced conversions | Users who clicked a drip email CTA before converting |

### Health checks

Set up a simple health check for the email system:

- Is Listmonk responding? (`GET /api/health`)
- Is the drip scheduler running? (Check last `drip_log` entry is < 25 hours old)
- Are bounces being processed? (Check Listmonk bounce count is not growing rapidly)

---

## 15. Troubleshooting

### Emails not arriving

1. **Check Listmonk logs** for SMTP errors.
2. **Check spam folder** — first emails from a new domain often land in spam.
3. **Verify SPF/DKIM/DMARC** with MXToolbox.
4. **Send a test** via Listmonk UI → Settings → SMTP → Send test email.
5. **Check Scaleway** (or your SMTP provider) dashboard for delivery status.

### Drip emails not sending

1. **Is the subscriber in the right list?** Check in Listmonk UI → Subscribers → search by email.
2. **Is the subscriber status "enabled"?** Blocklisted or disabled subscribers won't receive email.
3. **Is the template ID correct?** Check `drip-config.ts` against actual Listmonk template IDs.
4. **Check drip_log** — if there's already an entry, the email was already sent (or attempted).
5. **Run scheduler manually** and check output: `npx ts-node drip-scheduler.ts`

### Subscriber not moving between lists

1. **Is the lifecycle hook being called?** Add logging to confirm the event fires.
2. **Is the Listmonk API reachable?** Check LISTMONK_URL, LISTMONK_USER, LISTMONK_TOKEN.
3. **Check Listmonk subscriber detail** — click the subscriber and check their list memberships.

### Template variables showing raw `{{ .Tx.Data.xxx }}`

1. **Are you sending via transactional API?** Variables only work in `POST /api/tx` sends, not in regular campaigns.
2. **Is the data object populated?** Check what your backend passes in the `data` field.
3. **Syntax correct?** Must be `{{ .Tx.Data.key }}` — case-sensitive, exact key name.

### High bounce rate

1. **Check your subscriber sources** — purchased lists or scraped emails will have high bounce rates.
2. **Validate emails on signup** — require email verification before adding to lists.
3. **Remove old addresses** — if importing existing users, validate the list first with an email verification service.

---

## 16. File Reference

### Listmonk configuration

| File/Item | Purpose |
|-----------|---------|
| 8 lists | Subscriber segments (created in Listmonk UI or via API) |
| 2–3 campaign templates | HTML wrappers for manual newsletters |
| N transactional templates | Complete drip emails (one per email in all sequences) |
| Bounce settings | Auto-blocklist on hard bounce |
| SMTP settings | SMTP provider credentials |

### Backend code

| File | Lines | Purpose |
|------|-------|---------|
| `listmonk-client.ts` | ~100 | Typed HTTP client for Listmonk API |
| `subscriber-lifecycle.ts` | ~150 | Maps product events → list transitions |
| `drip-config.ts` | ~50 | Sequence definitions: (list, day) → template ID |
| `drip-scheduler.ts` | ~80 | Daily cron that sends drip emails |

### Database

| Table | Purpose |
|-------|---------|
| `drip_log` | Tracks which emails were sent to prevent duplicates |

### Environment variables

| Variable | Example |
|----------|---------|
| `LISTMONK_URL` | `http://listmonk:9000` |
| `LISTMONK_USER` | `api_user` |
| `LISTMONK_TOKEN` | `your-token` |

---

## Quick Start Checklist

- [ ] Install Listmonk (Docker Compose)
- [ ] Configure SMTP
- [ ] Verify SPF / DKIM / DMARC
- [ ] Create lists (API or UI)
- [ ] Create campaign templates (2–3 wrappers)
- [ ] Create transactional templates (all drip emails)
- [ ] Note all list IDs and template IDs
- [ ] Fill IDs into `listmonk-client.ts` and `drip-config.ts`
- [ ] Run SQL migration (`drip_log` table)
- [ ] Add lifecycle hooks to your backend (one call per event)
- [ ] Set up cron for drip scheduler
- [ ] Configure bounce handling
- [ ] Send test emails for every template
- [ ] Test full lifecycle: signup → action → trial → payment
- [ ] Start with product emails only (warm-up)
- [ ] Add newsletter / subscriber sequences after 2 weeks
- [ ] Add cold outreach after 4 weeks
- [ ] Monitor bounce rate (< 2%) and complaint rate (< 0.1%)
