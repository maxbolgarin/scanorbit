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
  description = "Server backup cron: PutObject only on backup bucket. No delete, no list."
}

resource "scaleway_iam_policy" "backup_writer" {
  name           = "${var.project_name}-backup-writer-policy"
  description    = "IAM-level grant: ObjectStorageObjectsWrite. Without this, the bucket policy Allow is never evaluated."
  application_id = scaleway_iam_application.backup_writer.id

  rule {
    project_ids          = [var.project_id]
    permission_set_names = ["ObjectStorageObjectsWrite"]
  }
}

resource "scaleway_iam_api_key" "backup_writer" {
  application_id     = scaleway_iam_application.backup_writer.id
  description        = "Backup writer key — used as Docker secret on the server"
  default_project_id = var.project_id
}

# =============================================================================
# Backup Reader Identity — restore operations only
# =============================================================================

resource "scaleway_iam_application" "backup_reader" {
  name        = "${var.project_name}-backup-reader"
  description = "Restore operations: read-only access to backup bucket."
}

resource "scaleway_iam_policy" "backup_reader" {
  name           = "${var.project_name}-backup-reader-policy"
  description    = "IAM-level grant: ObjectStorageObjectsRead + ObjectStorageBucketsRead for restore."
  application_id = scaleway_iam_application.backup_reader.id

  rule {
    project_ids          = [var.project_id]
    permission_set_names = ["ObjectStorageObjectsRead", "ObjectStorageBucketsRead"]
  }
}

resource "scaleway_iam_api_key" "backup_reader" {
  application_id     = scaleway_iam_application.backup_reader.id
  description        = "Backup reader key — used for restore operations"
  default_project_id = var.project_id
}

# NOTE: Bucket policy removed — Scaleway's bucket policy evaluation blocks
# ALL principals not explicitly listed, including the admin identity.
# IAM policies alone provide sufficient protection:
#   - deploy: ObjectStorageRead only (can read, cannot write/delete backups)
#   - backup-writer: ObjectStorageObjectsWrite only (can upload, cannot delete/list)
#   - backup-reader: ObjectStorageObjectsRead + BucketsRead (for restore)
# The backup bucket is in Layer 1's state — deploy credentials cannot destroy it.
