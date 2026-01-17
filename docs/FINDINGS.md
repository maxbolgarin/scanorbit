# ScanOrbit Finding Types Reference

This document provides a comprehensive reference for all finding types detected by ScanOrbit, including their severity levels, trigger conditions, and recommended remediation actions.

## Severity Levels

ScanOrbit uses a 5-tier severity system to help prioritize remediation efforts:

| Severity | Description | Response Time | Color |
|----------|-------------|---------------|-------|
| **CRITICAL** | Active security breach risk, service disruption, or compliance violation requiring immediate action | Immediate (hours) | Red (dark) |
| **HIGH** | Serious security/compliance risk that could lead to breach or significant impact | Within 24-48 hours | Red |
| **MEDIUM** | Important security or cost issue, should be addressed in normal workflow | Within 1-2 weeks | Yellow |
| **LOW** | Best practice improvement, optimization opportunity | Within 1 month | Blue |
| **TRIVIAL** | Nice to have, minimal impact, informational | Optional | Gray |

---

## Finding Types by Category

### Security Findings

#### `unencrypted_resource`
**Severity:** MEDIUM (EBS) / HIGH (RDS)

**Description:** Detects resources that are not encrypted at rest, which could expose sensitive data if storage media is compromised.

**Trigger Conditions:**
- EBS volume with `encrypted: false`
- RDS instance with `storage_encrypted: false`

**Remediation:**
- **EBS:** Create an encrypted snapshot and restore to a new encrypted volume
- **RDS:** Create an encrypted snapshot and restore to a new encrypted instance (encryption must be enabled at creation time)

---

#### `public_access`
**Severity:** HIGH

**Description:** S3 bucket has Block Public Access settings disabled, potentially allowing unauthorized access to bucket contents.

**Trigger Conditions:**
- Any of the following settings is `false`:
  - `block_public_acls`
  - `ignore_public_acls`
  - `block_public_policy`
  - `restrict_public_buckets`

**Remediation:**
Enable all Block Public Access settings unless public access is explicitly required for the use case.

---

#### `permissive_security_group`
**Severity:** HIGH

**Description:** Security group allows access to sensitive ports (SSH, RDP, databases) from the public internet (0.0.0.0/0).

**Trigger Conditions:**
- Inbound rule allows traffic from `0.0.0.0/0` or `::/0`
- Rule includes sensitive ports: 22 (SSH), 3389 (RDP), 3306 (MySQL), 5432 (PostgreSQL), 1433 (MSSQL), 27017 (MongoDB), 6379 (Redis), 9200 (Elasticsearch), 5672 (RabbitMQ), 11211 (Memcached)

**Remediation:**
Restrict access to specific IP ranges or use a VPN/bastion host for administrative access.

---

#### `open_all_ports`
**Severity:** HIGH

**Description:** Security group allows all traffic (all ports) from the public internet.

**Trigger Conditions:**
- Inbound rule with protocol `-1` (all) open to `0.0.0.0/0` or `::/0`
- Inbound rule with ports 0-65535 open to `0.0.0.0/0` or `::/0`

**Remediation:**
Restrict inbound rules to only the specific ports and IP ranges required for your application.

---

#### `publicly_accessible_rds`
**Severity:** CRITICAL

**Description:** RDS instance is configured to be publicly accessible from the internet.

**Trigger Conditions:**
- RDS instance has `publicly_accessible: true`

**Remediation:**
Disable public accessibility and access the database through a VPN, bastion host, or VPC peering.

---

#### `public_snapshot`
**Severity:** CRITICAL

**Description:** EBS or RDS snapshot is shared publicly, potentially exposing sensitive data.

**Trigger Conditions:**
- Snapshot permissions include `all` (public)

**Remediation:**
Remove public permissions from the snapshot. If sharing is required, use specific AWS account IDs.

---

#### `insecure_tls`
**Severity:** MEDIUM

**Description:** Resource is using outdated TLS versions (1.0/1.1) or weak cipher suites.

**Trigger Conditions:**
- ALB or CloudFront using TLS policy that allows TLS 1.0 or 1.1
- Weak cipher suites configured

**Remediation:**
Update the security policy to use TLS 1.2 or higher with modern cipher suites.

---

### IAM Findings

#### `user_without_mfa`
**Severity:** HIGH

**Description:** IAM user does not have Multi-Factor Authentication (MFA) enabled, increasing risk of unauthorized access.

