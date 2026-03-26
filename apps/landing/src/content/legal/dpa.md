---
title: Data Processing Agreement
description: ScanOrbit Data Processing Agreement (DPA) for GDPR compliance.
lastUpdated: March 26, 2026
---

This Data Processing Agreement ("DPA") is entered into pursuant to Article 28 of the General Data Protection Regulation (EU) 2016/679 ("GDPR"). It forms part of the Terms of Service ("Terms") between:

**Processor:** ScanOrbit, a trade name of Maria Elina, registered as a sole proprietorship (eenmanszaak) at the Dutch Chamber of Commerce (KVK) under number 99611252, BTW-ID NL005398711B41, with registered address at Keizersgracht 241, Amsterdam, 1016EA Netherlands.

**Controller:** The customer who has agreed to the Terms of Service and uses the ScanOrbit service.

This DPA governs the processing of personal data by the Processor on behalf of the Controller. In the event of a conflict between this DPA and the Terms of Service, this DPA prevails with respect to data protection matters.

---

## 1. Definitions

**Personal Data:** Any information relating to an identified or identifiable natural person, as defined in Article 4(1) GDPR.

**Processing:** Any operation or set of operations performed on Personal Data, as defined in Article 4(2) GDPR.

**Controller:** The customer who determines the purposes and means of processing Personal Data by using the ScanOrbit service.

**Processor:** ScanOrbit, which processes Personal Data on behalf of the Controller.

**Sub-processor:** A third party engaged by the Processor to carry out specific processing activities on behalf of the Controller.

**Data Breach:** A breach of security leading to the accidental or unlawful destruction, loss, alteration, unauthorized disclosure of, or access to, Personal Data.

---

## 2. Scope, Purpose, and Duration

### 2.1 Subject Matter

The Processor provides an agentless AWS infrastructure scanning service. To deliver this service, the Processor processes Personal Data of the Controller's users and metadata from the Controller's AWS accounts.

### 2.2 Purpose of Processing

The Processor processes Personal Data solely for the following purposes on documented instructions from the Controller:

- **User account management:** Authentication, authorization, and profile management
- **AWS infrastructure scanning:** Discovering and analyzing cloud resources on behalf of the Controller
- **Security analysis:** Identifying security misconfigurations, compliance gaps, cost waste, and orphaned resources
- **Billing and subscription management:** Processing payments and managing service tiers through Stripe
- **Transactional communication:** Sending service-related email notifications (for example verification, password reset, scan completion, and billing events)

The Processor will not process Personal Data for any purpose other than those listed above unless instructed in writing by the Controller.

### 2.3 Nature of Processing

Processing operations include: collection, storage, organization, retrieval, consultation, analysis, alignment, combination, restriction, deletion, and destruction of Personal Data, as necessary to provide the scanning service described in the Terms of Service.

### 2.4 Duration

Processing begins when the Controller creates an account on the ScanOrbit platform. Processing continues for the duration of the service agreement. Upon termination or account deletion, processing ceases and Personal Data is handled in accordance with Section 11.

---

## 3. Categories of Personal Data

| Category | Data Elements | Purpose |
|----------|--------------|---------|
| Account data | Email address, full name, hashed password | Authentication and account management |
| OAuth data | Provider ID (Google or GitHub), encrypted access and refresh tokens | Third-party authentication |
| Security data | Encrypted TOTP secret, hashed recovery codes | Two-factor authentication |
| Billing data | Stripe customer ID, Stripe subscription ID, subscription tier and status | Payment processing and subscription management |
| Usage data | IP addresses, user agent strings, login timestamps, API access logs | Security monitoring, audit logging, fraud prevention |
| AWS metadata | AWS Account IDs, IAM Role ARNs, resource metadata (names, tags, regions, states, costs), security findings | Infrastructure scanning service |
| Organization data (Team tier) | Organization name, member roles, member email addresses | Multi-user collaboration |

---

## 4. Categories of Data Subjects

- Users of the ScanOrbit platform (employees, contractors, or agents of the Controller)
- Individuals whose names or identifiers may appear in AWS resource metadata (e.g., resource tags, IAM user names)

---

## 5. Obligations of the Processor

