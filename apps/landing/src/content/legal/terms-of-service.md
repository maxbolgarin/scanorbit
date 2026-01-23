---
title: Terms of Service
description: ScanOrbit Terms of Service. Legal agreement for using ScanOrbit AWS scanner.
lastUpdated: January 23, 2026
---

These Terms of Service ("Terms," "Agreement") govern your use of the ScanOrbit website, application, and services (collectively, the "Service"). By accessing or using ScanOrbit, you agree to be bound by these Terms. If you do not agree with any part of these Terms, please do not use the Service.

---

## 1. Service Description

### 1.1 What ScanOrbit Does

ScanOrbit is an agentless AWS infrastructure scanner that:
- Scans your AWS account using a read-only IAM role you provide
- Discovers and catalogs your AWS resources
- Identifies security findings and compliance issues
- Generates reports and recommendations
- Provides a dashboard to view results

### 1.2 Early-Stage Product

ScanOrbit is an **early-stage product (Beta)** with:
- Rapidly changing features
- Potential bugs and issues
- Limited support (best-effort)
- No guaranteed uptime SLA (currently)
- May have breaking changes

**What this means:**
- We aim for 99.5% uptime but don't guarantee it
- Features may be added, removed, or changed without notice
- We'll notify you of major changes when possible
- Report bugs to: support@scanorbit.cloud

---

## 2. Eligibility & Account Requirements

### 2.1 Who Can Use ScanOrbit

You must be:
- At least 13 years of age
- A legal entity or authorized representative of one
- Not prohibited by law from using the Service
- Operating with valid AWS account(s)

### 2.2 Account Registration

When you create an account, you agree to:
- Provide accurate, current, and complete information
- Update information as needed
- Maintain confidentiality of your password
- Accept responsibility for all account activity
- Comply with all applicable laws

**Account Responsibility:**
- You are responsible for all actions under your account
- You will notify us immediately of unauthorized access
- You will not share account credentials

### 2.3 Account Termination

We may suspend or terminate your account if you:
- Violate these Terms
- Provide false information
- Engage in illegal activity
- Abuse the Service
- Violate other users' rights

---

## 3. AWS Account Access & Permissions

### 3.1 IAM Role Requirements

You must provide ScanOrbit with:
- A read-only IAM role in your AWS account
- The role ARN (Amazon Resource Name)
- Optionally, an External ID for additional security

