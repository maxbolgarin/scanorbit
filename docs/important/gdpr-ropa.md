# Record of Processing Activities (RoPA)

**Controller:** Maria Elina (trading as ScanOrbit)
**KVK:** 99611252 | **BTW-ID:** NL005398711B41
**Address:** Keizersgracht 241, Amsterdam, 1016EA Netherlands
**Contact:** dpa@scanorbit.cloud
**Last updated:** 2026-03-26

> Required under GDPR Article 30. Although not always mandatory for organizations with fewer than 250 employees, ScanOrbit maintains this record because processing is not occasional and includes systematic monitoring of individuals' activity (audit logging, usage tracking).

---

## 1. Account Registration and Authentication

| Field | Value |
|-------|-------|
| **Purpose** | Create and manage user accounts, authenticate users, provide access to the service |
| **Legal basis** | Contract performance — GDPR Article 6(1)(b) |
| **Data categories** | Email address, full name, password hash (bcrypt), OAuth tokens (AES-256-GCM encrypted), OAuth provider profile (minimized), TOTP secret (AES-256-GCM encrypted), recovery codes (bcrypt hashed) |
| **Data subjects** | Registered users |
| **Recipients** | Google (OAuth, optional), GitHub (OAuth, optional) |
| **International transfers** | USA — Google, GitHub (SCCs 2021/914) |
| **Retention** | Until account deletion requested; free tier accounts deleted after 12 months inactivity + 30-day notice |
| **Security measures** | AES-256-GCM encryption for tokens/secrets, bcrypt for passwords, TLS 1.2+ in transit, JWT with 5-min access token / 7-day refresh token |

## 2. AWS Infrastructure Scanning