The Processor shall:

### 5.1 Process Only on Documented Instructions

Process Personal Data only on documented instructions from the Controller. The Terms of Service, this DPA, and the Controller's use of the Service (including configuration choices made within the application) constitute the Controller's documented instructions. Any additional instructions must be provided in writing (email to support@scanorbit.cloud is sufficient).

If the Processor believes that an instruction from the Controller infringes the GDPR or any other applicable data protection law, the Processor will promptly inform the Controller before carrying out the instruction.

### 5.2 Confidentiality

Ensure that all persons authorized to process Personal Data are bound by appropriate confidentiality obligations.

### 5.3 Security

Implement and maintain appropriate technical and organizational measures to protect Personal Data, as described in Section 8. These measures shall ensure a level of security appropriate to the risk, taking into account the state of the art, the costs of implementation, and the nature, scope, context, and purposes of processing.

### 5.4 Sub-processors

Not engage a new sub-processor without providing the Controller with prior notice in accordance with Section 7.

### 5.5 Data Subject Requests

Assist the Controller in fulfilling its obligations to respond to data subject requests under GDPR Articles 15 through 22 (access, rectification, erasure, restriction, portability, objection).

If a data subject contacts the Processor directly with a request, the Processor will notify the Controller within 5 business days and will not respond to the data subject directly unless instructed by the Controller or required by law.

The Processor will provide reasonable technical and organizational assistance to enable the Controller to respond to data subject requests within the timelines required by the GDPR.

### 5.6 Data Protection Impact Assessment

Assist the Controller, upon request, with Data Protection Impact Assessments (GDPR Article 35) and prior consultations with supervisory authorities (GDPR Article 36), to the extent that the Processor's assistance is necessary given the nature of the processing and the information available to the Processor.

### 5.7 Breach Notification

Notify the Controller of any Data Breach in accordance with Section 9.

### 5.8 Deletion or Return

Upon termination of the service agreement, delete or return all Personal Data in accordance with Section 11.

### 5.9 Demonstrate Compliance

Make available to the Controller all information reasonably necessary to demonstrate compliance with this DPA and the obligations under Article 28 GDPR. Allow for and contribute to audits in accordance with Section 12.

---

## 6. Obligations of the Controller

The Controller shall:

1. Ensure that a lawful basis exists for the processing of Personal Data under the GDPR (e.g., contract, legitimate interest, consent) before instructing the Processor to process such data.
2. Inform data subjects about the processing carried out by the Processor in accordance with GDPR Articles 13 and 14.
3. Ensure that any instructions provided to the Processor comply with applicable data protection law.
4. Notify the Processor promptly of any data subject request received directly by the Controller that requires the Processor's assistance.
5. Conduct Data Protection Impact Assessments where required by GDPR Article 35.

---

## 7. Sub-processors

### 7.1 Authorized Sub-processors

The Controller grants general written authorization for the Processor to engage the sub-processors listed below. Each sub-processor processes only the data categories indicated and has a GDPR-compliant Data Processing Agreement in place with the Processor.

| Sub-processor | Purpose | Data Processed | Location |
|---------------|---------|----------------|----------|
| **Scaleway** | Infrastructure hosting (servers, database, backups) | All application data | EU (Amsterdam) |
| **AWS** | Customer infrastructure scanning | AWS account metadata during scans | Region selected by Controller in its AWS environment |
| **Stripe** | Payment processing | Email, name, billing address, subscription data | USA (SCCs + DPA) |
| **Resend** | Transactional and marketing email delivery | Email addresses, email content | USA (SCCs + DPA) |
| **Google** | OAuth authentication (optional, only if used by data subject) | OAuth tokens, email, profile name | USA (SCCs + DPA) |
| **GitHub** | OAuth authentication (optional, only if used by data subject) | OAuth tokens, email, profile name | USA (SCCs + DPA) |

**Self-hosted on Processor's EU infrastructure (not sub-processors):**

| Service | Purpose | Data Processed |
|---------|---------|----------------|
| **Umami** | Privacy-first web analytics | Anonymous page views only (no personal data, no cookies) |

### 7.2 Changes to Sub-processors

