---
title: Security
description: How ScanOrbit protects your data and your AWS infrastructure.
lastUpdated: March 26, 2026
---

ScanOrbit is a one-person operation. This page describes what we actually do to secure your data today — not what we plan to do someday.

---

## How We Access Your AWS Account

ScanOrbit connects to your AWS account through a read-only IAM role that you create and control.

**What this means in practice:**

- You create the role. You set the trust policy. You choose the External ID.
- We call AWS STS AssumeRole to get temporary credentials for each scan. These credentials expire after 1 hour.
- We never store AWS access keys or secret keys.
- We can only call read-only API actions (Describe, List, and selected Get actions required for metadata). We cannot modify, create, or delete anything.
- Every API call we make is logged in your AWS CloudTrail. You can audit our activity at any time.
- You can revoke access instantly by deleting the IAM role.

The recommended IAM policy grants read-only access to EC2, RDS, S3, ELB, ACM, Lambda, CloudWatch, IAM, KMS, and Secrets Manager — metadata and configuration only. We cannot read S3 object contents, database data, or secret values.

---

## Where Your Data Lives

All application data is stored in the EU.

- **Servers and database:** Scaleway, Amsterdam, Netherlands
- **Encrypted backups:** Scaleway Object Storage, Amsterdam, Netherlands

Some third-party services we use (Stripe for payments, Resend for email, Google and GitHub for OAuth) are US-based and process limited data categories under Standard Contractual Clauses. Full details in our [Privacy Policy](/privacy) and [DPA](/dpa).

---

## Encryption

**In transit:** Public traffic uses TLS 1.2 or higher. HTTP is not accepted — all traffic is redirected to HTTPS. Database and Redis connections are encrypted in production.

**At rest:** Sensitive data (OAuth tokens, TOTP secrets) is encrypted with AES-256-GCM. Database connections are encrypted. Backups are GPG-encrypted (AES-256) before storage.

**Passwords:** Hashed with bcrypt (salted, 10 rounds). We never store plaintext passwords.

---

## Authentication

- **Access tokens:** JWT, 5-minute expiry, stored in browser memory only
- **Refresh tokens:** 7-day expiry, HttpOnly secure cookie
- **Two-factor authentication:** TOTP supported (Google Authenticator, Authy). Secrets encrypted with AES-256-GCM. 10 single-use recovery codes, bcrypt hashed.
- **OAuth:** Google and GitHub sign-in supported
- **Account lockout:** Triggered after repeated failed login attempts
- **Password reset:** Secure email token with 1-hour expiry

---

## Application Security

- Parameterized SQL queries (prevents SQL injection)
- Input validation using Zod schemas on all API endpoints
- Rate limiting: baseline API limit of 100 requests/minute per IP, with stricter limits on sensitive auth and verification endpoints
- CORS protection and security headers via Caddy reverse proxy
- HSTS enabled (Strict-Transport-Security)
- Sensitive fields (for example passwords and tokens) are redacted in application logs
- Dependencies monitored for known vulnerabilities via npm audit

---

## Infrastructure

- All services run in Docker containers on a single Scaleway instance
- Internal services communicate over a private Docker network, not exposed to the internet
- Caddy handles TLS termination with automatic certificate renewal via Let's Encrypt
- OS security updates applied promptly

This is a straightforward setup appropriate for the current stage of the product. We don't claim to run a complex multi-region, auto-scaling infrastructure — because we don't.

---

## Monitoring

- Prometheus collects metrics from all services
- Grafana dashboards for operational visibility
- Alertmanager sends alerts to Slack and Telegram for service health issues, database problems, and backup failures
- Structured application logging with request tracing
- Audit logging of all user actions (login, API access, data export, deletion) retained for 2 years

---

## Audit Logging

Every significant action in ScanOrbit is logged:

- User logins (including failed attempts)
- API requests (endpoint, user, timestamp, IP)
- Data exports and deletions
- Account and permission changes
- Scan initiation and completion

Audit logs are retained for 730 days (2 years) and are available to Team tier users through the dashboard.

---

## Data Breach Response

If we discover a data breach:

1. We contain and investigate immediately.
2. We notify the Autoriteit Persoonsgegevens (Dutch Data Protection Authority) within 72 hours if required.
3. We notify affected users without undue delay if the breach poses a high risk to their rights.
4. We document the breach, its effects, and the remedial action taken.

Full details in our [Privacy Policy](/privacy), Section 8.3.

---

## Reporting a Vulnerability

If you discover a security issue, please report it:

**Email:** security@scanorbit.cloud

Include a description of the vulnerability, steps to reproduce, and potential impact. We will acknowledge receipt within 24 hours, investigate, keep you informed, and credit you publicly if you wish.

Please do not publicly disclose the vulnerability until we have had a reasonable opportunity to address it.

---

## What We Don't Have Yet

ScanOrbit is an early-stage product. We are transparent about what is not yet in place:

- No SOC 2 or ISO 27001 certification
- No formal penetration testing completed
- No bug bounty program
- No multi-region redundancy or guaranteed uptime SLA
- No dedicated security team (the business owner handles security directly)

These will be addressed as the product and customer base grow. If your organization requires specific certifications or security assessments before using ScanOrbit, email security@scanorbit.cloud and we'll discuss what we can provide.

---

## Current and Future Scope

ScanOrbit currently supports AWS only. If there is sufficient demand, we plan to add support for additional cloud providers, starting with Google Cloud Platform (GCP) and Microsoft Azure. The same security principles apply: read-only access, no credentials stored, EU data residency, and full transparency about what we access.

Supported and planned providers:

| Provider | Status |
|----------|--------|
| **Amazon Web Services (AWS)** | Supported |
| **Google Cloud Platform (GCP)** | Planned if demand exists |
| **Microsoft Azure** | Planned if demand exists |
| **Hetzner** | Planned if demand exists |
| **Scaleway** | Planned if demand exists |
| **Yandex Cloud** | Planned if demand exists |

Adding a provider does not change how we handle your data. Each integration would use the provider's equivalent of read-only access (GCP Viewer role, Azure Reader role), temporary credentials, and the same EU-only storage.

---

## Contact

**Security questions and vulnerability reports:**
Email: security@scanorbit.cloud

**Business address:**
ScanOrbit
Keizersgracht 241, Amsterdam, 1016EA Netherlands
KVK: 99611252
BTW-ID: NL005398711B41

---

**Version:** 2.0
**Effective Date:** March 26, 2026