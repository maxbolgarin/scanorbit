---
title: Security Policy
description: ScanOrbit security practices, infrastructure protection, and data security measures.
lastUpdated: January 7, 2026
---

At ScanOrbit, security is not a feature—it's foundational. This page explains how we secure your data, protect your AWS infrastructure, and maintain the integrity of our service.

---

## 1. Executive Summary

### 1.1 Our Security Principles

- **Zero Trust Architecture** - We verify every request
- **Encryption First** - All data encrypted at rest and in transit
- **EU-Only Data** - No data leaves the European Union
- **Read-Only Access** - We can only view, never modify
- **No Agents** - No software installed in your AWS account
- **Minimal Access** - We access only what's necessary
- **Transparency** - We publish our security practices

### 1.2 Security Certifications (Roadmap)

| Certification | Timeline | Status |
|---------------|----------|--------|
| **SOC2 Type II** | Q2 2026 | Planned |
| **ISO 27001** | Q3 2026 | Planned |
| **Penetration Testing** | Q1 2026 | Planned |
| **Bug Bounty Program** | Q1 2026 | Coming Soon |

---

## 2. Infrastructure Security

### 2.1 Cloud Infrastructure

**ScanOrbit is hosted on AWS:**
- **Primary Region:** eu-central-1 (Frankfurt, Germany)
- **Backup Region:** eu-west-1 (Amsterdam, Netherlands)
- **Data Residency:** EU-only (GDPR compliant)
- **No US Data Centers:** Data never leaves EU

**Why EU-only:**
- GDPR compliance
- Data sovereignty
- Reduced latency for EU users
- Regulatory alignment

### 2.2 Network Security

**Ingress (Inbound):**
- HTTPS only (TLS 1.3)
- HTTP automatically redirects to HTTPS
- DDoS protection (AWS Shield)
- WAF (Web Application Firewall) rules
- Rate limiting on all endpoints
- API authentication required

**Egress (Outbound):**
- API calls to AWS only (encrypted)
- HTTPS/TLS 1.3 for all connections
- No data exfiltration possible
- AWS VPC endpoints for private connectivity
- Network segmentation between services

### 2.3 Compute Security

**Containerization:**
- All services run in Docker containers
- No root access to containers
- Container images scanned for vulnerabilities
- Minimal base images (Alpine Linux)

**Server Hardening:**
- OS patches applied automatically
- Security updates deployed within 48 hours
- SSH disabled (managed through bastion host only)
- Secrets stored in HashiCorp Vault (encrypted)
- No default credentials

### 2.4 High Availability & Disaster Recovery

**Redundancy:**
- Multi-AZ deployment (Frankfurt + Amsterdam)
- Database replication across regions
- Automatic failover (RTO: <5 minutes)
- Load balancing across instances

**Backups:**
- Daily automated backups
- Encrypted backup storage
- Point-in-time recovery capability
- Backup integrity tested weekly
- Retention: 30 days

---

## 3. Data Security

### 3.1 Encryption at Rest

**Database Encryption:**
- PostgreSQL with AES-256 encryption
- Encrypted columns for sensitive data
- Encryption key stored separately (Vault)
- No plaintext storage of credentials

**File Storage:**
- AES-256 encryption for all files
- S3 server-side encryption enabled
- EBS volumes encrypted

**Backups:**
- Encrypted backup storage
- Encryption keys rotated monthly
- Backup encryption tested regularly

### 3.2 Encryption in Transit

**TLS Configuration:**
- TLS 1.3 (minimum, TLS 1.2 supported for legacy)
- Perfect Forward Secrecy (PFS) enabled
- Strong cipher suites only
- HSTS headers enabled (Strict-Transport-Security)

**Certificate Management:**
- Certificates from Let's Encrypt
- Auto-renewal 30 days before expiry
- Certificate pinning for critical APIs
- Regular certificate validation

**API Security:**
- All API calls over HTTPS
- JWT tokens with short expiry (1 hour)
- Refresh tokens with longer expiry (7 days)
- Token rotation on sensitive operations

### 3.3 Data Classification

**High Sensitivity:**
- User passwords (bcrypt hashed, not encrypted)
- AWS IAM role ARNs (encrypted)
- API tokens (encrypted)

**Medium Sensitivity:**
- Email addresses (encrypted)
- Organization names (encrypted)
- User profile data (encrypted)

**Low Sensitivity:**
- Scan results (encrypted, but less sensitive)
- Resource metadata (encrypted)
- Timestamps and logs (encrypted)

---

## 4. Application Security

### 4.1 Secure Development

