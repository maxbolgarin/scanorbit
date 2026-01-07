# ScanOrbit Test Infrastructure

Terraform configuration to deploy intentionally "messy" AWS infrastructure for battle-testing ScanOrbit.

## What Gets Deployed

### Intentional Issues (ScanOrbit should detect):
| Resource | Issue | Severity |
|----------|-------|----------|
| EC2 Instance | Untagged | Medium |
| EBS Volume | Orphaned (unattached) | Medium |
| Elastic IP | Unused (costs money) | Low |
| Security Group | Open to 0.0.0.0/0 | High |
| S3 Bucket | Untagged | Medium |
| S3 Bucket | In us-east-1 (GDPR violation) | High |

### Proper Resources (baseline):
- Tagged EC2 instance with attached EBS
- Associated Elastic IP
- Tagged S3 bucket in EU with versioning

## Quick Start

```bash
# 1. Configure AWS credentials
aws configure --profile scanorbit-test
# Or use environment variables

# 2. Initialize Terraform
terraform init

# 3. Review what will be created
terraform plan

# 4. Deploy (~15 resources)
terraform apply

# 5. Note the outputs for ScanOrbit testing

# 6. IMPORTANT: Destroy when done
terraform destroy
```

## IAM Permissions Required

Your AWS user/role needs the following permissions to run Terraform:

### Minimum Required Permissions

The Terraform configuration requires these IAM actions:

**EC2 Permissions:**
- `ec2:DescribeAvailabilityZones` - Query available AZs
- `ec2:DescribeImages` - Find Ubuntu AMI
- `ec2:*` - Create/manage EC2 instances, security groups, EBS volumes, snapshots, Elastic IPs

**VPC Permissions:**
- `ec2:CreateVpc`, `ec2:DeleteVpc`
- `ec2:CreateSubnet`, `ec2:DeleteSubnet`
- `ec2:CreateInternetGateway`, `ec2:AttachInternetGateway`, `ec2:DeleteInternetGateway`

**S3 Permissions:**
- `s3:CreateBucket`, `s3:DeleteBucket`
- `s3:PutBucketVersioning`, `s3:PutBucketPublicAccessBlock`
- `s3:ListAllMyBuckets`

**IAM Permissions:**
- `iam:GetUser` (for `aws_caller_identity` data source)

### Getting Permissions

**Important:** You typically cannot attach policies to your own IAM user. You'll need an AWS administrator to grant these permissions.

#### Option 1: Ask Your AWS Admin

Ask your AWS administrator to attach the **PowerUserAccess** managed policy to your user:

**Via AWS Console:**
1. IAM → Users → Select your user (`maxbolgarin`)
2. Add permissions → Attach policies directly
3. Search for `PowerUserAccess` and attach it

**Via AWS CLI (for admins):**
```bash
aws iam attach-user-policy \
  --user-name maxbolgarin \
  --policy-arn arn:aws:iam::aws:policy/PowerUserAccess
```

#### Option 2: Use AWS Console (if you have access)

If you have IAM console access but not CLI permissions:
1. Go to AWS Console → IAM → Users → Your user
2. Click "Add permissions" → "Attach policies directly"
3. Search and attach `PowerUserAccess`

#### Option 3: Custom Policy (for admins)

If your admin prefers least-privilege access, they can create and attach a custom policy (see example below).

### Custom Minimal Policy Example

If you prefer least-privilege access, create a policy like this:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ec2:*",
        "s3:*",
        "iam:GetUser"
      ],
      "Resource": "*"
    }
  ]
}
```

**Note:** This is a test environment, so broader permissions are acceptable. For production, use more restrictive policies.

### Troubleshooting: "AccessDenied" Errors

If you see errors like:
```
User: arn:aws:iam::316749727620:user/maxbolgarin is not authorized to perform: iam:AttachUserPolicy
```

This means you don't have permission to modify your own IAM user. You need to:
1. **Contact your AWS administrator** to grant the required permissions
2. **Use AWS Console** if you have web console access but not CLI permissions
3. **Use a different AWS account** if this is a personal test account where you have full admin access

### Verifying Your Permissions

Check what permissions you currently have:
```bash
# Check attached policies
aws iam list-attached-user-policies --user-name maxbolgarin

# Check inline policies
aws iam list-user-policies --user-name maxbolgarin

# Test EC2 access
aws ec2 describe-availability-zones --region eu-central-1
aws ec2 describe-images --owners 099720109477 --region eu-central-1
```

## Cost Warning

| Resource | Monthly Cost |
|----------|-------------|
| 2x t3.micro | ~$15 |
| EBS volumes | ~$5-10 |
| Unused EIP | ~$4 |
| S3 buckets | <$1 |
| **Total** | **~$25-30** |

**Destroy immediately after testing to avoid charges.**

## Verifying ScanOrbit Detection

After deploying, ScanOrbit should find:

```
Untagged Resources:
  EC2 Instance: orphaned-instance-for-testing

Orphaned Resources:
  EBS Volume: orphaned-volume-for-testing
  Elastic IP: (unassociated)

Security Issues:
  Security Group: 0.0.0.0/0 ingress rule

Compliance Issues:
  S3 Bucket in us-east-1 (GDPR violation)
```

## Files

- `main.tf` - All resources
- `variables.tf` - Input variables
- `terraform.tfvars` - Default values
- `.gitignore` - Ignore state files
