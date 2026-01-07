---
title: Privacy Policy
description: ScanOrbit privacy policy. Learn how we handle and protect your data.
lastUpdated: January 7, 2026
---

ScanOrbit ("we," "us," "our," or "Company") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our website and services.

---

## 1. Information We Collect

### 1.1 Information You Provide Directly

**Account Registration:**
- Email address
- Full name
- Password (hashed and encrypted)
- Company/organization name

**AWS Connection:**
- AWS Account ID (12-digit identifier)
- IAM Role ARN (for read-only access)
- External ID (optional security parameter)

**Communication:**
- Messages sent through contact forms
- Support requests and inquiries
- Email communications

### 1.2 Information We Collect Automatically

**Scan Data:**
- AWS resource details (EC2 instances, EBS volumes, S3 buckets, RDS databases, load balancers, certificates)
- Resource metadata (names, tags, regions, states, costs)
- Security findings (certificate expiry, untagged resources, misconfigurations)
- Scan timestamps and duration

**Usage Data:**
- Login timestamps
- Pages visited within the application
- API endpoints accessed
- Scan frequency and history
- IP address (for security purposes only)

**Technical Data:**
- Browser type and version
- Device type and operating system
- Log data (errors, warnings, information logs)
- Session duration

---

## 2. How We Use Your Information

### 2.1 Service Delivery
- Scanning and analyzing your AWS infrastructure
- Generating security findings and compliance reports
- Displaying resources and recommendations in your dashboard
- Processing and storing scan results

### 2.2 Account Management
- Creating and managing your account
- Authenticating your identity
- Sending account notifications (password resets, security alerts)
- Handling subscription and billing (future)

### 2.3 Communication
- Responding to your support inquiries
- Sending service announcements and updates
- Notifying you of security issues or vulnerabilities

### 2.4 Improvement & Analytics
- Analyzing how you use the service
- Identifying bugs and performance issues
- Improving product features and user experience
- Conducting anonymized usage analytics

### 2.5 Security & Compliance
- Preventing fraud and unauthorized access
- Detecting and preventing security threats
- Maintaining audit logs for compliance
- Complying with legal obligations

**We do NOT use your data for:**
- Marketing or third-party advertising
- Selling or sharing your personal information
- Training machine learning models
- Any purpose other than operating ScanOrbit

---

## 3. Data Storage & Location

### 3.1 Geographic Location

**All data is stored in the European Union:**
- **Primary:** Frankfurt, Germany (AWS eu-central-1)
- **Backup:** Amsterdam, Netherlands (AWS eu-west-1)
- **No data transfer:** Information never leaves the EU

This ensures compliance with:
- GDPR (General Data Protection Regulation)
- Data Residency Requirements
- European Data Sovereignty Laws

### 3.2 Data Encryption

**At Rest:**
- AES-256 encryption for all stored data
- Encrypted database backups
- Encrypted file storage

**In Transit:**
- TLS 1.3 for all connections
- HTTPS only (no HTTP)
- Encrypted API communications

**Database Security:**
- PostgreSQL with encrypted columns
- No plain-text passwords (bcrypt hashing)
- SQL injection protection

---

## 4. How Long We Keep Your Data

| Data Type | Retention Period | Reason |
|-----------|------------------|--------|
| **Account Information** | Until account deletion | Required to operate your account |
| **Scan Results** | 90 days | Enables trend analysis and historical comparison |
| **Findings** | 90 days | Allows you to track resolution progress |
| **API Logs** | 30 days | Debugging and security monitoring |
| **Authentication Logs** | 30 days | Security and fraud detection |
| **Backups** | 30 days after deletion | Disaster recovery purposes |

**Deletion:**
- When you delete your account, all personal data is removed within 7 days
- Backups are kept for 30 days for disaster recovery
- Scan data is permanently deleted after 90 days of inactivity

---

## 5. Who Has Access to Your Data

### 5.1 Internal Access
- **Engineering Team:** Access to error logs and debugging data only
- **Founders:** Access to aggregated metrics (not personal data)
- **Monitoring Systems:** Automated alerts for security issues

### 5.2 Service Providers

We use the following third-party services (all EU-based or GDPR compliant):

| Service | Purpose | Location |
|---------|---------|----------|
| **AWS** | Infrastructure hosting | EU (Frankfurt, Amsterdam) |
| **SendGrid** | Email delivery (future) | EU-compliant |
| **Stripe** | Payment processing (future) | GDPR-compliant |

**No third party has access to:**
- Your AWS credentials (stored encrypted)
- Your scan data
- Your personal information

### 5.3 Legal Requirements
We may disclose information when required by law:
- Court orders or legal process
- Government agency requests
- Protection of rights, privacy, or safety
- We will notify you unless prohibited by law

---

## 6. Your Rights Under GDPR

As an EU resident or user, you have the following rights:

### 6.1 Right to Access
**Request a copy of all your personal data we hold.**

Email: privacy@scanorbit.io
Response time: Within 30 days

### 6.2 Right to Erasure
**Request deletion of your account and all associated data.**

- Immediate: Account and personal data deleted
- 30 days: Backups purged, scan data removed
- 90 days: All data completely removed

### 6.3 Right to Data Portability
**Export your data in a standard format (JSON/CSV).**

We will provide:
- Your account information
- Historical scan results
- All findings and recommendations
- In machine-readable format

