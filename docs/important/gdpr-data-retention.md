# Data Retention Policy

**Controller:** Maria Elina (trading as ScanOrbit)
**Last updated:** 2026-03-26

> This document formalizes the data retention periods implemented in the ScanOrbit codebase. Retention is enforced by automated daily cleanup (`retentionService.ts`) and documented in the public Privacy Policy and DPA.

---

## 1. Retention Schedule

### User Account Data

| Data | Retention Period | Trigger for Deletion | Implementation |
|------|-----------------|---------------------|----------------|
| Account information (email, name, password hash) | Until deletion requested | User requests deletion via settings or email | `gdprService.ts` — 30-day grace period, then permanent deletion |
| OAuth accounts (tokens, profiles) | Until account deletion | Cascading delete with user account | `gdprService.ts` |
| 2FA secrets and recovery codes | Until disabled or account deletion | User disables 2FA or account deleted | `twoFactorService.ts` / `gdprService.ts` |
| Organization membership | Until user leaves org or account deletion | User action or cascading delete | `orgService.ts` / `gdprService.ts` |
| Free tier inactive accounts | 12 months inactivity + 30-day notice | No login or API activity for 12 months | Scheduled cleanup; email notice sent before deletion |

### AWS Scan Data (Tier-Based)

| Data | Free | Pro | Team | After Retention |
|------|------|-----|------|-----------------|
| Stale resources (not seen since last scan) | 7 days | 90 days | 180 days | Permanently deleted |
| Resolved security findings | 14 days | 180 days | 365 days | Permanently deleted |
| Scan records | 30 days | 365 days | 730 days | Permanently deleted |
| Open security findings | Until resolved or account deleted | Same | Same | Resolved → tier retention; Account deleted → immediate |

**Implementation:** `retentionService.ts` — automated daily cleanup at 03:00 UTC

**Environment variables (defaults):**
- `RETENTION_RESOURCES_DAYS` = tier-based
- `RETENTION_FINDINGS_RESOLVED_DAYS` = tier-based
- `RETENTION_SCANS_DAYS` = tier-based

### Compliance and Audit Data

| Data | Retention Period | Justification | After Retention |
|------|-----------------|---------------|-----------------|
| Audit logs | 730 days (2 years) | Security monitoring, incident investigation, regulatory compliance | Anonymized (user ID, IP, user agent removed); aggregated records retained |
| Consent records | Until 3 years after account deletion or consent withdrawal | GDPR Article 7(1) — demonstrate valid consent | Permanently deleted |
| Data deletion request records | 3 years after completion | Compliance documentation — prove deletion was performed | Permanently deleted |

**Environment variable:** `RETENTION_AUDIT_LOGS_DAYS` = 730

### Transient Data (Redis)

| Data | TTL | Purpose |
|------|-----|---------|
| Email verification codes | 5 minutes | Signup verification |
| Signup attempt counters | 15 minutes | Rate limiting |
| Resend cooldown | 60 seconds | Prevent email spam |
| TOTP used codes | ~30 seconds | Replay attack prevention |
| 2FA setup secrets | 10 minutes | Temporary during 2FA enrollment |
| 2FA challenge tokens | 5 minutes | Login 2FA verification |
| 2FA verify attempt counters | 15 minutes | Rate limiting |
| Refresh token entries | 7 days | Token revocation tracking |
| OAuth state parameters | 10 minutes | CSRF protection |

All Redis entries are automatically evicted by TTL. No manual cleanup required.

### Email Marketing Data

| Data | Retention Period | Trigger for Deletion |
|------|-----------------|---------------------|
| Subscriber records | Until unsubscribe or account deletion | User unsubscribes or requests account deletion |
| Drip campaign log | Same as subscriber | Cascading delete with subscriber/account |

### Backups

| Data | Retention Period | Notes |
|------|-----------------|-------|
| Database backups | 30 days rolling | GPG-encrypted (AES-256); older backups automatically replaced |
| Backups containing deleted user data | Purged within 30 days of deletion | Individual records cannot be selectively removed; entire backup set retired on schedule |

---

## 2. Deletion Methods

### Standard Account Deletion (GDPR Article 17)

1. User requests deletion → `POST /api/gdpr/delete`
2. 30-day grace period begins (cancellable by user)
3. After grace period, automated process:
   - Unsubscribe from all email lists (Resend)
   - Revoke all refresh tokens (Redis)
   - Cancel Stripe subscriptions for orphaned organizations
   - Delete from database: user account, OAuth accounts, org memberships, drip email logs
   - Anonymize audit logs (remove user ID, IP, user agent)
   - Consent records retained per retention schedule (up to 3 years)
4. Backups containing deleted data purged within 30 days

### Processing Restriction (GDPR Article 18)

- User sets `processingRestricted = true` via account settings
- System continues storing data but restricts active processing
- User can lift restriction at any time

---

## 3. Automated Enforcement

**Daily cleanup job** (`retention-cleanup.ts`):
- Runs at 03:00 UTC
- Deletes stale resources by `lastSeenAt` timestamp
- Deletes resolved findings by `resolvedAt` timestamp
- Deletes old scan records by `createdAt` timestamp
- Archives old audit logs (anonymization)
- Processes pending deletion requests past 30-day grace period

**Monitoring:**
- Prometheus metrics track cleanup job execution
- Alertmanager notifies on cleanup failures
- Grafana dashboard shows retention compliance status

---

## 4. Legal Bases for Retention

| Retention Category | Legal Basis | GDPR Article |
|--------------------|------------|--------------|
| Active account data | Contract performance | 6(1)(b) |
| Audit logs | Legitimate interest (security) | 6(1)(f) |
| Consent records | Legal obligation (demonstrate consent) | 6(1)(c), 7(1) |
| Deletion request records | Legal obligation (demonstrate compliance) | 6(1)(c), 17 |
| Backup retention (30 days) | Legitimate interest (disaster recovery) | 6(1)(f) |
| Billing records at Stripe | Legal obligation (tax/accounting) | 6(1)(c) |

---

## 5. Annual Review

This policy must be reviewed at least annually to ensure retention periods remain proportionate and legally justified.

**Next review date:** 2027-03-26
