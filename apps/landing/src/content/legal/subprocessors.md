---
title: Subprocessor List
description: List of subprocessors used by ScanOrbit for data processing.
lastUpdated: March 8, 2026
---

ScanOrbit uses the following subprocessors to provide our service. This list is maintained in accordance with our [Data Processing Agreement](/dpa) and GDPR Article 28.

---

## Current Subprocessors

| Subprocessor | Purpose | Data Processed | Location | Transfer Mechanism |
|---|---|---|---|---|
| **Scaleway** | Cloud infrastructure hosting | All service data | EU (Amsterdam, Netherlands) | N/A (EU) |
| **Stripe** | Payment processing | Organization name, billing email, payment details | US / EU | Standard Contractual Clauses (SCCs) |
| **Resend** | Transactional email delivery (when configured) | Email address, email content | US | Standard Contractual Clauses (SCCs) |

## Self-Hosted Services

The following services are self-hosted on ScanOrbit's EU infrastructure and are **not** third-party subprocessors:

| Service | Purpose | Data Processed | Location |
|---|---|---|---|
| **Listmonk** | Email marketing and newsletters | Email address, subscription preferences | EU (Amsterdam, Netherlands) |
| **Umami** | Privacy-first web analytics | Anonymous page views (no cookies, no PII) | EU (Amsterdam, Netherlands) |

## Key Commitments

- **EU Data Residency**: All primary data processing occurs within the EU (Scaleway, Amsterdam)
- **No data selling**: We never sell personal data to third parties
- **No ML training**: Personal data is never used for machine learning or AI training
- **Minimal sharing**: Data is only shared with subprocessors as strictly necessary for service operation

## AWS Integration

ScanOrbit connects to customer AWS accounts using IAM role assumption (STS AssumeRole). This is **not** a subprocessor relationship — ScanOrbit acts as a processor accessing the Controller's own AWS resources with read-only permissions. No customer AWS data is shared with third parties.

## Changes to Subprocessors

In accordance with our DPA, we will notify customers of any intended changes to subprocessors with reasonable advance notice, giving customers the opportunity to object.

## Contact

For questions about our subprocessors or data processing:

- **Email**: [dpa@scanorbit.cloud](mailto:dpa@scanorbit.cloud)

---

*Last reviewed: March 8, 2026*