**Code Practices:**
- Code review required for all changes
- No hardcoded credentials (tools: git-secrets, TruffleHog)
- OWASP Top 10 compliance
- Input validation on all user inputs
- Output encoding/escaping
- SQL injection prevention (parameterized queries)

**Dependencies:**
- Dependency scanning (npm audit, Go mod)
- Vulnerable package detection (Snyk, Dependabot)
- Automated patching for critical vulnerabilities
- Regular dependency updates

**Version Control:**
- Git with branch protection
- Signed commits required
- Pull request review mandatory
- Audit logs for all changes
- No force pushes to main branch

### 4.2 Authentication & Authorization

**User Authentication:**
- Password hashing: bcrypt (12 rounds, salted)
- Minimum password length: 12 characters
- Password strength requirements
- No password reset links (MFA required instead)
- Session tokens: JWT with 1-hour expiry
- Refresh tokens: 7-day expiry, rotated on use

**Multi-Factor Authentication (Future):**
- TOTP (Google Authenticator, Authy) coming Q1 2026
- SMS 2FA coming Q2 2026
- Hardware security keys coming Q3 2026

**Authorization:**
- Role-based access control (RBAC)
- Principle of least privilege
- Per-account isolation
- API scopes and permissions

### 4.3 API Security

**Rate Limiting:**
- 100 requests/minute per user
- 1000 requests/minute per IP
- Burst protection enabled
- Graceful degradation under load

**Input Validation:**
- Zod schema validation
- File upload restrictions
- Size limits on requests
- Content-type validation

**Output Security:**
- HTML entity escaping
- JSON serialization
- No sensitive data in logs
- API responses sanitized

### 4.4 Session Management

**Session Security:**
- Secure, httpOnly cookies
- SameSite=Strict attribute
- Secure flag enabled (HTTPS only)
- Session timeout: 24 hours
- Automatic logout on inactivity (15 minutes)
- User activity logging

---

## 5. AWS Integration Security

### 5.1 IAM Role Configuration

