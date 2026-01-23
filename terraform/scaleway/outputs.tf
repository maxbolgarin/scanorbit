output "instance_id" {
  description = "Instance ID"
  value       = scaleway_instance_server.main.id
}

output "public_ip" {
  description = "Public IP address of the instance"
  value       = scaleway_instance_ip.main.address
}

output "ssh_command" {
  description = "SSH command to connect to the instance (as deploy user)"
  value       = "ssh deploy@${scaleway_instance_ip.main.address}"
}

output "domain_url" {
  description = "Main application URL"
  value       = "https://${var.domain}"
}

output "app_url" {
  description = "React SPA URL"
  value       = "https://app.${var.domain}"
}

output "api_url" {
  description = "API URL"
  value       = "https://api.${var.domain}"
}

output "dns_records" {
  description = "Created DNS records"
  value = {
    root = "${var.domain} -> ${scaleway_instance_ip.main.address}"
    www  = "www.${var.domain} -> ${var.domain}"
    app  = "app.${var.domain} -> ${scaleway_instance_ip.main.address}"
    api  = "api.${var.domain} -> ${scaleway_instance_ip.main.address}"
  }
}

# =============================================================================
# GDPR Compliance Outputs
# =============================================================================

output "backup_bucket_name" {
  description = "Name of the S3 bucket for backups"
  value       = scaleway_object_bucket.backups.name
}

output "backup_bucket_endpoint" {
  description = "S3 endpoint for backups"
  value       = "s3.${var.scw_region}.scw.cloud"
}

output "backup_access_key" {
  description = "Access key for backup S3 operations"
  value       = scaleway_iam_api_key.backup.access_key
}

output "backup_secret_key" {
  description = "Secret key for backup S3 operations"
  value       = scaleway_iam_api_key.backup.secret_key
  sensitive   = true
}
