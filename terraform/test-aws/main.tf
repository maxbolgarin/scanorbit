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
    }
  }
}

# US East provider for GDPR violation testing
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

# Local variables
locals {
  common_tags = {
    Project     = "ScanOrbit-Test"
    ManagedBy   = "Terraform"
    Cost-Center = "Engineering"
  }
}

# Data sources
data "aws_caller_identity" "current" {}

data "aws_availability_zones" "available" {
  state = "available"
}

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

resource "aws_internet_gateway" "test" {
  vpc_id = aws_vpc.test.id

  tags = merge(local.common_tags, {
    Name = "scanorbit-test-igw"
  })
}

# ============================================================================
# Security Group (INTENTIONALLY MISCONFIGURED)
# ============================================================================

resource "aws_security_group" "test_open" {
  name_prefix = "scanorbit-test-open-"
  description = "Intentionally misconfigured SG for testing (OPEN TO WORLD)"
  vpc_id      = aws_vpc.test.id

  # BAD: Open to world - should be flagged by ScanOrbit
  ingress {
    from_port   = 0
    to_port     = 65535
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Intentionally open - should be flagged"
  }

  # BAD: Unrestricted outbound
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

# Instance 2: BAD - Untagged, unused - should trigger "untagged resource" finding
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

# Volume 2: BAD - Orphaned (not attached) - should trigger "orphaned_volume" finding
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

# ============================================================================
# S3 Buckets
# ============================================================================

# Bucket 1: GOOD - Tagged, versioning enabled, EU region
resource "aws_s3_bucket" "good" {
  bucket_prefix = "scanorbit-test-good-"

  tags = merge(local.common_tags, {
    Name     = "scanorbit-test-bucket-good"
    Team     = "Platform"
    CostCode = "ENG-001"
  })
}

resource "aws_s3_bucket_versioning" "good" {
  bucket = aws_s3_bucket.good.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_public_access_block" "good" {
  bucket = aws_s3_bucket.good.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Bucket 2: BAD - Untagged, no versioning
resource "aws_s3_bucket" "untagged" {
  bucket_prefix = "scanorbit-test-untagged-"
}

resource "aws_s3_bucket_public_access_block" "untagged" {
  bucket = aws_s3_bucket.untagged.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Bucket 3: BAD - In non-EU region (GDPR violation!)
resource "aws_s3_bucket" "us_region" {
  provider      = aws.us_east_1
  bucket_prefix = "scanorbit-test-us-"
}

resource "aws_s3_bucket_public_access_block" "us_region" {
  provider = aws.us_east_1
  bucket   = aws_s3_bucket.us_region.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
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

output "good_bucket_name" {
  description = "Good S3 Bucket (tagged, EU region)"
  value       = aws_s3_bucket.good.id
}

output "untagged_bucket_name" {
  description = "Untagged S3 Bucket"
  value       = aws_s3_bucket.untagged.id
}

output "us_bucket_name" {
  description = "US Region S3 Bucket (GDPR violation)"
  value       = aws_s3_bucket.us_region.id
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
       - Untagged instance: ${aws_instance.orphaned.id}
       - Orphaned volume: ${aws_ebs_volume.orphaned.id}
       - Unused EIP: ${aws_eip.unassociated.public_ip}
       - Misconfigured SG: ${aws_security_group.test_open.id}
       - Untagged S3 bucket
       - US region bucket (GDPR issue)

    4. Cleanup:
       terraform destroy

    ========================================
  EOT
}
