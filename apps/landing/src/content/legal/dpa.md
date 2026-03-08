---
title: Data Processing Agreement
description: ScanOrbit Data Processing Agreement (DPA) for GDPR compliance.
lastUpdated: March 8, 2026
---

This Data Processing Agreement ("DPA") forms part of the Terms of Service between ScanOrbit ("Processor") and the customer ("Controller") and governs the processing of personal data by ScanOrbit on behalf of the Controller.

---

## 1. Definitions

- **Personal Data**: Any information relating to an identified or identifiable natural person, as defined in Article 4(1) of the GDPR.
- **Processing**: Any operation performed on Personal Data, as defined in Article 4(2) of the GDPR.
- **Data Controller**: The customer who determines the purposes and means of processing Personal Data.
- **Data Processor**: ScanOrbit, which processes Personal Data on behalf of the Controller.
- **Subprocessor**: A third party engaged by the Processor to process Personal Data.

## 2. Scope and Purpose

ScanOrbit processes Personal Data solely for the purpose of providing the ScanOrbit cloud infrastructure scanning service, including:

- **User account management**: Authentication, authorization, and profile management
- **AWS infrastructure scanning**: Discovering and analyzing cloud resources on behalf of the Controller
- **Security analysis**: Identifying security issues, compliance gaps, and cost optimization opportunities
- **Billing and subscription management**: Processing payments and managing service tiers
- **Communication**: Sending transactional emails (verification, password reset, billing notifications)

## 3. Categories of Personal Data

The following categories of Personal Data are processed:

| Category | Data Elements | Purpose |
|----------|--------------|---------|
| Account Data | Email, full name, hashed password | Authentication and account management |
| OAuth Data | Provider ID, encrypted tokens | Third-party authentication (Google, GitHub) |
| Security Data | Encrypted TOTP secrets, hashed recovery codes | Two-factor authentication |
| Billing Data | Stripe customer/subscription IDs | Payment processing |
| Usage Data | IP addresses, user agent, timestamps | Security monitoring and audit logging |
| AWS Data | Account IDs, resource metadata, IAM role ARNs | Infrastructure scanning service |

## 4. Data Subjects

Personal Data is processed for the following categories of data subjects:

- Users of the ScanOrbit platform (employees and contractors of the Controller)
- Individuals whose data may appear in AWS resource metadata

## 5. Obligations of the Processor

ScanOrbit shall:

1. **Process only on instructions**: Process Personal Data only on documented instructions from the Controller, including transfers to third countries.
2. **Confidentiality**: Ensure that persons authorized to process Personal Data have committed to confidentiality.
3. **Security measures**: Implement appropriate technical and organizational measures as described in Section 8.
4. **Subprocessors**: Not engage another processor without prior written authorization of the Controller (see Section 7).
5. **Assist the Controller**: Assist the Controller in responding to data subject requests (access, rectification, erasure, portability).
6. **Deletion**: Delete or return all Personal Data upon termination, unless retention is required by law.
7. **Demonstrate compliance**: Make available all information necessary to demonstrate compliance and allow for audits.

## 6. Obligations of the Controller

The Controller shall:

1. Ensure a lawful basis for processing (e.g., legitimate interest, consent, contractual necessity)
2. Provide documented instructions for processing
3. Notify ScanOrbit of any data protection impact assessments where required
4. Ensure that data subjects are informed about processing in accordance with GDPR Articles 13 and 14

## 7. Subprocessors

ScanOrbit uses the following subprocessors. A current list is maintained at [scanorbit.cloud/subprocessors](/subprocessors).

The Controller is deemed to have given general written authorization for the engagement of subprocessors listed on the subprocessor page. ScanOrbit will notify the Controller of any intended changes to subprocessors, giving the Controller the opportunity to object.

## 8. Security Measures

ScanOrbit implements the following technical and organizational security measures:

### Encryption
- **In transit**: TLS 1.3 for all connections (database, cache, external APIs)
- **At rest**: AES-256-GCM for sensitive data (OAuth tokens, 2FA secrets)
- **Backups**: GPG-encrypted (AES-256) before storage

### Access Control
- Role-based access control (RBAC) for multi-tenant organizations
- JWT-based authentication with short-lived access tokens (5 minutes)
- Two-factor authentication (TOTP) support
- Account lockout after repeated failed attempts

### Infrastructure
- **EU-only hosting**: All infrastructure hosted in the EU (Scaleway, Amsterdam)
- **Network isolation**: Internal services communicate via private Docker network
- **TLS certificates**: Self-signed certificates for internal service-to-service communication
- **Reverse proxy**: Caddy with automatic HTTPS and security headers

### Monitoring and Audit
- Comprehensive audit logging of all data access operations
- Structured logging with request tracing
- Prometheus metrics and Grafana dashboards
- Alerting via Slack and Telegram

### Data Minimization
- Read-only AWS access (no credentials stored, IAM role assumption)
- PII masking in application logs
- Minimal data collection (only what is necessary for service operation)

## 9. Data Breach Notification

ScanOrbit shall notify the Controller without undue delay, and in any event within 72 hours, after becoming aware of a personal data breach, providing:

1. Description of the nature of the breach
2. Categories and approximate number of data subjects affected
3. Likely consequences of the breach
4. Measures taken or proposed to address the breach

## 10. International Data Transfers

- **Primary infrastructure**: EU (Scaleway, Amsterdam) — no transfer outside EU
- **Payment processing**: Stripe may process data in the US under Standard Contractual Clauses (SCCs)
- **Email delivery**: When using Resend, data may transit through US servers under SCCs
- **Self-hosted services**: Listmonk (newsletter) and Umami (analytics) are self-hosted on the same EU server

## 11. Data Retention and Deletion

ScanOrbit applies the following retention periods:

| Data Type | Retention Period |
|-----------|-----------------|
| Stale resources | 90 days after last seen |
| Resolved findings | 180 days after resolution |
| Scan records | 365 days |
| Audit logs | 730 days (2 years) |
| Consent records | Indefinite (required for GDPR compliance proof) |

Upon account deletion, ScanOrbit:
1. Cancels any active subscriptions
2. Removes the user from email marketing lists
3. Deletes the user account and associated data
4. Anonymizes audit logs (removes user ID, IP address, user agent)
5. Preserves consent records (required by GDPR)

## 12. Audit Rights

The Controller has the right to conduct audits, including inspections, to verify ScanOrbit's compliance with this DPA. ScanOrbit shall:

1. Make available all information necessary to demonstrate compliance
2. Allow for and contribute to audits conducted by the Controller or an auditor mandated by the Controller
3. Inform the Controller if an instruction infringes GDPR or other data protection provisions

## 13. Term and Termination

This DPA shall remain in effect for the duration of the service agreement. Upon termination:

1. ScanOrbit will cease processing Personal Data
2. Personal Data will be deleted or returned as per Section 11
3. ScanOrbit will certify deletion upon request

## 14. Contact

For questions about this DPA or to exercise audit rights:

- **Email**: [dpa@scanorbit.cloud](mailto:dpa@scanorbit.cloud)
- **Data Protection Officer**: Available upon request

---

*This DPA is governed by the laws of the European Union and the member state where the Controller is established.*
