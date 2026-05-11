# =============================================================================
# IAM Identity Separation
# =============================================================================
# Two IAM applications created here:
#   1. scanorbit-deploy — daily server operations (NO backup bucket access)
#   2. scanorbit-backup-writer — server cron job (PutObject only)
#
# The admin identity (scanorbit-admin) is created manually in the console.
# =============================================================================

# Project ID passed as variable to avoid needing organization-level read permissions.
# Get it from: Scaleway Console -> Project Settings -> Project ID

# =============================================================================
# Deploy Identity — Layer 2 operations
# =============================================================================

resource "scaleway_iam_application" "deploy" {
  name        = "${var.project_name}-deploy"
  description = "Daily operations: instances, networking. Zero backup bucket access."

  lifecycle {
    prevent_destroy = true
  }
}

resource "scaleway_iam_policy" "deploy" {
  name           = "${var.project_name}-deploy-policy"
  description    = "Full access to compute, networking, and TF state bucket. No backup bucket access."
  application_id = scaleway_iam_application.deploy.id

  rule {
    project_ids = [var.project_id]
    permission_set_names = [
      "InstancesFullAccess",
      "VPCFullAccess",
      "ObjectStorageBucketsRead",
      "ObjectStorageObjectsRead",
    ]
  }

  rule {
    organization_id      = var.organization_id
    permission_set_names = ["ProjectReadOnly"]
  }
}

resource "scaleway_iam_api_key" "deploy" {
  application_id     = scaleway_iam_application.deploy.id
  description        = "Daily deploy key for Layer 2 Terraform and server management"
  default_project_id = var.project_id
}

# =============================================================================
# Backup Writer Identity — server cron job
# =============================================================================

resource "scaleway_iam_application" "backup_writer" {
  name        = "${var.project_name}-backup-writer"
  description = "Server backup and restore: write backups, read/list for restore operations."

  lifecycle {
    prevent_destroy = true
  }
}

resource "scaleway_iam_policy" "backup_writer" {
  name           = "${var.project_name}-backup-writer-policy"
  description    = "Write objects for backups + read/list for restore. No delete."
  application_id = scaleway_iam_application.backup_writer.id

  rule {
    project_ids = [var.project_id]
    permission_set_names = [
      "ObjectStorageObjectsWrite",
      "ObjectStorageObjectsRead",
      "ObjectStorageBucketsRead",
    ]
  }
}

resource "scaleway_iam_api_key" "backup_writer" {
  application_id     = scaleway_iam_application.backup_writer.id
  description        = "Backup key — used as Docker secret on the server for backup and restore"
  default_project_id = var.project_id
}

# NOTE: Bucket policy removed — Scaleway's bucket policy evaluation blocks
# ALL principals not explicitly listed, including the admin identity.
# IAM policies alone provide sufficient protection:
#   - deploy: ObjectStorageRead only (can read, cannot write/delete backups)
#   - backup-writer: ObjectStorage read/write (can upload and list, cannot delete)
# The backup bucket is in Layer 1's state — deploy credentials cannot destroy it.
