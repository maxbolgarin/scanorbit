# ScanOrbit — Listmonk Email Templates

## What's Inside

| File | Purpose | Use For |
|------|---------|---------|
| `01-transactional.html` | Minimal, plain-text-style wrapper | Cold emails, onboarding, product notifications, 1:1 style emails |
| `02-newsletter.html` | Branded header/footer, structured layout | Monthly updates, blog digests, educational sequences |
| `03-upgrade-cta.html` | Conversion-focused wrapper | Trial expiry, upgrade nudges, post-scan conversion, win-back |
| `04-components.html` | Copy-paste building blocks | Drop into any campaign body as needed |

## How to Install in Listmonk

1. Go to **Campaigns → Templates** in Listmonk
2. Click **+ New**
3. Name it (e.g., "Transactional")
4. Switch to **HTML** mode
5. Paste the entire contents of the corresponding `.html` file
6. Save
7. Repeat for all three templates

## How Templates + Campaigns Work

Templates are **wrappers**. They contain `{{ template "content" . }}` which is where your campaign body gets injected.

When you create a campaign in Listmonk:
1. Select which template to use (Transactional, Newsletter, or Upgrade)
2. Write your email content in the campaign editor (HTML mode)
3. Copy-paste components from `04-components.html` where needed
4. The template wraps your content with header, footer, styles, and tracking

## Which Template for Which Email

| Campaign Track | Template |
|----------------|----------|
| Cold outreach (3-email sequence) | **Transactional** — feels like a personal email |
| Subscriber nurture (6-email sequence) | **Transactional** — personal tone builds trust |
| Monthly subscriber newsletter | **Newsletter** — branded, structured |
| Free user onboarding | **Transactional** — product/action focused |
| Post-scan upgrade emails | **Upgrade/CTA** — conversion focused |
| Trial welcome + nudges | **Transactional** for welcome, **Upgrade/CTA** for conversion |
| Trial expiring emails | **Upgrade/CTA** — urgency + clear CTA |
| Paid user welcome | **Transactional** — clean, personal |
| Monthly product updates | **Newsletter** — branded, informational |
| Upsell Pro → Team | **Upgrade/CTA** — feature comparison |

## Available Components (04-components.html)

| Component | What It Is | When to Use |
|-----------|------------|-------------|
| **Primary CTA Button** | Large blue button | Main action — one per email, above the fold |
| **Secondary CTA Button** | Outlined button | Supporting action — "Compare Plans", "Learn More" |
| **Arrow Link** | `→ scanorbit.cloud` text link | Cold emails, light nudges — least aggressive CTA |
| **Urgency Banner** | Yellow/amber alert strip | Trial expiry, limited time offers |
| **Info Banner** | Blue info strip | Tips, helpful context, feature highlights |
| **Scan Results Summary** | 3-stat visual block | Post-scan emails, trial conversion emails |
| **Feature List** | Checkmark list | Upgrade emails showing what the user gets |
| **Divider** | Horizontal rule | Between content sections |
| **Section Heading** | Bold heading | Newsletter content sections |
| **Blog Post Card** | Left-bordered link block | Newsletter blog post links |
| **Signoff Block** | "Maksim, Founder" | End of Transactional and Upgrade emails |

## Design Principles Applied

These templates follow current B2B SaaS email best practices:

**Mobile-first**: Single column, 16px body text, 48px button height, touch-friendly spacing.

**Dark mode support**: All templates include `prefers-color-scheme: dark` media queries with tested color inversions. Works in Apple Mail, Outlook (macOS/iOS), Gmail (app).

**Deliverability-optimized**: Low image-to-text ratio (text-only by default), no external image dependencies, clean HTML structure, proper MIME type. Cold and product emails use the Transactional template which looks like a personal email — this avoids spam filters that flag heavy HTML.

**Plain-text feel for B2B**: The Transactional template intentionally looks like a lightly formatted personal email. Research consistently shows plain-text style emails outperform heavy HTML for B2B SaaS outreach and product emails.

**Single CTA per email**: Every email should have ONE primary action. The templates enforce this by having a single prominent button component. Use the arrow link for softer CTAs in cold emails.

**Email client compatibility**: Table-based layout, inline-safe styles, MSO conditionals for Outlook, web-safe font stack (`-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif`).

## Listmonk Variables Reference

Use these in your campaign body:

```
{{ .Subscriber.FirstName }}          → Subscriber's first name
{{ .Subscriber.LastName }}           → Subscriber's last name
{{ .Subscriber.Email }}              → Subscriber's email
{{ .Subscriber.Attribs.KEY }}        → Custom attribute (set via API)

{{ .Tx.Data.KEY }}                   → Transactional API data (for API-sent emails)
```

For dynamic scan data in emails (critical counts, cost savings, etc.), send via the **transactional API** and access with `{{ .Tx.Data.critical_count }}`, `{{ .Tx.Data.high_count }}`, etc.

## Color Reference

| Element | Light | Dark |
|---------|-------|------|
| Background | `#f4f4f5` | `#1a1a1a` |
| Card | `#ffffff` | `#1a1a1a` / `#1e1e1e` |
| Body text | `#27272a` | `#e0e0e0` |
| Muted text | `#71717a` / `#a1a1aa` | `#999999` |
| Primary blue | `#2563eb` | `#2563eb` / `#6db3f2` |
| Critical red | `#dc2626` | — |
| Warning amber | `#f59e0b` | — |
| Header bg (newsletter) | `#0f172a` | `#0f172a` |