The Processor will notify the Controller by email at least 30 days before engaging a new sub-processor or replacing an existing one. The notice will identify the sub-processor, describe the processing to be performed, and state the location of processing.

The Controller may object to the new sub-processor by notifying the Processor in writing within 30 days of receiving the notice. If the Controller objects on reasonable data protection grounds, the Processor will either not engage the sub-processor for the Controller's data or offer the Controller the option to terminate the agreement without penalty.

If the Controller does not object within 30 days, the Controller is deemed to have accepted the new sub-processor.

### 7.3 Sub-processor Liability

The Processor remains fully liable to the Controller for the performance of each sub-processor's obligations. The Processor will impose data protection obligations on each sub-processor that are no less protective than those in this DPA.

---

## 8. Security Measures

The Processor implements the following technical and organizational measures:

### 8.1 Encryption

- **In transit:** TLS 1.2 or higher for all external connections (application, API, database, email). Internal service-to-service communication is also encrypted.
- **At rest:** AES-256-GCM encryption for sensitive data (OAuth tokens, TOTP secrets). Database connections are encrypted.
- **Backups:** GPG-encrypted (AES-256) before storage in EU-based object storage.

### 8.2 Access Control

- Role-based access control (RBAC) for multi-tenant organizations
- JWT-based authentication with short-lived access tokens (5-minute lifetime)
- Refresh token rotation (7-day lifetime)
- Two-factor authentication (TOTP) support
- Account lockout after repeated failed authentication attempts
- Principle of least privilege applied to all access

### 8.3 Infrastructure

- All infrastructure hosted in the EU (Scaleway, Amsterdam, Netherlands)
- Internal services isolated via private Docker network
- Reverse proxy (Caddy) with automatic HTTPS, security headers, and rate limiting
- No AWS credentials stored — temporary credentials obtained through IAM role assumption for each scan

### 8.4 Monitoring and Audit

- Audit logging is enabled by default for API access and sensitive data operations (user, action, timestamp, IP address), with documented endpoint exclusions and GDPR objection handling
- Structured logging with request tracing
- Prometheus metrics and Grafana dashboards for operational monitoring
- Automated alerting for security anomalies

### 8.5 Data Minimization

- Read-only AWS access only (no write permissions)
- Personal data in application logs is masked
- Only data necessary for the service operation is collected
- Automated retention cleanup runs daily

---

## 9. Data Breach Notification

### 9.1 Notification to Controller

The Processor will notify the Controller without undue delay, and in any event within 48 hours, after becoming aware of a Data Breach involving the Controller's Personal Data. This 48-hour window is intentionally shorter than the 72-hour deadline under GDPR Article 33 to allow the Controller sufficient time to assess the breach and notify the supervisory authority if required. The notification will include:

1. A description of the nature of the breach, including the categories and approximate number of data subjects and records affected
2. The name and contact details of the Processor's data protection contact
3. A description of the likely consequences of the breach
4. A description of the measures taken or proposed to address the breach, including measures to mitigate its effects

### 9.2 Ongoing Cooperation

If not all information is available at the time of initial notification, the Processor will provide information in phases as it becomes available. The Processor will cooperate with the Controller and take reasonable steps to assist in the investigation, mitigation, and remediation of the breach.

### 9.3 Documentation

The Processor will document all Data Breaches, including the facts, effects, and remedial action taken, regardless of whether the breach requires notification to a supervisory authority.

---

## 10. International Data Transfers

### 10.1 Primary Data Location

All primary application data (database, file storage, backups) is stored and processed within the European Union, specifically in Amsterdam, Netherlands.

### 10.2 Transfers to Third Countries

Certain sub-processors are located outside the European Economic Area, including in the United States. Data transfers to these sub-processors are governed by:

- **Standard Contractual Clauses (SCCs)** as adopted by the European Commission in Implementing Decision (EU) 2021/914 of 4 June 2021 (Module Two: Controller to Processor), incorporated into the Data Processing Agreements with applicable sub-processors
- **Supplementary measures** as appropriate, including encryption of data in transit and at rest

The affected sub-processors and the data they process are listed in Section 7.1.

### 10.3 Additional Transfers