| Field | Value |
|-------|-------|
| **Purpose** | Scan customer AWS accounts for security misconfigurations, cost optimization, and compliance issues |
| **Legal basis** | Contract performance — GDPR Article 6(1)(b) |
| **Data categories** | AWS Account ID, IAM Role ARN, External ID, resource metadata (names, tags, regions, states, ARNs, estimated costs), security findings, scan timestamps |
| **Data subjects** | Organization members whose AWS accounts are connected |
| **Recipients** | AWS (temporary read-only API calls during scans) |
| **International transfers** | Customer-selected AWS region (may include non-EU regions if customer's AWS resources are in non-EU regions) |
| **Retention** | Resources: Free 7d / Pro 90d / Team 180d after last seen. Findings (resolved): Free 14d / Pro 180d / Team 365d. Scans: Free 30d / Pro 365d / Team 730d |
| **Security measures** | Read-only IAM role, temporary credentials (1-hour expiry), no AWS credentials stored, AES-256 at rest, TLS 1.2+ in transit |

## 3. Billing and Subscription Management

| Field | Value |
|-------|-------|
| **Purpose** | Process payments, manage subscriptions, handle billing events |
| **Legal basis** | Contract performance — GDPR Article 6(1)(b) |
| **Data categories** | Stripe customer ID, subscription ID, subscription tier/status, billing name and address (processed by Stripe directly), trial dates |
| **Data subjects** | Organization owners/admins who manage billing |
| **Recipients** | Stripe Inc. |
| **International transfers** | USA — Stripe (SCCs 2021/914 + Stripe DPA) |
| **Retention** | Until account deletion; Stripe retains billing records per their retention policy |
| **Security measures** | No credit card data stored by ScanOrbit; Stripe handles PCI DSS compliance; TLS 1.2+ for API calls |

## 4. Transactional and Marketing Email

| Field | Value |
|-------|-------|
| **Purpose** | Send verification emails, password resets, scan completion notifications, billing events, and marketing emails (opt-in only) |
| **Legal basis** | Contract performance — Article 6(1)(b) for transactional; Consent — Article 6(1)(a) for marketing |
| **Data categories** | Email address, email content, subscriber status, drip campaign history (sequence name, email day, sent timestamp) |
| **Data subjects** | Registered users; marketing subscribers (opt-in only) |
| **Recipients** | Resend Inc. |
| **International transfers** | USA — Resend (SCCs 2021/914 + Resend DPA) |
| **Retention** | Email subscriber records: until unsubscribe or account deletion. Drip log: same as subscriber records |
| **Security measures** | TLS 1.2+ for API calls, Svix webhook verification |

## 5. Audit Logging

| Field | Value |
|-------|-------|
| **Purpose** | Security monitoring, fraud prevention, regulatory compliance, incident investigation |
| **Legal basis** | Legitimate interest — GDPR Article 6(1)(f). Interest: security and fraud prevention. Balancing test: audit logs contain limited data (action, IP, user agent) necessary for security; users can object under Article 21 |
| **Data categories** | User ID, action type, HTTP method, API path, status code, IP address, user agent, duration, timestamp |
| **Data subjects** | All authenticated users |
| **Recipients** | None (internal only) |
| **International transfers** | None — stored in EU (Amsterdam) |
| **Retention** | 730 days (2 years), then anonymized (user identifiers, IP addresses, user agent strings removed) |
| **Security measures** | Database access restricted to API service account; encrypted at rest; TLS 1.2+ for database connections |

## 6. Consent Tracking

| Field | Value |
|-------|-------|
| **Purpose** | Record and demonstrate valid consent under GDPR Article 7(1) |
| **Legal basis** | Legal obligation — GDPR Article 7(1) (demonstrate consent) |
| **Data categories** | User ID (nullable after deletion), email address, consent type, consent version, consent given (boolean), IP address, user agent, timestamp, metadata |
| **Data subjects** | All users who provide consent (registration, marketing opt-in) |
| **Recipients** | None (internal only) |
| **International transfers** | None — stored in EU (Amsterdam) |
| **Retention** | Up to 3 years after account deletion or consent withdrawal |
| **Security measures** | Database access restricted; encrypted at rest; TLS 1.2+ |

## 7. Website Analytics

| Field | Value |
|-------|-------|
| **Purpose** | Understand website usage patterns to improve the service |
| **Legal basis** | Legitimate interest — GDPR Article 6(1)(f). Interest: service improvement. No personal data collected; no cookies; IP discarded after country-level geolocation |
| **Data categories** | Page URLs, referrer, general browser type, general OS, device category, country (derived from IP, then IP discarded) |
| **Data subjects** | Website visitors (scanorbit.cloud and app.scanorbit.cloud) |
| **Recipients** | None — Umami is self-hosted on EU infrastructure |
| **International transfers** | None |
| **Retention** | Aggregated indefinitely; no individual records |
| **Security measures** | Self-hosted on Scaleway (Amsterdam); no cookies; no personal identifiers |

## 8. Organization Collaboration (Team Tier)

| Field | Value |
|-------|-------|
| **Purpose** | Enable multi-user access to shared AWS account data within organizations |
| **Legal basis** | Contract performance — GDPR Article 6(1)(b) |
| **Data categories** | User name, email, organization name/slug, role (owner/admin/member), title (optional), invitation tokens, join date |
| **Data subjects** | Organization members and invitees |
| **Recipients** | Other organization members (name, email visible within org) |
| **International transfers** | None — stored in EU (Amsterdam) |
| **Retention** | Until user leaves organization or account is deleted |
| **Security measures** | RBAC enforcement; invitation tokens with expiry; encrypted at rest |

## 9. Data Deletion Requests

| Field | Value |
|-------|-------|
| **Purpose** | Process GDPR Article 17 erasure requests with audit trail |
| **Legal basis** | Legal obligation — GDPR Article 17 |
| **Data categories** | User ID (nullable after completion), email, request type, status, reason, IP address, user agent, timestamps, processor notes |
| **Data subjects** | Users requesting data deletion |
| **Recipients** | None (internal only) |
| **International transfers** | None |
| **Retention** | Request records retained for 3 years after completion for compliance documentation |
| **Security measures** | 30-day grace period (cancellable); cascading deletion across all data stores; backup purge within 30 days |

---

## Sub-processors

| Sub-processor | Purpose | Data Processed | Location | Transfer Mechanism |
|---------------|---------|----------------|----------|--------------------|
| Scaleway | Infrastructure hosting | All application data | EU (Amsterdam) | N/A (EU) |
| AWS | Customer infrastructure scanning | AWS account metadata during scans | Customer-selected region | Standard Terms |
| Stripe | Payment processing | Email, name, billing address, subscription data | USA | SCCs 2021/914 + DPA |
| Resend | Email delivery | Email addresses, email content | USA | SCCs 2021/914 + DPA |
| Google | OAuth authentication (optional) | OAuth tokens, email, profile name | USA | SCCs 2021/914 + DPA |
| GitHub | OAuth authentication (optional) | OAuth tokens, email, profile name | USA | SCCs 2021/914 + DPA |

---

## DPO Assessment

A Data Protection Officer (DPO) is not currently appointed. Assessment under GDPR Article 37:

- **(a) Public authority:** ScanOrbit is not a public authority. **Not applicable.**
- **(b) Core activities requiring regular and systematic monitoring:** ScanOrbit's core activity is scanning AWS infrastructure (machine metadata), not monitoring individuals. Audit logging of user actions is a secondary security measure, not a core activity. **Not triggered.**
- **(c) Large-scale processing of special category data:** ScanOrbit does not process special category data (Article 9) or criminal conviction data (Article 10). **Not triggered.**

**Conclusion:** DPO appointment is not required under GDPR Article 37. This assessment will be reviewed annually or when processing activities materially change (e.g., significant user growth, new data categories, employee access to personal data).

**Next review date:** 2027-03-26
