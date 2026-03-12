import type { FindingType } from "@/types";

/**
 * Structured remediation steps for each finding type.
 * Used in FindingDetailModal and FindingsArticle.
 */
export const FINDING_REMEDIATIONS: Partial<Record<FindingType, string[]>> = {
  // Security
  unencrypted_resource: [
    "EBS: Create an encrypted snapshot and restore to a new encrypted volume",
    "RDS: Create an encrypted snapshot and restore to a new encrypted instance (encryption must be enabled at creation time)",
  ],
  public_access: [
    "Enable all Block Public Access settings unless public access is explicitly required for the use case",
  ],
  permissive_security_group: [
    "Restrict access to specific IP ranges or use a VPN/bastion host for administrative access",
  ],
  open_all_ports: [
    "Restrict inbound rules to only the specific ports and IP ranges required for your application",
  ],
  publicly_accessible_rds: [
    "Disable public accessibility and access the database through a VPN, bastion host, or VPC peering",
  ],
  public_snapshot: [
    "Remove public permissions from the snapshot",
    "If sharing is required, use specific AWS account IDs",
  ],
  insecure_tls: [
    "Update the security policy to use TLS 1.2 or higher with modern cipher suites",
  ],

  // IAM
  user_without_mfa: [
    "Enable MFA for all IAM users, especially those with console access or administrative privileges",
  ],
  old_access_key: [
    "Rotate the access key by creating a new key, updating applications, and then deactivating/deleting the old key",
  ],
  unused_access_key: [
    "Delete the access key if no longer needed. Unused active keys pose a security risk",
  ],
  unused_iam_role: [
    "Delete the role if no longer needed. Unused roles increase the attack surface",
  ],
  root_account_usage: [
    "Enable MFA on the root account",
    "Create IAM users for day-to-day operations",
    "Use root only for tasks that require root privileges",
  ],
  overly_permissive_policy: [
    "Apply the principle of least privilege. Grant only the specific permissions required",
  ],
  cross_account_trust: [
    "Add conditions to the trust policy (e.g., ExternalId, SourceArn, or SourceAccount) to prevent confused deputy attacks",
  ],

  // Compliance
  ssl_expiry: [
    "ACM certificates: Verify domain validation is working for auto-renewal",
    "Other certificates: Renew the certificate before expiration",
  ],
  data_residency_violation: [
    "Migrate the resource to an approved region or obtain necessary approvals for the current location",
  ],
  cloudtrail_disabled: [
    "Enable CloudTrail with multi-region logging and S3 log file validation",
  ],
  vpc_flow_logs_disabled: [
    "Enable VPC Flow Logs to capture network traffic for security analysis and troubleshooting",
  ],
  backup_not_configured: [
    "Create an AWS Backup plan and add the resource to ensure regular backups",
  ],

  // Cost / Orphans
  orphaned_volume: [
    "If data is needed, attach to an instance or create a snapshot",
    "Delete the volume if no longer needed",
  ],
  orphaned_eip: [
    "Release the EIP if no longer needed. Unassociated EIPs incur hourly charges",
  ],
  orphaned_snapshot: [
    "Delete the snapshot if the data is no longer needed. Keep if it serves as a backup",
  ],
  orphaned_eni: [
    "Delete the ENI if no longer needed. Orphaned ENIs may indicate incomplete resource cleanup",
  ],
  idle_load_balancer: [
    "If not needed: Delete the load balancer to reduce costs",
    "If needed: Register healthy targets or fix target health issues",
  ],
  unused_security_group: [
    "Delete unused security groups to reduce clutter and potential attack surface",
  ],
  unused_resource: [
    "Review the resource and delete if no longer needed to reduce costs and attack surface",
  ],
  stopped_instance: [
    "If needed later: Create an AMI and terminate the instance",
    "If not needed: Terminate the instance",
    "Note: Stopped instances still incur EBS storage costs",
  ],
  unused_log_group: [
    "Set a retention policy to automatically delete old logs, or delete the log group if no longer needed",
  ],
  idle_nat_gateway: [
    "Consider using NAT instances for low-traffic scenarios, or consolidate NAT Gateways",
  ],
  oversized_instance: [
    "Rightsize the instance to a smaller instance type that matches actual usage",
  ],
  ebs_optimization: [
    "Migrate GP2 volumes to GP3 for better price-performance",
    "Review provisioned IOPS requirements",
  ],
  old_gen_instance: [
    "Migrate to current generation instance types for better performance and cost efficiency",
  ],
  oversized_lambda: [
    "Reduce the memory allocation to match actual usage",
    "Use AWS Lambda Power Tuning for optimization",
  ],
  log_retention: [
    "Set an appropriate retention policy (e.g., 30, 90, or 365 days) based on compliance and debugging needs",
  ],
  unused_kms_key: [
    "Schedule key deletion if no longer needed (30-day waiting period required by AWS)",
  ],
  rds_optimization: [
    "Review Multi-AZ requirements",
    "Rightsize provisioned IOPS",
    "Enable storage autoscaling",
  ],
  old_gen_rds: [
    "Migrate to current generation RDS instance classes for better performance and cost efficiency",
  ],

  // Tagging
  missing_tag: [
    "Add the missing tags to the resource. Proper tagging enables cost allocation, security policies, and resource management",
  ],
};