The Processor will not transfer Personal Data to countries outside the European Economic Area except as described in this DPA (including Section 7) or on documented instructions from the Controller, and only with appropriate safeguards under GDPR Chapter V.

---

## 11. Data Retention and Deletion

### 11.1 Retention Periods

| Data Type | Retention Period |
|-----------|-----------------|
| Stale AWS resources | Tier-based: Free 7 days, Pro 90 days, Team 180 days after last detected in a scan |
| Resolved security findings | Tier-based: Free 14 days, Pro 180 days, Team 365 days after resolution |
| Scan records | Tier-based: Free 30 days, Pro 365 days, Team 730 days |
| Audit logs | 730 days (2 years) |
| Consent records | Retained for as long as necessary to demonstrate consent under GDPR Article 7(1) and to comply with legal obligations; retained for up to 3 years after account deletion or consent withdrawal, then permanently deleted |

### 11.2 Automated Cleanup

Retention policies are enforced by automated daily cleanup processes that run at 03:00 UTC. Data that has exceeded its retention period is permanently deleted.

### 11.3 Account Termination

Upon termination of the service agreement, the Controller may instruct the Processor to either:

**(a) Delete** all Personal Data, or
**(b) Return** all Personal Data in a machine-readable format (JSON export)

The Controller must provide this instruction within 30 days of termination. If no instruction is received within 30 days, the Processor will delete all Personal Data.

**Deletion process:**
1. A 30-day grace period begins, during which the Controller can cancel the deletion and restore the account.
2. After the grace period, the Processor permanently deletes the account and associated Personal Data from the live database.
3. Backups containing the Controller's data are purged within 30 days after deletion from the live database.
4. Audit logs are anonymized (user identifiers, IP addresses, and user agent strings are removed) but retained for their full retention period.
5. Consent records are preserved as proof of consent under GDPR for up to 3 years after account deletion, then permanently deleted.

Upon request, the Processor will certify in writing that deletion has been completed.

---

## 12. Audit Rights

### 12.1 Right to Audit

The Controller has the right to audit the Processor's compliance with this DPA. This includes the right to conduct inspections or to mandate an independent third-party auditor to do so.

### 12.2 Audit Process

Audits will be conducted subject to the following conditions:

- The Controller will provide at least 30 days' written notice before an audit.
- Audits will be conducted during normal business hours.
- The Controller (or its auditor) will comply with reasonable confidentiality obligations regarding any information obtained during the audit.
- Audits are limited to once per calendar year, unless a Data Breach has occurred or a supervisory authority requires an additional audit.
- The Controller bears the costs of the audit, including any costs incurred by the Processor in providing reasonable assistance.

### 12.3 Compliance Information

The Processor will make available to the Controller all information reasonably necessary to demonstrate compliance with Article 28 GDPR, including documentation of security measures, sub-processor agreements, and breach response procedures.

---

## 13. Liability

The liability of each party under this DPA is subject to the limitations and exclusions set out in the Terms of Service, except that nothing in the Terms of Service or this DPA limits or excludes liability for:

- Intentional misconduct or gross negligence
- Breach of confidentiality obligations
- Obligations that cannot be limited under applicable law, including GDPR

Each party is liable for damages caused by processing that infringes the GDPR in accordance with Article 82 GDPR.

---

## 14. Term and Termination

This DPA takes effect when the Controller creates an account on the ScanOrbit platform and remains in effect for the duration of the service agreement. Upon termination of the service agreement, the provisions of this DPA continue to apply to any Personal Data still in the Processor's possession until that data is deleted or returned in accordance with Section 11.

---

## 15. Governing Law

This DPA is governed by Dutch law, without prejudice to the mandatory data protection laws applicable to the Controller in its jurisdiction. Any disputes arising from this DPA will be resolved in accordance with the dispute resolution provisions of the Terms of Service.

---

## 16. Contact

**Data protection contact:**
Email: dpa@scanorbit.cloud

**Business address:**
ScanOrbit
Keizersgracht 241, Amsterdam, 1016EA Netherlands
KVK: 99611252
BTW-ID: NL005398711B41

---

**Version:** 2.0
**Effective Date:** March 26, 2026