**Trigger Conditions:**
- IAM user with `mfa_enabled: false`

**Remediation:**
Enable MFA for all IAM users, especially those with console access or administrative privileges.

---

#### `old_access_key`
**Severity:** MEDIUM

**Description:** IAM access key is older than 90 days, exceeding AWS security best practice recommendations.

**Trigger Conditions:**
- Access key created more than 90 days ago

**Remediation:**
Rotate the access key by creating a new key, updating applications, and then deactivating/deleting the old key.

---

#### `unused_access_key`
**Severity:** LOW

**Description:** IAM access key has not been used for an extended period or has never been used.

**Trigger Conditions:**
- Active access key never used (after 7-day grace period)
- Active access key not used in 90+ days

**Remediation:**
Delete the access key if no longer needed. Unused active keys pose a security risk.

---

#### `unused_iam_role`
**Severity:** LOW

**Description:** IAM role has not been assumed for an extended period.

**Trigger Conditions:**
- Role created 90+ days ago and never used
- Role not used in 90+ days

**Remediation:**
Delete the role if no longer needed. Unused roles increase the attack surface.

---

#### `root_account_usage`
**Severity:** CRITICAL

**Description:** AWS root account has been used recently or does not have MFA enabled.

**Trigger Conditions:**
- Root account activity detected in recent CloudTrail logs
- Root account MFA not enabled

**Remediation:**
- Enable MFA on the root account
- Create IAM users for day-to-day operations
- Use root only for tasks that require root privileges

---

#### `overly_permissive_policy`
**Severity:** HIGH

**Description:** IAM policy grants overly broad permissions (e.g., `*:*` or admin access).

**Trigger Conditions:**
- Policy contains `Action: "*"` with `Resource: "*"`
- Policy grants `AdministratorAccess`

**Remediation:**
Apply the principle of least privilege. Grant only the specific permissions required.

---

#### `cross_account_trust`
**Severity:** HIGH

**Description:** IAM role trusts external AWS accounts without proper conditions.

**Trigger Conditions:**
- Role trust policy allows assumption from external accounts
- No `Condition` clause restricting external access

**Remediation:**
Add conditions to the trust policy (e.g., `ExternalId`, `SourceArn`, or `SourceAccount`) to prevent confused deputy attacks.

---

### Compliance Findings

#### `ssl_expiry`
**Severity:** CRITICAL (<7 days or expired) / MEDIUM (7-30 days) / LOW (30-60 days)

**Description:** SSL/TLS certificate is expiring soon or has already expired.

**Trigger Conditions:**
- Certificate expires in less than 60 days
- Certificate has already expired

**Remediation:**
- **ACM certificates:** Verify domain validation is working for auto-renewal
- **Other certificates:** Renew the certificate before expiration

---

#### `data_residency_violation`
**Severity:** HIGH

**Description:** Resource is located in a region that violates data residency requirements.

**Trigger Conditions:**
- Resource exists in a non-approved region based on organization's data residency policy

**Remediation:**
Migrate the resource to an approved region or obtain necessary approvals for the current location.

---

#### `cloudtrail_disabled`
**Severity:** HIGH

**Description:** CloudTrail logging is not enabled, preventing audit trail of AWS API calls.

**Trigger Conditions:**
- No active CloudTrail trail in the account/region
- Trail exists but is not logging

**Remediation:**
Enable CloudTrail with multi-region logging and S3 log file validation.

---

#### `vpc_flow_logs_disabled`
**Severity:** MEDIUM

**Description:** VPC Flow Logs are not configured, limiting network traffic visibility.

**Trigger Conditions:**
- VPC has no associated flow log

**Remediation:**
Enable VPC Flow Logs to capture network traffic for security analysis and troubleshooting.

---

#### `backup_not_configured`
**Severity:** MEDIUM

**Description:** Critical resources do not have AWS Backup plans configured.

**Trigger Conditions:**
- RDS instance, EBS volume, or other critical resource not included in any backup plan

**Remediation:**
Create an AWS Backup plan and add the resource to ensure regular backups.

---

### Cost Optimization Findings

#### `orphaned_volume`
**Severity:** MEDIUM

**Description:** EBS volume is not attached to any EC2 instance, incurring unnecessary storage costs.

**Trigger Conditions:**
- EBS volume with state `available` (not `in-use`)

**Remediation:**
- If data is needed, attach to an instance or create a snapshot
- Delete the volume if no longer needed