### 6.4 Right to Rectification
**Correct inaccurate personal information.**

You can update your profile information directly in settings.

### 6.5 Right to Restrict Processing
**Limit how we use your data.**

We can restrict data processing for specific purposes while investigating disputes.

### 6.6 Right to Object
**Opt-out of certain data processing.**

You can disable:
- Analytics collection
- Marketing communications (future)
- Automated decision-making (if applicable)

### 6.7 Right to Lodge a Complaint
**File a complaint with your national data protection authority:**

- **Germany:** BfDI - Federal Data Protection Commissioner
- **Netherlands:** AP - Dutch Data Protection Authority
- **Other EU:** Your country's DPA

---

## 7. Data Security Measures

### 7.1 Technical Controls
- AES-256 encryption (data at rest)
- TLS 1.3 encryption (data in transit)
- bcrypt password hashing (salted, 12 rounds)
- Parameterized SQL queries (SQL injection prevention)
- CORS protection
- Rate limiting on API endpoints
- Regular security updates

### 7.2 Organizational Controls
- Minimal data access (principle of least privilege)
- No access to AWS credentials by staff
- Secure secret management (HashiCorp Vault)
- Encrypted backups
- Automated backup testing
- Incident response procedures

### 7.3 Future Compliance
- **SOC2 Type II Audit:** Q2 2026
- **ISO 27001 Certification:** Q3 2026
- **Penetration Testing:** Q1 2026
- **Bug Bounty Program:** Coming soon

---

## 8. AWS Data & Permissions

### 8.1 What We Access
We connect to your AWS account using **read-only IAM role** and can only view:
- EC2 instances and metadata
- EBS volumes and snapshots
- S3 buckets and configurations
- RDS databases (metadata only, no data)
- Load balancers and listeners
- ACM certificates
- Security groups
- IAM roles and policies
- Resource tags

### 8.2 What We Cannot Do
- Terminate instances
- Delete volumes or snapshots
- Modify security settings
- Access S3 object contents
- Read database contents
- Change resource configurations
- Escalate IAM permissions

### 8.3 Your AWS Credentials
- **IAM Role:** We use the role you provide (you maintain full control)
- **No Keys Stored:** We never store AWS secret keys
- **External ID:** Optional security parameter you can set
- **Revocation:** You can revoke our access anytime by deleting the role

---

## 9. Cookies & Tracking

### 9.1 Session Cookies
We use **essential cookies only:**
- Session token (to keep you logged in)
- CSRF token (to prevent cross-site attacks)
- User preferences (theme, language)

**No tracking cookies used.**

### 9.2 Third-Party Analytics
- **Google Analytics:** Optional, can be disabled
- **No tracking pixels** on website
- **No behavioral tracking**

### 9.3 Managing Cookies
You can:
- Disable cookies in your browser settings
- Clear cookies at any time
- Opt-out of analytics in account settings

---

## 10. Children's Privacy

ScanOrbit is not intended for users under 13 years old.

If we discover that a child under 13 has provided personal information:
- We will delete their account and data immediately
- We will notify their parent/guardian
- We will not process their information further

---

## 11. International Data Transfers

**No data leaves the EU.** All information remains in European Union data centers.

If you are outside the EU:
- Your data is still processed in the EU
- GDPR protections apply
- No data is transferred to non-EU countries

---

## 12. Changes to This Privacy Policy

We may update this policy to reflect:
- Changes in our practices
- Legal requirements
- User feedback
- Security improvements

**Notification:**
- Major changes: Email notification to all users
- Minor changes: Updated on this page with date
- Effective date: Posted at top of policy

---

## 13. Contact Us

**Privacy Inquiries:**
Email: privacy@scanorbit.io

**Data Subject Requests (GDPR):**
Email: dpa@scanorbit.io
Response time: Within 30 days

**Mailing Address:**
ScanOrbit
Amsterdam, Netherlands

**Data Protection Officer (if appointed):**
Contact: dpo@scanorbit.io

---

## 14. Legal Basis for Processing (GDPR Article 6)

We process your data based on:

| Data Type | Legal Basis |
|-----------|-------------|
| **Account information** | Contract (necessary to provide service) |
| **Scan data** | Contract (necessary to perform AWS scans) |
| **API logs** | Legitimate interest (security & fraud prevention) |
| **Usage analytics** | Legitimate interest (service improvement) |
| **Communication data** | Consent & contract (responding to requests) |

---

## 15. Data Processing Agreement (DPA)

For enterprise customers:
- We provide a Data Processing Agreement (DPA) aligned with GDPR Article 28
- Standard clauses for data transfers (if applicable)
- Contact sales@scanorbit.io for DPA

---

## 16. Compliance Summary

- **GDPR Compliant:** All user rights implemented and enforceable
- **EU Data Residency:** All data stored in EU only
- **AES-256 Encryption:** Data protected at rest and in transit
- **No Data Selling:** We never monetize your information
- **Read-Only Access:** We only view your AWS resources
- **User Control:** You can access, export, or delete your data anytime

---

## 17. Acknowledgment

By using ScanOrbit, you acknowledge that you have read and understood this Privacy Policy. Your continued use of the service constitutes acceptance of these terms.

If you do not agree with any part of this policy, please discontinue use of the service.

---

**Version:** 1.0
**Effective Date:** January 7, 2026
