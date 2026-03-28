# =============================================================================
# IAM Identity Separation
# =============================================================================
# Two IAM applications created here:
#   1. scanorbit-deploy — daily server operations (NO backup bucket access)
#   2. scanorbit-backup-writer — server cron job (PutObject only)
#
# The admin identity (scanorbit-admin) is created manually in the console.
# =============================================================================

data "scaleway_account_project" "default" {
  name = "default"
}

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
    project_ids = [data.scaleway_account_project.default.id]
    permission_set_names = [
      "InstancesFullAccess",
      "VPCFullAccess",
      "IPsFullAccess",
      "SecurityGroupsFullAccess",
      "ObjectStorageBucketsRead",
      "ObjectStorageObjectsRead",
    ]
  }
}

resource "scaleway_iam_api_key" "deploy" {
  application_id = scaleway_iam_application.deploy.id
  description    = "Daily deploy key for Layer 2 Terraform and server management"
}

# =============================================================================
# Backup Writer Identity — server cron job
# =============================================================================

resource "scaleway_iam_application" "backup_writer" {
  name        = "${var.project_name}-backup-writer"
  description = "Server backup cron: PutObject only on backup bucket. No delete, no list."
}

resource "scaleway_iam_api_key" "backup_writer" {
  application_id = scaleway_iam_application.backup_writer.id
  description    = "Backup writer key — used as Docker secret on the server"
}

# Bucket policy: combined access rules for the backup bucket.
# - backup-writer: PutObject only
# - deploy identity: explicit deny (has ObjectStorageRead for TF state bucket,
#   but this deny blocks access to the backup bucket specifically)
resource "scaleway_object_bucket_policy" "backups" {
  bucket = scaleway_object_bucket.backups.id
  policy = jsonencode({
    Version = "2023-04-17"
    Statement = [
      {
        Sid    = "AllowBackupWriterPutOnly"
        Effect = "Allow"
        Principal = {
          SCW = "application_id:${scaleway_iam_application.backup_writer.id}"
        }
        Action = [
          "s3:PutObject",
        ]
        Resource = [
          "${scaleway_object_bucket.backups.name}/*",
        ]
      },
      {
        Sid    = "DenyDeployAllAccess"
        Effect = "Deny"
        Principal = {
          SCW = "application_id:${scaleway_iam_application.deploy.id}"
        }
        Action = [
          "s3:*",
        ]
        Resource = [
          "${scaleway_object_bucket.backups.name}",
          "${scaleway_object_bucket.backups.name}/*",
        ]
      },
    ]
  })
}
