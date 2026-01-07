# ScanOrbit Battle Test Setup Guide

## Complete Terraform Setup for Testing ScanOrbit

**Last Updated:** January 7, 2026

This guide explains how to create a test AWS infrastructure specifically designed for battle-testing ScanOrbit. The infrastructure will include intentionally "messy" resources that ScanOrbit should detect and flag.

---

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Architecture](#architecture)
4. [Setup Steps](#setup-steps)
5. [Terraform Configuration](#terraform-configuration)
6. [Running the Test](#running-the-test)
7. [Expected Findings](#expected-findings)
8. [Cleanup](#cleanup)

---

## Overview

### What This Creates

A test AWS infrastructure with:

**Intentional Issues (for ScanOrbit to find):**
- ❌ Orphaned EBS volumes (unattached, costing money)
- ❌ Untagged EC2 instances (governance issue)
- ❌ Unused Elastic IPs (cost waste)
- ❌ Resources in non-EU regions (GDPR violation)
- ❌ Misconfigured security groups (security issue)
- ❌ Old EBS snapshots (cost waste)
- ❌ Untagged S3 buckets (compliance issue)

**Proper Resources (for comparison):**
- ✅ Properly tagged EC2 instances
- ✅ Attached EBS volumes with clear purpose
- ✅ EU-region only resources
- ✅ Secure security groups
- ✅ Active resources with clear naming

### Why This Matters

By deploying intentionally "messy" infrastructure, you can:
1. **Test ScanOrbit's detection** - Does it find the issues you created?
2. **Verify accuracy** - Are false positives minimal?
3. **Check severity levels** - Does it prioritize correctly?
4. **Measure performance** - How long does a scan take?
5. **Validate recommendations** - Are fixes practical?

---

## Prerequisites

### Required Software

```bash
# 1. Terraform (>= 1.0)
terraform --version

# 2. AWS CLI v2
aws --version

# 3. AWS account with permissions to create resources
# Required IAM permissions:
# - EC2 full access (ec2:*)
# - EBS full access (elasticvolume:*)
# - VPC full access (ec2:*)
# - S3 full access (s3:*)
```

### AWS Account Setup

1. **Create a dedicated AWS account for testing** (or use non-production)
2. **Set up AWS credentials:**

```bash
# Option 1: AWS CLI configuration
aws configure --profile scanorbit-test
# Enter: Access Key ID, Secret Access Key, Region (eu-central-1), Format (json)

# Option 2: Environment variables
export AWS_ACCESS_KEY_ID=your-access-key
export AWS_SECRET_ACCESS_KEY=your-secret-key
export AWS_REGION=eu-central-1
```

3. **Create IAM role for ScanOrbit** (for later scanning):
   - See Terms of Service `/terms` for required permissions
   - Save the role ARN

---

## Architecture

### What Gets Deployed

```
┌──────────────────────────────────────────────────────┐
│ AWS Account (eu-central-1 primary, us-east-1 test)  │
├──────────────────────────────────────────────────────┤
│                                                      │
│ VPC (EU region)                                      │
│ ├─ Security Group (misconfigured - 0.0.0.0/0)      │
│ ├─ EC2 Instance 1 (tagged, active)                 │
│ ├─ EC2 Instance 2 (untagged, unused)               │
│ ├─ EBS Volume 1 (attached to Instance 1)           │
│ ├─ EBS Volume 2 (orphaned, unattached)             │
│ ├─ EBS Snapshot 1 (old, from 6 months ago)         │
│ ├─ Elastic IP 1 (associated)                        │
│ └─ Elastic IP 2 (unassociated - unused)            │
│                                                      │
│ S3 Buckets                                           │
│ ├─ Bucket 1 (tagged, versioning enabled)           │
│ ├─ Bucket 2 (untagged, no versioning)              │
│ └─ Bucket 3 (in us-east-1 - GDPR issue)           │
│                                                      │
└──────────────────────────────────────────────────────┘
```

### Cost Estimate

**Monthly cost of this infrastructure:**
- EC2 instances: ~$20-30 (if left running for a month)
- EBS volumes: ~$5-10
- EBS snapshots: ~$2-5
- Elastic IPs: ~$1-2 (unused ones)
- S3 buckets: ~$0.50

**Total: ~$30-50/month if left running continuously**

⚠️ **Recommendation:** Deploy, test, destroy immediately. Don't leave running.

---

## Setup Steps

### Step 1: Create Project Directory

```bash
mkdir scanorbit-test-infra
cd scanorbit-test-infra
git init

# Create subdirectories
mkdir terraform
mkdir scripts
```

### Step 2: Create Terraform Files

You'll create 4 files in the `terraform/` directory:
1. `main.tf` - Resource definitions
2. `variables.tf` - Input variables
3. `outputs.tf` - Output values
4. `terraform.tfvars` - Test values

### Step 3: Initialize Terraform

```bash
cd terraform
terraform init
```

This downloads AWS provider plugins.

### Step 4: Review and Deploy

```bash
# See what will be created
terraform plan

# Deploy (requires confirmation)
terraform apply

# Terraform will output resource IDs
```

### Step 5: Connect ScanOrbit

```bash
# Copy the output values
# Provide AWS account ID to ScanOrbit
# Grant ScanOrbit the IAM role permission
# Run a scan
```

### Step 6: Verify Findings

Check that ScanOrbit detected:
- Orphaned volumes
- Untagged resources
- Unused Elastic IPs
- Non-EU regions
- Misconfigured security

### Step 7: Cleanup

```bash
terraform destroy
```

---

## Terraform Configuration

### File 1: main.tf

```hcl
# Configure AWS provider
terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Environment = "test"
      CreatedBy   = "Terraform"
      Purpose     = "ScanOrbit Battle Test"
      CreatedAt   = timestamp()
    }
  }
}

# Local variables
locals {
  common_tags = {
    Project     = "ScanOrbit-Test"
    ManagedBy   = "Terraform"
    Cost-Center = "Engineering"
  }
}

# ============================================================================
# VPC & Network
# ============================================================================

resource "aws_vpc" "test" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = merge(local.common_tags, {
    Name = "scanorbit-test-vpc"
  })
}

resource "aws_subnet" "test" {
  vpc_id            = aws_vpc.test.id
  cidr_block        = "10.0.1.0/24"
  availability_zone = data.aws_availability_zones.available.names[0]

  tags = merge(local.common_tags, {
    Name = "scanorbit-test-subnet"
  })
}

data "aws_availability_zones" "available" {
  state = "available"
}

# ============================================================================
# Security Group (INTENTIONALLY MISCONFIGURED)
# ============================================================================

resource "aws_security_group" "test_open" {
  name_prefix = "scanorbit-test-open-"
  description = "Intentionally misconfigured SG for testing (OPEN TO WORLD)"
  vpc_id      = aws_vpc.test.id

  # ❌ BAD: Open to world
  ingress {
    from_port   = 0
    to_port     = 65535
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Intentionally open - should be flagged"
  }

  # ❌ BAD: Unrestricted outbound
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Unrestricted outbound"
  }

  tags = merge(local.common_tags, {
    Name = "scanorbit-test-sg-open"
  })
}

# ============================================================================
# EC2 Instances
# ============================================================================

# Instance 1: GOOD - Tagged, active, clear purpose
resource "aws_instance" "web_server" {
  ami                    = data.aws_ami.ubuntu.id
  instance_type          = "t3.micro"
  subnet_id              = aws_subnet.test.id
  vpc_security_group_ids = [aws_security_group.test_open.id]

  tags = merge(local.common_tags, {
    Name     = "scanorbit-test-web-server"
    Role     = "WebServer"
    Team     = "Platform"
    CostCode = "ENG-001"
  })
}

# Instance 2: BAD - Untagged, unused
resource "aws_instance" "orphaned" {
  ami                    = data.aws_ami.ubuntu.id
  instance_type          = "t3.micro"
  subnet_id              = aws_subnet.test.id
  vpc_security_group_ids = [aws_security_group.test_open.id]

  tags = {
    Name = "orphaned-instance-for-testing"
    # NO other tags - should trigger "untagged resource" finding
  }
}

# Get latest Ubuntu AMI
data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"] # Canonical

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd/ubuntu-focal-20.04-amd64-server-*"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

# ============================================================================
# EBS Volumes
# ============================================================================

# Volume 1: GOOD - Attached to instance
resource "aws_ebs_volume" "attached" {
  availability_zone = data.aws_availability_zones.available.names[0]
  size              = 10
  type              = "gp3"

  tags = merge(local.common_tags, {
    Name   = "scanorbit-test-volume-attached"
    Status = "InUse"
  })
}

resource "aws_volume_attachment" "attached" {
  device_name = "/dev/sdf"
  volume_id   = aws_ebs_volume.attached.id
  instance_id = aws_instance.web_server.id
}

# Volume 2: BAD - Orphaned (not attached)
resource "aws_ebs_volume" "orphaned" {
  availability_zone = data.aws_availability_zones.available.names[0]
  size              = 50
  type              = "gp3"

  tags = {
    Name = "orphaned-volume-for-testing"
    # Intentionally orphaned - no attachment
  }
}

# ============================================================================
# EBS Snapshots
# ============================================================================

# Snapshot 1: Recent - GOOD
resource "aws_ebs_snapshot" "recent" {
  volume_id = aws_ebs_volume.attached.id

  tags = merge(local.common_tags, {
    Name = "scanorbit-test-snapshot-recent"
    Age  = "Current"
  })
}

# Snapshot 2: Old (simulated) - Should be cleaned up
resource "aws_ebs_snapshot" "old" {
  volume_id = aws_ebs_volume.orphaned.id

  tags = {
    Name = "scanorbit-test-snapshot-old"
    Note = "Old snapshot from 6+ months ago - should delete"
  }
}

# ============================================================================
# Elastic IPs
# ============================================================================

# Elastic IP 1: GOOD - Associated
resource "aws_eip" "associated" {
  domain   = "vpc"
  instance = aws_instance.web_server.id

  tags = merge(local.common_tags, {
    Name   = "scanorbit-test-eip-associated"
    Status = "InUse"
  })

  depends_on = [aws_internet_gateway.test]
}

# Elastic IP 2: BAD - Unassociated (costs money, doing nothing)
resource "aws_eip" "unassociated" {
  domain = "vpc"

  tags = {
    Name = "scanorbit-test-eip-unassociated"
    Note = "Unassociated EIP - should be released"
  }

  depends_on = [aws_internet_gateway.test]
}

# Internet Gateway (needed for EIPs)
resource "aws_internet_gateway" "test" {
  vpc_id = aws_vpc.test.id

  tags = merge(local.common_tags, {
    Name = "scanorbit-test-igw"
  })
}

# ============================================================================
# S3 Buckets
# ============================================================================

# Bucket 1: GOOD - Tagged, versioning enabled, EU region
resource "aws_s3_bucket" "good" {
  bucket_prefix = "scanorbit-test-good-"
}

resource "aws_s3_bucket_versioning" "good" {
  bucket = aws_s3_bucket.good.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_tagging" "good" {
  bucket = aws_s3_bucket.good.id
  tagging {
    tags = merge(local.common_tags, {
      Name     = "scanorbit-test-bucket-good"
      Team     = "Platform"
      CostCode = "ENG-001"
    })
  }
}

# Bucket 2: BAD - Untagged, no versioning
resource "aws_s3_bucket" "untagged" {
  bucket_prefix = "scanorbit-test-untagged-"
}

# Bucket 3: BAD - In non-EU region (GDPR violation!)
resource "aws_s3_bucket" "us_region" {
  provider      = aws.us_east_1
  bucket_prefix = "scanorbit-test-us-"
}

# Create alias providers for multi-region
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"

  default_tags {
    tags = {
      Environment = "test"
      CreatedBy   = "Terraform"
      Purpose     = "ScanOrbit Battle Test"
    }
  }
}

# ============================================================================
# Outputs
# ============================================================================

output "aws_account_id" {
  description = "AWS Account ID"
  value       = data.aws_caller_identity.current.account_id
}

output "region" {
  description = "AWS Region"
  value       = var.aws_region
}

output "vpc_id" {
  description = "VPC ID"
  value       = aws_vpc.test.id
}

output "web_server_id" {
  description = "Web Server EC2 Instance ID"
  value       = aws_instance.web_server.id
}

output "orphaned_instance_id" {
  description = "Orphaned EC2 Instance ID (untagged)"
  value       = aws_instance.orphaned.id
}

output "orphaned_volume_id" {
  description = "Orphaned EBS Volume ID (unattached)"
  value       = aws_ebs_volume.orphaned.id
}

output "unassociated_eip" {
  description = "Unassociated Elastic IP (unused, costs money)"
  value       = aws_eip.unassociated.public_ip
}

output "misconfigured_sg_id" {
  description = "Misconfigured Security Group (0.0.0.0/0)"
  value       = aws_security_group.test_open.id
}

output "scan_instructions" {
  description = "Instructions for scanning with ScanOrbit"
  value       = <<-EOT
    
    ========================================
    SCANORBIT BATTLE TEST INFRASTRUCTURE
    ========================================
    
    Infrastructure deployed successfully!
    
    Next steps:
    1. Create IAM Role in AWS Console:
       - Name: ScanOrbitTestRole
       - Trust: Your ScanOrbit AWS account
       - Permissions: See /terms for required policy
    
    2. Configure ScanOrbit:
       - Account ID: ${data.aws_caller_identity.current.account_id}
       - Role ARN: arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/ScanOrbitTestRole
    
    3. Run ScanOrbit scan and verify findings:
       ✓ Untagged instance: ${aws_instance.orphaned.id}
       ✓ Orphaned volume: ${aws_ebs_volume.orphaned.id}
       ✓ Unused EIP: ${aws_eip.unassociated.public_ip}
       ✓ Misconfigured SG: ${aws_security_group.test_open.id}
       ✓ Untagged S3 bucket
       ✓ US region bucket (GDPR issue)
    
    4. Cleanup:
       terraform destroy
    
    ========================================
  EOT
}

data "aws_caller_identity" "current" {}
```

### File 2: variables.tf

```hcl
variable "aws_region" {
  description = "AWS region for test infrastructure"
  type        = string
  default     = "eu-central-1"

  validation {
    condition     = startswith(var.aws_region, "eu-")
    error_message = "Region must be in EU (eu-*) to test GDPR compliance."
  }
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "test"
}

variable "project_name" {
  description = "Project name for tagging"
  type        = string
  default     = "scanorbit-battle-test"
}
```

### File 3: outputs.tf

Already included in main.tf above.

### File 4: terraform.tfvars

```hcl
aws_region   = "eu-central-1"
environment  = "test"
project_name = "scanorbit-battle-test"
```

---

## Running the Test

### Step 1: Initialize

```bash
cd terraform
terraform init
```

### Step 2: Review

```bash
terraform plan
```

**Expected output:** Shows 15+ resources to be created

### Step 3: Deploy

```bash
terraform apply
```

**Confirm by typing: `yes`**

### Step 4: Note Outputs

```
Outputs:

aws_account_id = "123456789012"
orphaned_instance_id = "i-0123456789abcdef0"
orphaned_volume_id = "vol-0123456789abcdef0"
region = "eu-central-1"
unassociated_eip = "1.2.3.4"
...
```

### Step 5: Create IAM Role

In AWS Console:
1. IAM → Roles → Create role
2. Custom trust policy → Paste ScanOrbit's AWS account
3. Add permissions from `/terms` on your website
4. Name: `ScanOrbitTestRole`

### Step 6: Configure ScanOrbit

In ScanOrbit UI:
1. Add AWS Account
2. Account ID: From terraform output
3. Role ARN: `arn:aws:iam::123456789012:role/ScanOrbitTestRole`
4. External ID: (generate random value)

### Step 7: Run Scan

Click "Start Scan" and wait 2-5 minutes.

### Step 8: Verify Findings

ScanOrbit should find:

```
Untagged Resources:
✓ EC2 Instance: orphaned-instance-for-testing
✓ S3 Bucket: scanorbit-test-untagged-xxxxx

Orphaned Resources:
✓ EBS Volume: orphaned-volume-for-testing (vol-xxxxx)
✓ Elastic IP: 1.2.3.4 (unassociated)

Security Issues:
✓ Security Group: sg-xxxxx (0.0.0.0/0 ingress)

Compliance Issues:
✓ S3 Bucket in us-east-1 (GDPR violation - data outside EU)
```

---

## Expected Findings

### What ScanOrbit Should Find

| Issue | Resource | Severity | Expected |
|-------|----------|----------|----------|
| Untagged | Instance (orphaned-xxx) | Medium | ✅ |
| Untagged | S3 Bucket (untagged-xxx) | Medium | ✅ |
| Orphaned | EBS Volume (vol-xxxx) | Medium | ✅ |
| Orphaned | Elastic IP (1.2.3.4) | Low | ✅ |
| Misconfigured | Security Group (0.0.0.0/0) | High | ✅ |
| Compliance | S3 in us-east-1 | High | ✅ |
| Cost Waste | Unused EIP + orphaned volume | Medium | ✅ |

### What ScanOrbit Should NOT Flag

| Resource | Reason |
|----------|--------|
| Web server instance | Properly tagged |
| Attached EBS volume | Has clear purpose |
| Associated EIP | In use |
| Good S3 bucket | Tagged, EU region |
| Recent snapshot | Current, not old |

---

## Cleanup

### Option 1: Terraform Destroy

```bash
cd terraform
terraform destroy
```

Type `yes` to confirm. All resources deleted in ~5 minutes.

### Option 2: Manual (if terraform destroy fails)

```bash
# List what was created
terraform show

# Identify resource IDs and delete manually in AWS Console
```

### Verify Cleanup

```bash
# Should show no managed resources
terraform show

# AWS CLI check
aws ec2 describe-instances --filters "Name=tag:Purpose,Values=ScanOrbit*"
```

---

## Troubleshooting

### Error: "AWS credentials not configured"

```bash
# Configure credentials
aws configure --profile scanorbit-test

# Or set environment variables
export AWS_ACCESS_KEY_ID=xxxxx
export AWS_SECRET_ACCESS_KEY=xxxxx
export AWS_REGION=eu-central-1
```

### Error: "Permission denied creating resource"

Check IAM permissions. Need:
- `ec2:*`
- `elasticvolume:*`
- `s3:*`

### Error: "Bucket name already exists"

S3 bucket names are globally unique. Terraform uses random suffixes, but if collision occurs:

```bash
# Destroy and retry
terraform destroy
terraform apply
```

### Resources not appearing in ScanOrbit

1. Verify IAM role trust relationship
2. Check ScanOrbit can assume the role
3. Verify External ID matches
4. Give 2-5 minutes for initial scan
5. Check CloudTrail for API call logs

---

## Next Steps

After successful test:

1. **Analyze ScanOrbit findings**
   - Did it catch all intentional issues?
   - Any false positives?
   - Severity levels accurate?

2. **Test recommendations**
   - Try fixing issues per ScanOrbit recommendations
   - Verify fixes work as expected

3. **Performance testing**
   - Measure scan duration
   - Check API call volume
   - Monitor false positive rate

4. **Scale testing**
   - Increase resource count
   - Test with 100+ resources
   - Measure performance at scale

5. **Production readiness**
   - Document findings
   - Create runbooks for common issues
   - Plan rollout to production accounts

---

## Security Notes

⚠️ **Important:**
- This test infrastructure is intentionally insecure
- Never use in production
- Destroy immediately after testing
- Don't leave running for extended periods
- Delete all resources to avoid unexpected AWS bills

---

## Cost Summary

| Resource | Hourly | Daily | Monthly |
|----------|--------|-------|---------|
| 2x t3.micro | $0.01 | $0.24 | $7 |
| 2x 50GB EBS | $0.10 | $2.40 | $75 |
| 2x EIP | $0.01 | $0.24 | $7 |
| S3 buckets | <$0.01 | <$0.01 | <$1 |
| **Total** | **$0.12** | **$2.88** | **~$90** |

⚠️ **If left running a full month, expect ~$90 AWS bill**
✅ **Recommended:** Deploy, test (30 mins), destroy

---

**Version:** 1.0
**Created:** January 7, 2026
**Purpose:** ScanOrbit Battle Testing Guide
