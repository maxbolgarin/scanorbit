# =============================================================================
# Scaleway Object Storage for Backups
# =============================================================================
# GDPR Compliance: Encrypted backups with retention policies
# =============================================================================

# Object Storage bucket for database backups
resource "scaleway_object_bucket" "backups" {
  name   = "${var.project_name}-${var.environment}-backups"
  region = var.scw_region

  # Enable versioning for additional protection
  versioning {
    enabled = true
  }

  # Lifecycle rules for automatic cleanup (GDPR data retention)
  lifecycle_rule {
    id      = "cleanup-old-backups"
    enabled = true
    prefix  = "daily/"

    # Delete daily backups after 30 days
    expiration {
      days = 30
    }

    # Note: Scaleway provider lifecycle rules don't currently support expiring noncurrent
    # (versioned) objects. Only current-object `expiration` and `transition` are supported.
  }

  lifecycle_rule {
    id      = "cleanup-weekly-backups"
    enabled = true
    prefix  = "weekly/"

    # Delete weekly backups after 90 days
    expiration {
      days = 90
    }
  }

  lifecycle_rule {
    id      = "cleanup-monthly-backups"
    enabled = true
    prefix  = "monthly/"

    # Delete monthly backups after 365 days (1 year)
    expiration {
      days = 365
    }
  }

  tags = {
    project     = var.project_name
    environment = var.environment
    purpose     = "gdpr-backups"
    encrypted   = "true"
  }
}

# Note: Scaleway Object Storage buckets are private by default
# No explicit ACL resource needed

# =============================================================================
# IAM Credentials for Backup Service
# =============================================================================

# IAM Application (service account) for backup container
resource "scaleway_iam_application" "backup" {
  name        = "${var.project_name}-${var.environment}-backup"
  description = "Service account for database backup operations"
}

# API Key for backup service
resource "scaleway_iam_api_key" "backup" {
  application_id = scaleway_iam_application.backup.id
  description    = "API key for backup container S3 access"
}