**Read-Only Permissions:**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ec2:Describe*",
        "rds:Describe*",
        "s3:ListBucket",
        "s3:GetBucketTagging",
        "s3:GetBucketLocation",
        "s3:ListAllMyBuckets",
        "elasticloadbalancing:Describe*",
        "acm:Describe*",
        "acm:ListCertificates",
        "iam:ListRoles",
        "iam:ListUsers",
        "iam:ListPolicies"
      ],
      "Resource": "*"
    }
  ]
}
```

**What This Allows:**
- View EC2 instances, security groups, images
- View EBS volumes, snapshots, configurations
- List S3 buckets and metadata (NOT contents)
- View RDS instances (metadata only, NOT data)
- View load balancers and configurations
- View ACM certificates (metadata only)
- List IAM roles, users, policies

**What This Prevents:**
- Terminate or stop instances
- Delete or modify volumes/snapshots
- Delete or access S3 objects
- Read RDS database contents
- Create, modify, or delete security groups
- Change IAM permissions
- Any write operations whatsoever

### 5.2 STS Assume Role

**Security Features:**
- External ID required (you set this)
- Session duration: 1 hour (maximum)
- Session name: audit trail
- No inline policies allowed
- Role restricted to ScanOrbit service account

**Your Control:**
- You create the IAM role
- You set the trust relationship
- You can revoke access instantly
- You monitor role usage in CloudTrail

### 5.3 AWS API Call Logging

**CloudTrail Integration (Your AWS Account):**
- All ScanOrbit API calls logged by AWS
- Available in your CloudTrail
- Event history shows exactly what was accessed
- You can audit our activity anytime

**Audit Trail:**
- User identity (ScanOrbit service account)
- Action performed (API call name)
- Resource accessed
- Request time
- Request parameters

### 5.4 AWS Credentials Handling

**We NEVER:**
- Store AWS secret access keys
- Store AWS temporary credentials
- Request AWS root account credentials
- Cache AWS API responses
- Log sensitive AWS data

**We ONLY:**
- Store the IAM role ARN (encrypted)
- Store the External ID (encrypted)
- Call AWS APIs using assume role
- Get short-lived temporary credentials
- Use credentials within 1-hour session

---

## 6. Access Control & Monitoring

### 6.1 Internal Access Controls

**Engineering Team:**
- Limited to necessary systems
- Access logging enabled
- Multi-factor authentication required
- Quarterly access review
- Principle of least privilege

**Founders:**
- Read-only access to aggregated metrics
- Cannot access individual user data
- Cannot view AWS credentials
- Cannot modify production systems directly

**On-Call Engineers:**
- Emergency access with approval
- Time-limited access (4 hours max)
- All actions logged
- Post-incident review required

### 6.2 Monitoring & Alerting

**Real-Time Monitoring:**
- CPU, memory, disk usage alerts
- Database connection pool alerts
- API error rate monitoring
- Failed login attempt alerts
- Unusual API usage patterns

**Security Alerts:**
- Authentication failures (3+ failed attempts)
- Permission denied errors
- Certificate expiry warnings
- Database backup failures
- Network security group changes

**Incident Response:**
- On-call rotation 24/7 (future)
- Alert escalation policy
- Incident response playbooks
- Post-incident reviews
- Root cause analysis

### 6.3 Audit Logging

**Logged Events:**
- All user logins
- All API calls (request/response metadata, not data)
- All permission changes
- All data exports/deletions
- All security events

**Retention:**
- Audit logs: 90 days
- Critical security events: 1 year
- Searchable and tamper-evident
- Immutable storage

---

## 7. Vulnerability Management

### 7.1 Vulnerability Scanning

**Continuous Scanning:**
- Dependency scanning (npm audit, Go mod)
- Container image scanning (Trivy)
- Infrastructure scanning (CloudMapper)
- Code scanning (Semgrep)
- Secrets detection (GitGuardian, TruffleHog)

**Frequency:**
- Daily automated scans
- Weekly manual reviews
- Monthly penetration testing (future)
- Quarterly external security audits (future)

### 7.2 Vulnerability Response

**Critical (CVSS 9+):**
- Fix within 24 hours
- Emergency deployment
- User notification

**High (CVSS 7-9):**
- Fix within 48 hours
- Scheduled deployment
- User notification if impactful

**Medium (CVSS 4-7):**
- Fix within 1 week
- Regular deployment cycle
- No user notification usually

**Low (CVSS <4):**
- Fix in next release cycle
- Track in backlog

### 7.3 Security Updates

**OS & Dependencies:**
- Security patches: within 48 hours
- Minor updates: within 1 week
- Major updates: within 2 weeks
- Zero-day vulnerabilities: ASAP

**Deployment Process:**
- Staging environment first
- Automated tests
- Manual verification
- Canary deployment
- Full rollout with monitoring

---

## 8. Incident Response

### 8.1 Incident Response Plan

**Detection:**
- Automated alerts
- User reports
- Security team monitoring
- Third-party reports

**Classification:**
- **Critical:** Data breach, service down, active attack
- **High:** Vulnerability, failed security control
- **Medium:** Configuration issue, minor vulnerability
- **Low:** Information only, no immediate action needed

**Response Timeline:**
- Critical: Response within 30 minutes
- High: Response within 2 hours
- Medium: Response within 24 hours
- Low: Addressed in next sprint

### 8.2 Data Breach Response

If a data breach occurs:
1. **Immediate:** Isolate affected systems
2. **Investigation:** Determine scope and impact
3. **Notification:** Inform users (within 72 hours for GDPR)
4. **Remediation:** Fix vulnerability
5. **Review:** Post-incident analysis

**User Notification Includes:**
- What data was affected
- When the breach occurred
- What actions we took
- What actions they should take
- Contact information for questions

---

## 9. Third-Party Security

### 9.1 Vendor Assessment

**Before Using Third-Party Services:**
- Security review questionnaire
- SOC2 or ISO 27001 certification check
- Data location verification
- Data processing agreement (DPA)
- Incident response process

**Approved Third Parties:**
- AWS (infrastructure)
- Let's Encrypt (SSL certificates)
- HashiCorp Vault (secrets management)
- GitHub (code repository)
- Future: SendGrid, Stripe (when added)

### 9.2 Data Processor Agreements

**DPA Requirements:**
- GDPR Article 28 compliance
- Sub-processor notifications
- Data deletion on termination
- Security requirements
- Audit rights

---

## 10. Compliance & Standards

### 10.1 GDPR Compliance

**Data Subject Rights:**
- Right to access
- Right to erasure
- Right to data portability
- Right to rectification
- Right to restrict processing
- Right to object
- Right to lodge a complaint

**Technical Measures:**
- Encryption at rest and in transit
- Access controls
- Pseudonymization where possible
- Confidentiality of staff

**Organizational Measures:**
- Data protection policies
- Staff training
- Data breach procedures
- Impact assessments

### 10.2 EU Data Residency

**Regulatory Requirements:**
- All data stored in EU only
- No data transfer outside EU
- EU data center providers only
- Compliance with NIS Directive (future)

**Verification:**
- AWS Frankfurt region (primary)
- AWS Amsterdam region (backup)
- No US or non-EU regions used
- Regular audits to verify

### 10.3 Future Certifications

| Standard | Timeline | Scope |
|----------|----------|-------|
| **SOC2 Type II** | Q2 2026 | Security, availability, integrity |
| **ISO 27001** | Q3 2026 | Information security management |
| **BSI C5** | Q4 2026 | Cloud computing compliance (German standard) |

---

## 11. Security Best Practices for Users

### 11.1 Recommended Configuration

**For Maximum Security:**

1. **Create Dedicated IAM Role**
   - Use our recommended policy
   - Attach only to ScanOrbit
   - Use External ID (set a strong random value)

2. **Enable CloudTrail**
   - Monitor all ScanOrbit API calls
   - Set up CloudWatch alerts for anomalies

3. **Use IAM Permissions Boundary**
   - Restrict role to specific regions/services if needed
   - Maximize principle of least privilege

4. **Regular Access Review**
   - Review ScanOrbit access monthly
   - Delete role if no longer needed
   - Monitor CloudTrail for unusual activity

### 11.2 Revoke Access Anytime

**If you want to stop ScanOrbit:**
1. Go to IAM → Roles
2. Delete the ScanOrbit role
3. Access is immediately revoked
4. We have no access to your account anymore

**If you're worried about security:**
- Immediately revoke the role
- Check CloudTrail for API calls
- Verify we didn't modify anything (read-only guarantee)

---

## 12. Security Reporting

### 12.1 Report a Vulnerability

**Responsible Disclosure:**

If you discover a security vulnerability:

**Email:** security@scanorbit.cloud

**Include:**
- Description of vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (optional)

**We will:**
- Acknowledge receipt within 24 hours
- Investigate thoroughly
- Keep you informed of progress
- Fix and deploy patch
- Credit you publicly (if desired)

### 12.2 Bug Bounty Program

**Coming Q1 2026:**
- Structured bug bounty program
- Reward tiers based on severity
- Legal immunity for responsible disclosure
- Public leaderboard (optional)

---

## 13. Security Training & Awareness

### 13.1 Team Training

**All Staff:**
- OWASP Top 10 training
- Secure coding practices
- Password security
- Phishing awareness
- Data protection (GDPR)

**Frequency:**
- Onboarding: Mandatory
- Annual refresh: Required
- New threats: As needed

### 13.2 Security Culture

- Security is everyone's responsibility
- Blameless incident reviews
- Sharing security learnings
- Continuous improvement
- Open communication about risks

---

## 14. Transparency & Public Commitment

### 14.1 Transparency Report (Future)

**Coming Q2 2026:**
- Government data requests
- Legal orders
- Abuse reports
- Incident statistics
- Uptime percentage

### 14.2 Security Roadmap

**2026 Goals:**
- Q1: Penetration testing, bug bounty launch
- Q2: SOC2 Type II certification
- Q3: ISO 27001 certification
- Q4: BSI C5 compliance

**2027 Goals:**
- Hardware security keys
- Advanced threat detection
- Automated incident response
- Security AI/ML integration

---

## 15. Compliance Checklists

### 15.1 For Enterprises

**ScanOrbit provides:**
- GDPR-compliant service
- EU data residency
- Encryption at rest and in transit
- Read-only AWS access
- Audit logging
- Data deletion on request
- Data Processing Agreement (DPA)
- Incident response procedures

**Coming:**
- SOC2 Type II report
- ISO 27001 certificate
- Penetration test results

### 15.2 For Compliance Teams

**Available Documentation:**
- Security policy (this page)
- Privacy policy
- Terms of service
- Data Processing Agreement (on request)
- Architecture documentation
- Incident response procedures

**Contact:** compliance@scanorbit.cloud

---

## 16. Security Contacts

**Security Inquiries:**
**security@scanorbit.cloud**

**Compliance Questions:**
**compliance@scanorbit.cloud**

**Data Subject Requests (GDPR):**
**dpa@scanorbit.cloud**

**General Support:**
**support@scanorbit.cloud**

---

## 17. Key Security Guarantees

**We Guarantee:**
- Read-only access only (no modifications possible)
- AES-256 encryption at rest
- TLS 1.3 encryption in transit
- EU-only data storage
- No data selling or advertising use
- No AI/ML training on your data
- Access revocable anytime by you
- Transparent security practices

**We Cannot Guarantee:**
- 100% uptime (we aim for 99.5%, but it's early-stage)
- Zero breaches forever (no one can)
- Perfect security (we strive for it but stay vigilant)
- SOC2/ISO27001 yet (coming Q2-Q3 2026)

---

## 18. Questions?

**Have security concerns?**

We take security seriously and are happy to discuss:
- Specific vulnerabilities
- Architecture details
- Compliance requirements
- Risk assessments
- Integration security
- Anything else

**Email:** security@scanorbit.cloud

---

**Version:** 1.0
**Effective Date:** January 7, 2026
