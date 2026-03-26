# Data Breach Notification Procedure

**Controller:** Maria Elina (trading as ScanOrbit)
**Contact:** security@scanorbit.cloud
**Supervisory Authority:** Autoriteit Persoonsgegevens (AP)
**Last updated:** 2026-03-26

---

## 1. What Constitutes a Personal Data Breach

A personal data breach is a breach of security leading to the accidental or unlawful destruction, loss, alteration, unauthorized disclosure of, or access to, personal data (GDPR Article 4(12)).

**Examples relevant to ScanOrbit:**
- Unauthorized access to the database containing user accounts
- Exposure of email addresses, names, or OAuth tokens
- Unauthorized access to AWS scan results or security findings
- Loss or corruption of user data without backup recovery
- Accidental disclosure of user data to wrong organization member
- Compromise of encryption keys (JWT, TOTP, OAuth, backup)
- Unauthorized access to audit logs containing IP addresses

**Not a personal data breach (but still a security incident):**
- DDoS attack with no data access
- Failed login attempts (blocked by rate limiting)
- Vulnerability discovered but not exploited
- Infrastructure downtime without data compromise

---

## 2. Detection Sources

| Source | What to Monitor |
|--------|----------------|
| Alertmanager (Slack/Telegram) | Service health, database issues, backup failures |
| Grafana dashboards | Unusual traffic patterns, error rate spikes |
| Audit logs | Unexpected admin actions, bulk data access |
| Application logs | Authentication anomalies, repeated failures |
| Email (Resend webhooks) | Unusual bounce/complaint patterns |
| Stripe webhooks | Unauthorized billing changes |
| User reports | Users reporting unauthorized access or data exposure |
| AWS CloudTrail | Unexpected API calls from ScanOrbit's role |
| Dependency alerts | npm audit, GitHub security advisories |

---

## 3. Response Timeline

```
Hour 0     — Breach detected or reported
             ↓
Hour 0-1   — STEP 1: Contain (stop the bleeding)
             ↓
Hour 1-4   — STEP 2: Assess scope and severity
             ↓
Hour 4-24  — STEP 3: Document findings
             ↓
Hour 24-48 — STEP 4: Notify customers (if B2B processor role, per DPA)
             ↓
Hour 48-72 — STEP 5: Notify AP (if required)
             ↓
Hour 72+   — STEP 6: Notify affected individuals (if high risk)
             ↓
Week 1-2   — STEP 7: Post-incident review
```

---

## 4. Step-by-Step Procedure

### Step 1: Contain (Hour 0-1)

**Goal:** Stop ongoing unauthorized access or data loss.

Actions depending on breach type:

| Breach Type | Containment Action |
|-------------|-------------------|
| Unauthorized database access | Rotate all database passwords; revoke suspicious connections |
| Compromised JWT/refresh secrets | Rotate JWT_SECRET and JWT_REFRESH_SECRET; all users forced to re-login |
| Compromised OAuth encryption key | Rotate OAUTH_ENCRYPTION_KEY; re-encrypt all OAuth tokens |
| Compromised TOTP encryption key | Rotate TOTP_ENCRYPTION_KEY; re-encrypt all TOTP secrets; notify affected users to re-enroll 2FA |
| Compromised backup encryption key | Rotate BACKUP_ENCRYPTION_KEY; destroy exposed backup copies |
| Application vulnerability exploited | Deploy patch or disable affected endpoint; review recent access logs |
| Unauthorized admin access | Disable compromised account; rotate all secrets; review audit logs |

**Critical commands:**
```bash
# Force all users to re-authenticate (invalidate all refresh tokens)
# In Redis:
redis-cli --tls ... KEYS "refresh_token:*" | xargs redis-cli --tls ... DEL

# Rotate secrets (regenerate via bootstrap script)
sudo ./deploy/scripts/bootstrap.sh --secrets secrets.env

# Restart services after secret rotation
cd deploy && make restart
```

### Step 2: Assess Scope and Severity (Hour 1-4)

Determine:

1. **What data was affected?**
   - [ ] Email addresses
   - [ ] Full names
   - [ ] Password hashes (bcrypt — low risk even if exposed)
   - [ ] OAuth tokens (AES-256-GCM encrypted — assess if key was compromised)
   - [ ] TOTP secrets (AES-256-GCM encrypted)
   - [ ] IP addresses (from audit/consent logs)
   - [ ] AWS account IDs / IAM Role ARNs
   - [ ] AWS resource metadata / scan results
   - [ ] Billing information (Stripe IDs — actual payment data is at Stripe)
   - [ ] Consent records

