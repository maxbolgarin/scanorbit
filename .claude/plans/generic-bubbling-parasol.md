# Plan: Update IAM Policy with All Required Scanner Permissions

## Problem
The current IAM policy in `PolicyGuide.tsx` is missing permissions required by various scanners, causing `AccessDenied` errors during scans.

## Scanner Analysis Results

Based on exploration of `workers/internal/awsclient/`, here are all 11 scanners and their required AWS API operations:

| Scanner | AWS Service | API Operations |
|---------|-------------|----------------|
| EC2Scanner | EC2, EBS, EIP | DescribeInstances, DescribeVolumes, DescribeAddresses, DescribeRegions |
| SecurityGroupScanner | EC2 | DescribeSecurityGroups |
| RDSScanner | RDS | DescribeDBInstances, DescribeDBSnapshots |
| S3Scanner | S3 | ListBuckets, GetBucketLocation |
| IAMScanner | IAM | ListUsers, ListUserTags, ListMFADevices, ListRoles, ListRoleTags, GetRole, ListAccessKeys, GetAccessKeyLastUsed |
| LambdaScanner | Lambda | ListFunctions, ListTags |
| ALBScanner | ELBv2 | DescribeLoadBalancers, DescribeTags |
| ACMScanner | ACM | ListCertificates, DescribeCertificate |
| KMSScanner | KMS | ListKeys, DescribeKey, ListResourceTags, GetKeyRotationStatus |
| SecretsManagerScanner | Secrets Manager | ListSecrets |
| CloudWatchScanner | CloudWatch + Logs | DescribeLogGroups, DescribeAlarms, ListTagsForResource |

## Optimized IAM Policy

Using wildcards where appropriate to keep policy concise:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ec2:Describe*",
        "rds:Describe*",
        "s3:ListAllMyBuckets",
        "s3:GetBucketLocation",
        "elasticloadbalancing:Describe*",
        "acm:List*",
        "acm:Describe*",
        "lambda:ListFunctions",
        "lambda:ListTags",
        "kms:ListKeys",
        "kms:DescribeKey",
        "kms:ListResourceTags",
        "kms:GetKeyRotationStatus",
        "secretsmanager:ListSecrets",
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
        "iam:GetAccessKeyLastUsed"
      ],
      "Resource": "*"
    }
  ]
}
```

## File to Modify

| File | Change |
|------|--------|
| `apps/app/src/components/onboarding/PolicyGuide.tsx` | Replace `getPermissionPolicy()` with optimized policy above |

## Verification

1. Update the policy in `PolicyGuide.tsx`
2. User must update their AWS IAM policy `ScanOrbitReadOnlyPolicy` with the new permissions
3. Run a scan and verify no `AccessDenied` errors in scanner logs:
   ```bash
   docker logs scanorbit-scanner --tail 50 2>&1 | grep -i "accessdenied\|403"
   ```
4. Verify scan completes with status "complete" (not "partial")
