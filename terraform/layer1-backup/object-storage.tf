# =============================================================================
# Backup Object Storage Bucket
# =============================================================================
# GDPR-compliant encrypted backup storage with Object Lock.
# This bucket is the foundation of disaster recovery — Layer 2 credentials
# cannot access it.
# =============================================================================

resource "scaleway_object_bucket" "backups" {
  name   = "${var.project_name}-${var.environment}-backups"
  region = var.scw_region

  # Object Lock requires versioning — both must be set at creation time
  object_lock_enabled = true

  versioning {
    enabled = true
  }

  # --- Database backup retention ---

  lifecycle_rule {
    id      = "db-daily-retention"
    prefix  = "db/daily/"
    enabled = true
    expiration {
      days = 30
    }
  }

  lifecycle_rule {
    id      = "db-weekly-retention"
    prefix  = "db/weekly/"
    enabled = true
    expiration {
      days = 90
    }
  }

  lifecycle_rule {
    id      = "db-monthly-retention"
    prefix  = "db/monthly/"
    enabled = true
    expiration {
      days = 365
    }
  }

  # --- Secrets backup retention ---

  lifecycle_rule {
    id      = "secrets-retention"
    prefix  = "secrets/"
    enabled = true
    expiration {
      days = 365
    }
  }

  # --- Config backup retention ---

  lifecycle_rule {
    id      = "configs-retention"
    prefix  = "configs/"
    enabled = true
    expiration {
      days = 90
    }
  }

  # --- Cleanup ---

  lifecycle_rule {
    id      = "abort-incomplete-uploads"
    enabled = true
    abort_incomplete_multipart_upload_days = 7
  }

  tags = {
    project     = var.project_name
    environment = var.environment
    purpose     = "gdpr-backups"
    encrypted   = "true"
    managed_by  = "layer1-backup"
  }

  lifecycle {
    prevent_destroy = true
  }
}

# Object Lock: 7-day GOVERNANCE retention.
# Prevents backup-writer from deleting recent backups.
# Admin can override in emergencies.
#
# Note: Object Lock retention and lifecycle expiration are independent.
# Object Lock prevents deletion/overwrite within the retention window (7 days).
# Lifecycle rules auto-expire objects after their retention period (30/90/365 days).
# Both are required: Lock for short-term immutability, lifecycle for long-term cleanup.
resource "scaleway_object_bucket_lock_configuration" "backups" {
  bucket = scaleway_object_bucket.backups.name

  rule {
    default_retention {
      mode = "GOVERNANCE"
      days = 7
    }
  }
}
