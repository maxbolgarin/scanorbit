# Listmonk Setup

Listmonk handles all outbound email for ScanOrbit: newsletter subscriptions, drip campaigns, and transactional emails (welcome, trial, payment, etc.). It runs as a self-hosted service alongside the API.

Related code:
- `apps/api/src/services/listmonkService.ts` — API client, subscriber lifecycle methods
- `apps/api/src/services/dripSchedulerService.ts` — daily drip scheduler + `sendImmediate`
- `apps/api/src/services/listmonkCronService.ts` — background list transitions (first scan, trial-active detection)
- `apps/api/src/services/dripConfig.ts` — sequence definitions

---

## How it fits into the stack

Deployment order (managed by docker-compose):

```
postgres → init-db → listmonk-init → listmonk → listmonk-setup → api
```

| Service | What it does |
|---|---|
| `listmonk-init` | Installs DB schema (`--install --idempotent`). Runs once. |
| `listmonk` | Main Listmonk process. UI + API on `127.0.0.1:9000`. |
| `listmonk-setup` | Runs `setup_listmonk.ts` to create lists and templates. Runs once after `listmonk` is healthy. |

All settings (SMTP, users, roles) are stored in the Listmonk database — there is no config file. The service starts with `./listmonk --config ""`.

**Accessing the admin UI:** Listmonk binds to `127.0.0.1:9000` (localhost only). Use an SSH tunnel:
```sh
ssh -L 9000:localhost:9000 user@your-server
```
Then open `http://localhost:9000`.

---

## First-time setup checklist

After the first `docker compose up`:

- [ ] **1. Verify listmonk-setup ran** — check logs: `docker compose logs listmonk-setup`. Should end with env var output and exit 0.
- [ ] **2. Configure SMTP** — see [SMTP configuration](#smtp-configuration) below.
- [ ] **3. Create API user** — see [API user & roles](#api-user--roles) below.
- [ ] **4. Update env vars** — set `LISTMONK_ADMIN_USER` and `LISTMONK_ADMIN_PASSWORD` to the API user credentials.
- [ ] **5. Restart the API** — `docker compose restart api` so it picks up the new credentials.
- [ ] **6. Verify** — subscribe a test email via `POST /newsletter/subscribe` and check logs for `[Listmonk] Subscribed` and `[Listmonk] TX →`.

---

## SMTP configuration

SMTP is configured **manually via the Listmonk admin UI** — it is stored in the database and cannot be set via environment variables or config files.

**Admin UI → Settings → SMTP**

For Scaleway TEM:

| Field | Value |
|---|---|
| Host | `smtp.tem.scw.cloud` |
| Port | `587` |
| Auth | `LOGIN` |
| Username | Your Scaleway TEM SMTP username |
| Password | Your Scaleway TEM SMTP password |
| TLS | STARTTLS |
| From email | `ScanOrbit <noreply@scanorbit.cloud>` |
| Max conns | `10` |

After saving, use the **Test** button to verify delivery.

> SMTP settings survive restarts and re-deployments because they live in the Listmonk database (PostgreSQL), not in any mounted config file.

---

## API user & roles

Listmonk's default `admin` user is a superuser — don't use it for API calls. Create a dedicated API user with only the permissions the API service needs.

**Admin UI → Users → Create user → Role: (create new role)**

Required permissions for the API user role:

| Permission | Required for |
|---|---|
| `subscribers:get_all` | Looking up subscribers, drip scheduler queries |
| `subscribers:manage` | Creating, updating, deleting subscribers |
| `subscribers:sql_query` | Email lookup via `?query=subscribers.email='...'` |
| `lists:get_all` | Reading list metadata |
| `lists:manage_all` | Adding/removing subscribers from lists |
| `tx:send` | Sending transactional emails |

> **`subscribers:sql_query` note:** This permission allows arbitrary read-only SQL on the Listmonk database. It is required because Listmonk has no dedicated "get subscriber by email" endpoint. If you want to harden this, create a restricted Postgres role and set it as `app_db_role` in Listmonk settings — that way SQL queries run under a least-privilege DB user.

After creating the user, update your `.env.prod`:
```
LISTMONK_ADMIN_USER=<api-username>
LISTMONK_ADMIN_PASSWORD=<api-password>
```
Then restart: `docker compose restart api`.

---

## Running the setup script manually

The `listmonk-setup` Docker service runs `setup_listmonk.ts` automatically on deploy. To run it manually (e.g., after editing templates):

```sh
LISTMONK_URL=http://localhost:9000 \
LISTMONK_USER=admin \
LISTMONK_TOKEN=<password> \
npx tsx apps/listmonk-setup/setup_listmonk.ts
```

Or via Docker (from the project root):
```sh
docker compose run --rm listmonk-setup
```

**What it does:**
1. Fetches existing lists and templates from Listmonk
2. Upserts all 8 lists (creates if missing, updates if name matches)
3. Upserts all 24 templates from HTML files in `templates/`
4. Prints env var assignments to stdout — paste these into `.env.prod`
5. Saves IDs to `listmonk-ids.json`

**Idempotent** — safe to re-run at any time. Existing lists and templates are updated in-place; nothing is duplicated.

After running manually, paste the printed env vars into `.env.prod` and restart the API if IDs changed.

---

## Lists

8 lists model the customer lifecycle. Users move through them automatically via API events.

| List name | Type | Opt-in | Who lands here |
|---|---|---|---|
| `cold-leads` | Private | Single | Manually imported prospects |
| `subscribers` | Public | Double | Opted in via website/landing page; also churned users |
| `free-new` | Private | Single | Just signed up, haven't scanned yet |
| `free-scanned` | Private | Single | Completed their first scan |
| `trial-new` | Private | Single | Started trial, low activity |
| `trial-active` | Private | Single | Trial users with 2+ completed scans |
| `paid-pro` | Private | Single | Active Pro subscribers |
| `paid-team` | Private | Single | Active Team subscribers |

---

## Subscriber lifecycle

Users flow between lists based on application events:

```
[cold-leads]          ← manual import
      |
      ↓  (signup)
  [free-new]          ← onUserSignup()
      |
      ↓  (first scan completed)
[free-scanned]        ← onFirstScanComplete() / cron
      |
      ↓  (starts trial via Stripe)
  [trial-new]         ← onTrialStart()
      |
      ↓  (2+ scans completed)
[trial-active]        ← onTrialActive() / cron
      |
      ↓  (payment confirmed)
  [paid-pro]          ← onPayment('pro')
  [paid-team]         ← onPayment('team')
      |
      ↓  (subscription canceled / deleted)
 [subscribers]        ← onChurn()
```

Newsletter subscribers from the landing page go directly to `[subscribers]` via `listmonkService.subscribe()`.

Plan changes (`onPlanChange`) move users between `paid-pro` ↔ `paid-team`. Unsubscribe/GDPR deletion uses `unsubscribe()` (blocklist) or `deleteSubscriber()`.

---

## Drip sequences

The drip scheduler (`dripSchedulerService.ts`) runs daily at **9 AM CET** and sends emails based on how many days have passed since a subscriber joined a list (or since a custom date attribute).

| Sequence | List | Day calc | Steps |
|---|---|---|---|
| `cold-leads` | cold-leads | `created_at` | Day 0, 4, 10 |
| `subscribers` | subscribers | `created_at` | Day 0, 3, 7, 11, 16, 21 |
| `free-new` | free-new | `created_at` | Day 0, 2, 5 |
| `free-scanned` | free-scanned | `scan_completed_at` attrib | Day 0, 2, 5, 10 |
| `trial-new` | trial-new | `created_at` | Day 0, 3 |
| `trial-active` | trial-active | `trial_started_at` attrib | Day 3, 5, 6, 9 |
| `paid-pro` | paid-pro | `created_at` | Day 0 |
| `paid-team` | paid-team | `created_at` | Day 0 |

Day-0 emails are also sent **immediately** on the triggering event (signup, scan complete, trial start, payment) via `sendImmediate()` — no need to wait until 9 AM.

Emails marked as sent in the `drip_log` table are never resent, even if the scheduler re-processes the subscriber.

Some emails override the sender address (e.g., cold-leads and trial winback emails come from `Maksim <maksim@scanorbit.cloud>`).

---

## Templates

24 transactional email templates, one per drip step. Edit content in **Listmonk UI → Campaigns → Templates**.

| # | File | Template name | Env var |
|---|---|---|---|
| 01 | `01-cold-day0-pain.html` | `cold-day0-pain` | `LISTMONK_TEMPLATE_COLD_DAY0_PAIN` |
| 02 | `02-cold-day4-gdpr.html` | `cold-day4-gdpr` | `LISTMONK_TEMPLATE_COLD_DAY4_GDPR` |
| 03 | `03-cold-day10-breakup.html` | `cold-day10-breakup` | `LISTMONK_TEMPLATE_COLD_DAY10_BREAKUP` |
| 04 | `04-subs-day0-welcome.html` | `subs-day0-welcome` | `LISTMONK_TEMPLATE_SUBS_DAY0_WELCOME` |
| 05 | `05-subs-day3-security.html` | `subs-day3-security` | `LISTMONK_TEMPLATE_SUBS_DAY3_SECURITY` |
| 06 | `06-subs-day7-cost.html` | `subs-day7-cost` | `LISTMONK_TEMPLATE_SUBS_DAY7_COST` |
| 07 | `07-subs-day11-gdpr.html` | `subs-day11-gdpr` | `LISTMONK_TEMPLATE_SUBS_DAY11_GDPR` |
| 08 | `08-subs-day16-social-proof.html` | `subs-day16-social-proof` | `LISTMONK_TEMPLATE_SUBS_DAY16_SOCIAL_PROOF` |
| 09 | `09-subs-day21-final-cta.html` | `subs-day21-final-cta` | `LISTMONK_TEMPLATE_SUBS_DAY21_FINAL_CTA` |
| 10 | `10-free-new-day0-welcome.html` | `free-new-day0-welcome` | `LISTMONK_TEMPLATE_FREE_NEW_DAY0_WELCOME` |
| 11 | `11-free-new-day2-security.html` | `free-new-day2-security` | `LISTMONK_TEMPLATE_FREE_NEW_DAY2_SECURITY` |
| 12 | `12-free-new-day5-value.html` | `free-new-day5-value` | `LISTMONK_TEMPLATE_FREE_NEW_DAY5_VALUE` |
| 13 | `13-free-scanned-day0-results.html` | `free-scanned-day0-results` | `LISTMONK_TEMPLATE_FREE_SCANNED_DAY0_RESULTS` |
| 14 | `14-free-scanned-day2-critical.html` | `free-scanned-day2-critical` | `LISTMONK_TEMPLATE_FREE_SCANNED_DAY2_CRITICAL` |
| 15 | `15-free-scanned-day5-cost.html` | `free-scanned-day5-cost` | `LISTMONK_TEMPLATE_FREE_SCANNED_DAY5_COST` |
| 16 | `16-free-scanned-day10-breakup.html` | `free-scanned-day10-breakup` | `LISTMONK_TEMPLATE_FREE_SCANNED_DAY10_BREAKUP` |
| 17 | `17-trial-new-day0-welcome.html` | `trial-new-day0-welcome` | `LISTMONK_TEMPLATE_TRIAL_NEW_DAY0_WELCOME` |
| 18 | `18-trial-new-day3-stuck.html` | `trial-new-day3-stuck` | `LISTMONK_TEMPLATE_TRIAL_NEW_DAY3_STUCK` |
| 19 | `19-trial-active-day3-deepen.html` | `trial-active-day3-deepen` | `LISTMONK_TEMPLATE_TRIAL_ACTIVE_DAY3_DEEPEN` |
| 20 | `20-trial-active-day5-warning.html` | `trial-active-day5-warning` | `LISTMONK_TEMPLATE_TRIAL_ACTIVE_DAY5_WARNING` |
| 21 | `21-trial-active-day6-lastday.html` | `trial-active-day6-lastday` | `LISTMONK_TEMPLATE_TRIAL_ACTIVE_DAY6_LASTDAY` |
| 22 | `22-trial-active-day9-winback.html` | `trial-active-day9-winback` | `LISTMONK_TEMPLATE_TRIAL_ACTIVE_DAY9_WINBACK` |
| 23 | `23-paid-pro-day0-welcome.html` | `paid-pro-day0-welcome` | `LISTMONK_TEMPLATE_PAID_PRO_DAY0_WELCOME` |
| 24 | `24-paid-team-day0-welcome.html` | `paid-team-day0-welcome` | `LISTMONK_TEMPLATE_PAID_TEAM_DAY0_WELCOME` |

To edit email content: update the HTML file, re-run the setup script, no API restart needed.

---

## Environment variables reference

All consumed by the API service (`apps/api/src/lib/config.ts`):

| Variable | Default | Description |
|---|---|---|
| `LISTMONK_API_URL` | `http://localhost:9000` | Internal URL to Listmonk |
| `LISTMONK_API_USER` | `admin` | API username |
| `LISTMONK_API_PASSWORD` | _(required)_ | API password |
| `LISTMONK_LIST_COLD_LEADS` | `0` | List ID — cold leads |
| `LISTMONK_LIST_SUBSCRIBERS` | `0` | List ID — newsletter subscribers |
| `LISTMONK_LIST_FREE_NEW` | `0` | List ID — free tier, no scan yet |
| `LISTMONK_LIST_FREE_SCANNED` | `0` | List ID — free tier, scanned |
| `LISTMONK_LIST_TRIAL_NEW` | `0` | List ID — trial, low activity |
| `LISTMONK_LIST_TRIAL_ACTIVE` | `0` | List ID — trial, 2+ scans |
| `LISTMONK_LIST_PAID_PRO` | `0` | List ID — paid Pro |
| `LISTMONK_LIST_PAID_TEAM` | `0` | List ID — paid Team |
| `LISTMONK_TEMPLATE_COLD_DAY0_PAIN` | `0` | Template ID |
| `LISTMONK_TEMPLATE_COLD_DAY4_GDPR` | `0` | Template ID |
| `LISTMONK_TEMPLATE_COLD_DAY10_BREAKUP` | `0` | Template ID |
| `LISTMONK_TEMPLATE_SUBS_DAY0_WELCOME` | `0` | Template ID |
| `LISTMONK_TEMPLATE_SUBS_DAY3_SECURITY` | `0` | Template ID |
| `LISTMONK_TEMPLATE_SUBS_DAY7_COST` | `0` | Template ID |
| `LISTMONK_TEMPLATE_SUBS_DAY11_GDPR` | `0` | Template ID |
| `LISTMONK_TEMPLATE_SUBS_DAY16_SOCIAL_PROOF` | `0` | Template ID |
| `LISTMONK_TEMPLATE_SUBS_DAY21_FINAL_CTA` | `0` | Template ID |
| `LISTMONK_TEMPLATE_FREE_NEW_DAY0_WELCOME` | `0` | Template ID |
| `LISTMONK_TEMPLATE_FREE_NEW_DAY2_SECURITY` | `0` | Template ID |
| `LISTMONK_TEMPLATE_FREE_NEW_DAY5_VALUE` | `0` | Template ID |
| `LISTMONK_TEMPLATE_FREE_SCANNED_DAY0_RESULTS` | `0` | Template ID |
| `LISTMONK_TEMPLATE_FREE_SCANNED_DAY2_CRITICAL` | `0` | Template ID |
| `LISTMONK_TEMPLATE_FREE_SCANNED_DAY5_COST` | `0` | Template ID |
| `LISTMONK_TEMPLATE_FREE_SCANNED_DAY10_BREAKUP` | `0` | Template ID |
| `LISTMONK_TEMPLATE_TRIAL_NEW_DAY0_WELCOME` | `0` | Template ID |
| `LISTMONK_TEMPLATE_TRIAL_NEW_DAY3_STUCK` | `0` | Template ID |
| `LISTMONK_TEMPLATE_TRIAL_ACTIVE_DAY3_DEEPEN` | `0` | Template ID |
| `LISTMONK_TEMPLATE_TRIAL_ACTIVE_DAY5_WARNING` | `0` | Template ID |
| `LISTMONK_TEMPLATE_TRIAL_ACTIVE_DAY6_LASTDAY` | `0` | Template ID |
| `LISTMONK_TEMPLATE_TRIAL_ACTIVE_DAY9_WINBACK` | `0` | Template ID |
| `LISTMONK_TEMPLATE_PAID_PRO_DAY0_WELCOME` | `0` | Template ID |
| `LISTMONK_TEMPLATE_PAID_TEAM_DAY0_WELCOME` | `0` | Template ID |

> **ID = 0 means "not configured"** — the API silently skips any operation involving a list or template with ID 0. No errors are thrown; check logs for missing operations.

The setup script also reads:

| Variable | Used by | Description |
|---|---|---|
| `LISTMONK_URL` | `setup_listmonk.ts` | Listmonk base URL |
| `LISTMONK_USER` | `setup_listmonk.ts` | Admin username for setup |
| `LISTMONK_TOKEN` | `setup_listmonk.ts` | Admin password for setup |
| `NEWSLETTER_UNSUBSCRIBE_SECRET` | API | HMAC secret for unsubscribe link tokens |

---

## Troubleshooting

**`403 Permission denied: subscribers:sql_query`**
The API user is missing the `subscribers:sql_query` role. This breaks all subscriber lookups — returning users cannot be re-subscribed or moved between lists. Fix: Admin UI → Users → API user → Role → add `subscribers:sql_query`.

**Subscriber created but not in any list**
`LISTMONK_LIST_SUBSCRIBERS` (or the relevant list env var) is `0`. Run the setup script, paste the output into `.env.prod`, and restart the API.

**No welcome email after subscribe**
Either `LISTMONK_TEMPLATE_SUBS_DAY0_WELCOME` is `0` (template not configured — run setup script), or SMTP is not configured in the Listmonk UI, or `wasSent` dedup already marked it as sent (check `drip_log` table).

**Drip emails not sending**
Check logs at 9 AM CET for `[Drip] Scheduler starting`. If missing: either Listmonk is not configured (`LISTMONK_API_PASSWORD` empty) or the scheduler isn't running. If present but no emails: check that list IDs and template IDs are non-zero, and that SMTP is configured.

**listmonk-setup exited with error**
Usually means Listmonk wasn't healthy yet, or wrong credentials. Re-run: `docker compose run --rm listmonk-setup`. Check that `LISTMONK_ADMIN_USER`/`LISTMONK_ADMIN_PASSWORD` match the actual Listmonk admin credentials (not the API user — setup runs as admin).

**IDs changed after re-running setup**
If the setup script creates new lists/templates instead of updating existing ones (e.g., after a DB reset), the IDs in `.env.prod` will be stale. Always paste the fresh output from the setup script into `.env.prod` and restart the API.