**We recommend using the following permissions:**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ScanOrbitReadAccess",
      "Effect": "Allow",
      "Action": [
        "ec2:Describe*",
        "rds:Describe*",
        "s3:ListAllMyBuckets",
        "s3:GetBucketLocation",
        "s3:GetBucketTagging",
        "s3:GetBucketPolicy",
        "s3:GetBucketPolicyStatus",
        "s3:GetPublicAccessBlock",
        "elasticloadbalancing:Describe*",
        "acm:List*",
        "acm:Describe*",
        "lambda:ListFunctions",
        "lambda:GetFunction",
        "lambda:ListTags",
        "kms:ListKeys",
        "kms:DescribeKey",
        "kms:ListResourceTags",
        "kms:GetKeyRotationStatus",
        "secretsmanager:ListSecrets",
        "secretsmanager:DescribeSecret",
        "logs:DescribeLogGroups",
        "logs:ListTagsForResource",
        "cloudwatch:DescribeAlarms",
        "cloudwatch:ListTagsForResource",
        "iam:ListUsers",
        "iam:ListUserTags",
        "iam:ListMFADevices",
        "iam:ListRoles",
        "iam:ListRoleTags",
        "iam:GetRole",
        "iam:ListAccessKeys",
        "iam:GetAccessKeyLastUsed",
        "iam:ListAttachedRolePolicies",
        "iam:ListRolePolicies",
        "iam:GetRolePolicy"
      ],
      "Resource": "*"
    }
  ]
}
```

### 3.2 What We Can Access

With your read-only role, ScanOrbit can **view only:**
- EC2 instances, images, security groups, volumes, snapshots
- RDS instances and snapshots (metadata only, NOT database contents)
- S3 bucket configurations (NOT object contents)
- Load balancers (ALB/NLB) and target groups
- ACM certificates and metadata
- Lambda functions and configurations
- CloudWatch alarms and log groups
- IAM users, roles, and access key metadata (NOT credentials)
- KMS keys and key rotation status
- Secrets Manager secrets (metadata only, NOT secret values)
- Resource tags across all services

### 3.3 What We Cannot Do

ScanOrbit **CANNOT** and **will not:**
- Terminate EC2 instances
- Delete or modify volumes/snapshots
- Delete or access S3 objects
- Read RDS database contents
- Modify security groups
- Encrypt/decrypt any data
- Make any AWS API calls that modify resources
- Access AWS credentials or secrets

### 3.4 Your AWS Responsibility

You are responsible for:
- Creating the IAM role with appropriate permissions
- Maintaining the security of the role
- Revoking access when needed (delete the role)
- AWS costs incurred by ScanOrbit's API calls
- Compliance with your AWS account terms

**Note:** ScanOrbit's API calls to AWS may incur small costs. These are typically minimal (we use read-only API calls).

---

## 4. Acceptable Use Policy

### 4.1 You Agree NOT To:

**Illegal Activity:**
- Use ScanOrbit for illegal purposes
- Violate any local, national, or international law
- Access accounts you don't own or have permission to scan
- Violate AWS's acceptable use policy

**Misuse:**
- Attempt to reverse-engineer the Service
- Access the Service using automated tools (except as authorized)
- Attempt to bypass security measures
- Scan AWS accounts without authorization
- Resell or redistribute the Service without permission

**Harmful Content:**
- Transmit malware or viruses
- Send spam or unsolicited communications
- Harass, abuse, or threaten other users
- Interfere with Service operations
- Overload the Service with requests

**Violations:**
- We will immediately terminate your account
- We will preserve evidence and may report to authorities
- You may be liable for damages

### 4.2 Authorization to Scan

By scanning an AWS account, you represent that you:
- Own the AWS account, OR
- Have explicit written authorization from the account owner
- Have permission to install software and modify IAM roles
- Have permission to conduct security assessments

---

## 5. Intellectual Property Rights

### 5.1 ScanOrbit IP

All content in ScanOrbit is owned by ScanOrbit or its licensors:
- Software code and algorithms
- User interface and design
- Documentation and guides
- Reports and findings methodology
- Logos and trademarks

You may not:
- Copy or reproduce the Service
- Create derivative works
- Reverse-engineer or decompile
- Use for commercial purposes without license

### 5.2 Your Data

You retain ownership of:
- Your AWS account information
- Your personal data
- Data generated from your AWS scans
- Findings and recommendations

**License to ScanOrbit:**
By using the Service, you grant ScanOrbit a non-exclusive license to:
- Store your data in our systems
- Process and analyze your data
- Generate reports and findings
- Use data for service improvement (aggregated/anonymized)

---

## 6. Limitations of Liability

### 6.1 "AS-IS" Service

**ScanOrbit is provided "AS-IS" without warranties:**
- No guarantee of accuracy or completeness
- No guarantee of uptime or availability
- No guarantee of specific results
- May contain bugs, errors, or inaccuracies
- Features may change or be discontinued

### 6.2 Disclaimer

**ScanOrbit does NOT:**
- Provide professional security advice (consult security experts)
- Guarantee findings are 100% accurate
- Guarantee all issues are discovered
- Replace a comprehensive security audit
- Guarantee compliance with regulations
- Provide legal advice

### 6.3 Limitation of Liability

**To the maximum extent permitted by law:**

We are not liable for:
- Indirect, incidental, special, or consequential damages
- Loss of revenue, profit, data, or business
- Third-party claims
- AWS costs incurred
- Service interruptions or downtime
- Data loss or corruption
- Actions taken based on our findings

**Maximum Liability:**
- Our total liability shall not exceed the amount you paid us
- If you paid nothing, our liability is zero

### 6.4 Your Responsibility

You acknowledge that:
- You are responsible for verifying our findings
- You should conduct additional security assessments
- You should not rely solely on ScanOrbit
- AWS API calls are your responsibility
- You must implement recommendations carefully

---

## 7. Data & Privacy

### 7.1 Data Collection

We collect and store:
- Account information you provide
- AWS scan results
- Security findings
- Usage data and logs
- Technical information

See our [Privacy Policy](/privacy) for full details.

### 7.2 Data Security

We protect your data with:
- AES-256 encryption at rest
- TLS 1.3 in transit
- Secure backups
- Access controls

We do NOT:
- Sell your data
- Share with advertisers
- Use for marketing
- Train AI models on your data

### 7.3 Data Deletion

You can:
- Delete individual scans
- Delete your entire account
- Request data export
- See our Privacy Policy for retention details

---

## 8. Third-Party Services

### 8.1 AWS Integration

ScanOrbit integrates with Amazon Web Services (AWS):
- You must comply with [AWS Terms of Service](https://aws.amazon.com/service-terms/)
- You are responsible for AWS account security
- You are responsible for AWS costs
- AWS may change their APIs or policies

### 8.2 Third-Party Services

ScanOrbit integrates with the following third-party services:

| Service | Purpose | Privacy |
|---------|---------|---------|
| **Plausible Analytics** | Privacy-first website analytics | No cookies, no personal data, EU-hosted |
| **Stripe** | Payment processing | PCI compliant, [Privacy Policy](https://stripe.com/privacy) |
| **SendGrid** | Email delivery | [Privacy Policy](https://www.twilio.com/legal/privacy) |

**About Plausible Analytics:**
We use Plausible for website and application analytics. Unlike Google Analytics, Plausible:
- Does not use cookies
- Does not collect personal data
- Does not track users across sites
- Is fully GDPR compliant by design
- Hosts all data in the EU

Learn more: [Plausible Data Policy](https://plausible.io/data-policy)

These third parties have their own terms and privacy policies. We recommend reviewing them.

---

## 9. Payment & Subscription

### 9.1 Pricing Tiers

ScanOrbit offers the following plans:

| Plan | Price | Features |
|------|-------|----------|
| **Free** | €0 | 1 AWS account, limited scanners, 7-day retention, dashboard stats only, 1 successful scan |
| **Pro** | €19/month | 1 AWS account, all scanners, 30-day retention, full resource & finding access, infrastructure map, 1-hour scan cooldown, email support |
| **Team** | €79/month | 5 AWS accounts, all scanners, 90-day retention, full access, unlimited scans, API access, priority support |

**Free Tier Limitations:**
- Can view aggregated dashboard statistics only
- Cannot view detailed resource lists
- Cannot view detailed finding lists
- Cannot access infrastructure map
- Limited to one successful scan (can retry on errors)

### 9.2 Payment Terms

- You authorize charges to your payment method
- Billing is monthly unless otherwise stated
- Cancellation effective at end of billing period
- You are responsible for sales tax/VAT
- Refunds follow our refund policy

### 9.3 Plan Changes

- You can upgrade or downgrade at any time
- Changes take effect at the next billing cycle
- Data retention limits apply based on your current plan

---

## 10. Support & Warranties

### 10.1 Support

ScanOrbit currently offers:
- Email support: support@scanorbit.cloud
- Documentation: /docs
- Response times vary by plan (see pricing)

### 10.2 Disclaimers

**ScanOrbit makes NO warranties:**
- Express or implied
- Of merchantability
- Of fitness for a particular purpose
- That the Service will be error-free
- That findings are 100% accurate

### 10.3 Beta Features

Some features may be labeled "Beta":
- Not fully tested
- May be unstable
- May change or disappear
- Use at your own risk

---

## 11. Indemnification

### 11.1 You Indemnify Us

You agree to indemnify and hold harmless ScanOrbit from:
- Claims arising from your use of the Service
- Claims that you violated these Terms
- Claims that you violated AWS terms
- Claims related to your AWS account
- Claims related to content you upload

---

## 12. Modifications to Terms

### 12.1 Changes to These Terms

We may modify these Terms at any time:
- We will post updated Terms with effective date
- Major changes: we will notify you by email
- Minor changes: effective immediately upon posting
- Your continued use means acceptance

---

## 13. Termination

### 13.1 By You

You can terminate your account:
- Anytime through account settings
- Email: support@scanorbit.cloud
- Your data will be deleted per Privacy Policy

### 13.2 By Us

We may terminate your access:
- For violation of these Terms
- For illegal activity
- For abuse of the Service
- If required by law
- For inactivity (90+ days)

### 13.3 Effects of Termination

Upon termination:
- You lose access to your account
- Your data is deleted (per Privacy Policy)
- Any outstanding payments are due
- Sections that survive termination remain in effect

---

## 14. Governing Law & Dispute Resolution

### 14.1 Governing Law

These Terms are governed by the laws of:
- **The Netherlands**
- GDPR and EU data protection laws apply
- Any arbitration conducted under EU laws

### 14.2 Dispute Resolution

If you have a dispute:
1. **Good Faith Discussion:** Email support@scanorbit.cloud
2. **Mediation:** We will attempt to resolve within 30 days
3. **Arbitration:** If unresolved, binding arbitration in Amsterdam, Netherlands
4. **Legal Action:** You may file in courts of your jurisdiction

### 14.3 Limitation Period

Legal action must be filed within **1 year** of the claim arising.

---

## 15. Export Compliance

ScanOrbit complies with export control laws:
- We do not provide service to embargoed countries
- We comply with OFAC sanctions
- Use of ScanOrbit may be restricted in certain jurisdictions

**You cannot use ScanOrbit if:**
- You are located in a sanctioned country
- You are on the US OFAC list
- Your government prohibits it

---

## 16. Severability

If any provision of these Terms is found invalid:
- That provision is severed
- Remaining Terms remain in effect
- We will replace the invalid provision with valid one that accomplishes original intent

---

## 17. Entire Agreement

This Agreement, together with:
- [Privacy Policy](/privacy)
- [Security Policy](/security)
- [Cookie Policy](/cookies)

Constitutes the entire agreement between you and ScanOrbit regarding the Service.

Any prior agreements, understandings, or negotiations are superseded.

---

## 18. Contact Information

### 18.1 Questions About These Terms

**Email:** hello@scanorbit.cloud

### 18.2 Service-Related Questions

**Support:** support@scanorbit.cloud

### 18.3 Mailing Address

ScanOrbit
Amsterdam, Netherlands

---

## 19. Key Takeaways

**Remember:**
- You maintain full control of your AWS account
- We only have read-only access
- You can revoke access anytime
- We never modify your resources
- You're responsible for verifying findings
- We're early-stage, not fully production-ready
- Your data is encrypted and EU-only
- You can delete your account anytime

---

## 20. Acknowledgment & Acceptance

**By using ScanOrbit, you:**
- Have read these Terms
- Understand and agree to all provisions
- Accept the limitations and disclaimers
- Acknowledge you are responsible for your AWS account
- Will comply with all applicable laws

If you do not agree, do not use the Service.

---

**Version:** 1.1
**Effective Date:** January 21, 2026
