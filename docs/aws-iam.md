# AWS IAM permissions

ScanOrbit's scanner connects to each AWS account through a read-only IAM
role that it assumes with STS. You create the role; ScanOrbit assumes it
with an external ID generated per-account in the UI.

## Minimal read-only policy

Attach this policy to the role you create in each scanned account. It
covers every API call the scanner currently makes — no write actions, no
listing of object data.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ScanOrbitReadOnly",
      "Effect": "Allow",
      "Action": [
        "acm:DescribeCertificate",
        "acm:ListCertificates",
        "cloudwatch:DescribeAlarms",
        "cloudwatch:ListTagsForResource",
        "ec2:DescribeAddresses",
        "ec2:DescribeInstances",
        "ec2:DescribeNatGateways",
        "ec2:DescribeNetworkInterfaces",
        "ec2:DescribeRegions",
        "ec2:DescribeSecurityGroups",
        "ec2:DescribeVolumes",
        "elasticloadbalancing:DescribeLoadBalancers",
        "elasticloadbalancing:DescribeTags",
        "elasticloadbalancing:DescribeTargetGroups",
        "elasticloadbalancing:DescribeTargetHealth",
        "iam:GetAccessKeyLastUsed",
        "iam:GetLoginProfile",
        "iam:GetRole",
        "iam:ListAccessKeys",
        "iam:ListMFADevices",
        "iam:ListRoleTags",
        "iam:ListRoles",
        "iam:ListUserTags",
        "iam:ListUsers",
        "kms:DescribeKey",
        "kms:GetKeyRotationStatus",
        "kms:ListKeys",
        "kms:ListResourceTags",
        "lambda:ListFunctions",
        "lambda:ListTags",
        "rds:DescribeDBInstances",
        "rds:DescribeDBSnapshots",
        "s3:GetBucketEncryption",
        "s3:GetBucketLocation",
        "s3:ListAllMyBuckets",
        "secretsmanager:ListSecrets"
      ],
      "Resource": "*"
    }
  ]
}
```

AWS's managed `ReadOnlyAccess` and `SecurityAudit` policies are valid
supersets if you'd rather not maintain a custom policy — but they grant
much more than ScanOrbit actually uses.

## Trust policy

The role's trust policy controls who can assume it. For a self-hosted
ScanOrbit running on EC2, ECS or EKS, use the host's role as the
principal. For ScanOrbit running outside AWS (your laptop, a non-AWS VPS),
use an IAM user with `sts:AssumeRole` permission.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::<scanorbit-host-account-id>:root"
      },
      "Action": "sts:AssumeRole",
      "Condition": {
        "StringEquals": {
          "sts:ExternalId": "<external-id-from-scanorbit-ui>"
        }
      }
    }
  ]
}
```

The external ID is generated when you add the account in
**Settings → AWS accounts**. It's stored encrypted in the database
(`OAUTH_ENCRYPTION_KEY`) and prevents the
[confused-deputy problem](https://docs.aws.amazon.com/IAM/latest/UserGuide/confused-deputy.html).

## Multi-account scanning

For an AWS Organization, create the role in each member account (CloudFormation
StackSets makes this a one-shot). The role name doesn't have to match across
accounts; ScanOrbit stores the role ARN per-account.

## Credentials for the scanner host

The scanner container itself needs credentials that are allowed to call
`sts:AssumeRole`. Set `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` in
`.env`, or attach an IAM role to the host (EC2/ECS task role) and leave
those env vars empty — the AWS SDK will pick up the host's credentials
automatically.