---

#### `orphaned_eip`
**Severity:** LOW

**Description:** Elastic IP address is not associated with any resource.

**Trigger Conditions:**
- EIP not associated with an EC2 instance or NAT gateway

**Remediation:**
Release the EIP if no longer needed. Unassociated EIPs incur hourly charges.

---

#### `orphaned_snapshot`
**Severity:** LOW

**Description:** EBS snapshot's source volume no longer exists.

**Trigger Conditions:**
- Snapshot references a volume ID that no longer exists

**Remediation:**
Delete the snapshot if the data is no longer needed. Keep if it serves as a backup.

---

#### `unused_resource`
**Severity:** LOW

**Description:** Resource (Lambda, Secret) hasn't been accessed or modified recently.

**Trigger Conditions:**
- Lambda function not modified in 90+ days
- Secret not accessed in 90+ days

**Remediation:**
Review the resource and delete if no longer needed to reduce costs and attack surface.

---

#### `stopped_instance`
**Severity:** LOW

**Description:** EC2 instance has been in stopped state for an extended period.

**Trigger Conditions:**
- EC2 instance stopped for 7+ days

**Remediation:**
- If needed later: Create an AMI and terminate the instance
- If not needed: Terminate the instance
- Note: Stopped instances still incur EBS storage costs

---

#### `unused_log_group`
**Severity:** TRIVIAL

**Description:** CloudWatch Logs group has high storage usage with no retention policy.

**Trigger Conditions:**
- Log group with 100+ MB stored
- Created 30+ days ago
- No retention policy configured

**Remediation:**
Set a retention policy to automatically delete old logs, or delete the log group if no longer needed.

---

#### `idle_nat_gateway`
**Severity:** LOW

**Description:** NAT Gateway has minimal or no traffic but continues to incur hourly charges.

**Trigger Conditions:**
- NAT Gateway with very low data processing metrics

**Remediation:**
Consider using NAT instances for low-traffic scenarios, or consolidate NAT Gateways.

---

#### `oversized_instance`
**Severity:** LOW

**Description:** EC2 instance is significantly underutilized based on CPU/memory metrics.

**Trigger Conditions:**
- Average CPU utilization below 10% over extended period
- Memory utilization consistently low

**Remediation:**
Rightsize the instance to a smaller instance type that matches actual usage.

---

### Tagging Findings

#### `missing_tag`
**Severity:** TRIVIAL

**Description:** Resource is missing required organizational tags.

**Trigger Conditions:**
- Resource lacks one or more tags from the configured required tags list
- Default required tags: `Environment`, `Owner`, `CostCenter`

**Remediation:**
Add the missing tags to the resource. Proper tagging enables cost allocation, security policies, and resource management.

---

## Summary Table

| Finding Type | Category | Default Severity |
|--------------|----------|------------------|
| `ssl_expiry` | Compliance | CRITICAL/MEDIUM/LOW |
| `publicly_accessible_rds` | Security | CRITICAL |
| `public_snapshot` | Security | CRITICAL |
| `root_account_usage` | IAM | CRITICAL |
| `user_without_mfa` | IAM | HIGH |
| `public_access` | Security | HIGH |
| `permissive_security_group` | Security | HIGH |
| `open_all_ports` | Security | HIGH |
| `data_residency_violation` | Compliance | HIGH |
| `overly_permissive_policy` | IAM | HIGH |
| `cloudtrail_disabled` | Compliance | HIGH |
| `cross_account_trust` | IAM | HIGH |
| `unencrypted_resource` | Security | MEDIUM/LOW |
| `old_access_key` | IAM | MEDIUM |
| `orphaned_volume` | Cost | MEDIUM |
| `insecure_tls` | Security | MEDIUM |
| `vpc_flow_logs_disabled` | Compliance | MEDIUM |
| `backup_not_configured` | Compliance | MEDIUM |
| `orphaned_eip` | Cost | LOW |
| `orphaned_snapshot` | Cost | LOW |
| `unused_access_key` | IAM | LOW |
| `unused_iam_role` | IAM | LOW |
| `unused_resource` | Cost | LOW |
| `stopped_instance` | Cost | LOW |
| `idle_nat_gateway` | Cost | LOW |
| `oversized_instance` | Cost | LOW |
| `missing_tag` | Tagging | TRIVIAL |
| `unused_log_group` | Cost | TRIVIAL |