2. **How many data subjects affected?**
   ```sql
   -- Count users in database
   SELECT COUNT(*) FROM users;
   -- Count users with OAuth accounts
   SELECT COUNT(DISTINCT user_id) FROM user_oauth_accounts;
   -- Count organizations
   SELECT COUNT(*) FROM orgs;
   ```

3. **Is the breach ongoing or contained?**

4. **What was the cause?** (vulnerability, misconfiguration, credential compromise, insider, etc.)

5. **Risk to individuals' rights and freedoms:**
   - **Low risk:** Only pseudonymous IDs or hashed data exposed
   - **Risk present:** Email addresses + names exposed
   - **High risk:** OAuth tokens (if encryption key also compromised), AWS access data, or combination enabling identity theft or infrastructure compromise

### Step 3: Document (Hour 4-24)

Create a breach record with:

```
Breach ID:           [YYYY-MM-DD-NNN]
Detection time:      [timestamp]
Detection source:    [how it was found]
Breach description:  [what happened]
Data categories:     [what data was affected]
Data subjects:       [approximate number and categories]
Cause:               [root cause]
Containment:         [actions taken]
Risk assessment:     [low / risk present / high risk]
Notification needed: [AP: yes/no] [Individuals: yes/no] [Customers/DPA: yes/no]
```

**Keep this record permanently** — GDPR Article 33(5) requires documenting all breaches regardless of notification obligation.

### Step 4: Notify Customers — DPA Obligation (Hour 24-48)

Per the DPA (Section 9), notify customers within **48 hours** of becoming aware.

**Email to affected organization owners:**
```
Subject: ScanOrbit Security Incident Notification

We are writing to inform you of a security incident affecting your
ScanOrbit account.

What happened: [brief description]
When: [date/time of breach and detection]
Data affected: [categories of data]
What we've done: [containment and remediation actions]
What you should do: [recommended actions]

As your data processor under our DPA, we are providing this notification
within 48 hours as required. This information is intended to help you
assess your own notification obligations under GDPR Article 33.

Contact: security@scanorbit.cloud
```

### Step 5: Notify Autoriteit Persoonsgegevens (Hour 48-72)

**When required:** If the breach is likely to result in a risk to the rights and freedoms of natural persons (GDPR Article 33(1)). Only a breach with **no risk** is exempt from notification.

**How to notify:**
- Online: https://autoriteitpersoonsgegevens.nl/meldplicht-datalekken
- Phone: +31 70 888 8500
- Within **72 hours** of becoming aware

**Notification must include (Article 33(3)):**
1. Nature of the breach (categories and approximate number of data subjects and records)
2. Name and contact details of the DPA contact (dpa@scanorbit.cloud)
3. Likely consequences of the breach
4. Measures taken or proposed to address the breach and mitigate effects

**If all information is not available within 72 hours:** Submit what you have and provide the rest in phases (Article 33(4)).

### Step 6: Notify Affected Individuals (If High Risk)

**When required:** If the breach is likely to result in a **high risk** to the rights and freedoms of natural persons (GDPR Article 34(1)).

**Exceptions (Article 34(3)):**
- Data was encrypted and the key was not compromised
- Subsequent measures ensure high risk is no longer likely
- It would involve disproportionate effort (use public communication instead)

**Email to affected users:**
```
Subject: Important Security Notice — Action Required

What happened: [plain language description]
What data was involved: [specific to this user]
What we've done: [remediation actions]
What you should do:
  - Change your password at [link]
  - [Re-enable 2FA if applicable]
  - [Review your AWS CloudTrail for unexpected activity if applicable]
  - Monitor for suspicious emails

Contact: security@scanorbit.cloud
```

### Step 7: Post-Incident Review (Week 1-2)

1. **Root cause analysis** — Why did it happen? What control failed?
2. **Timeline review** — Were response times adequate?
3. **Remediation verification** — Confirm all fixes are in place
4. **Lessons learned** — What process improvements are needed?
5. **Update this procedure** if gaps were identified
6. **Update security policy** if new measures were implemented

---

## 5. Breach Record Log

Maintain a running log of all security incidents and breaches:

| Date | Breach ID | Description | Risk Level | AP Notified | Individuals Notified | Resolution |
|------|-----------|-------------|------------|-------------|---------------------|------------|
| — | — | No breaches recorded to date | — | — | — | — |

---

## 6. Annual Review

This procedure must be reviewed at least annually or after any breach incident.

**Next review date:** 2027-03-26
