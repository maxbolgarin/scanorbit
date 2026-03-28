# =============================================================================
# Backup Bucket Outputs
# =============================================================================

output "backup_bucket_name" {
  description = "Name of the S3 backup bucket"
  value       = scaleway_object_bucket.backups.name
}

output "backup_bucket_endpoint" {
  description = "S3 endpoint for backup operations"
  value       = "https://s3.${var.scw_region}.scw.cloud"
}

# =============================================================================
# Deploy Identity Outputs (for Layer 2)
# =============================================================================

output "deploy_access_key" {
  description = "Access key for the deploy IAM identity (use in Layer 2)"
  value       = scaleway_iam_api_key.deploy.access_key
  sensitive   = true
}

output "deploy_secret_key" {
  description = "Secret key for the deploy IAM identity"
  value       = scaleway_iam_api_key.deploy.secret_key
  sensitive   = true
}

# =============================================================================
# Backup Writer Outputs (for server Docker secrets)
# =============================================================================

output "backup_writer_access_key" {
  description = "Access key for backup-writer (put in Docker secret: scw_access_key)"
  value       = scaleway_iam_api_key.backup_writer.access_key
  sensitive   = true
}

output "backup_writer_secret_key" {
  description = "Secret key for backup-writer (put in Docker secret: scw_secret_key)"
  value       = scaleway_iam_api_key.backup_writer.secret_key
  sensitive   = true
}

# =============================================================================
# DNS Outputs
# =============================================================================

output "dns_records" {
  description = "Created DNS records"
  value = {
    root = "${scaleway_domain_record.root.dns_zone} -> ${scaleway_domain_record.root.data} (A)"
    www  = "www.${scaleway_domain_record.www.dns_zone} -> ${scaleway_domain_record.www.data} (CNAME)"
    app  = "app.${scaleway_domain_record.app.dns_zone} -> ${scaleway_domain_record.app.data} (A)"
    api  = "api.${scaleway_domain_record.api.dns_zone} -> ${scaleway_domain_record.api.data} (A)"
    ci   = "ci.${scaleway_domain_record.ci.dns_zone} -> ${scaleway_domain_record.ci.data} (A)"
  }
}
