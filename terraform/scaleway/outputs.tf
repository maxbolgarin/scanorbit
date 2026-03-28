output "instance_id" {
  description = "Instance ID"
  value       = scaleway_instance_server.main.id
}

output "public_ip" {
  description = "Public IP address of the instance"
  value       = scaleway_instance_ip.main.address
}

output "ssh_command" {
  description = "From your machine (internet): SSH to App VM via CI as ProxyJump. On the CI VM itself use app_ssh_from_ci_vm instead (no jump)."
  value       = "ssh -J deploy@ci.${var.domain} deploy@${split("/", scaleway_ipam_ip.app_private.address_cidr)[0]}"
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
    root = "${scaleway_domain_record.root.dns_zone} -> ${scaleway_domain_record.root.data} (A)"
    www  = "${scaleway_domain_record.www.name}.${scaleway_domain_record.www.dns_zone} -> ${scaleway_domain_record.www.data} (CNAME)"
    app  = "${scaleway_domain_record.app.name}.${scaleway_domain_record.app.dns_zone} -> ${scaleway_domain_record.app.data} (A)"
    api  = "${scaleway_domain_record.api.name}.${scaleway_domain_record.api.dns_zone} -> ${scaleway_domain_record.api.data} (A)"
    ci   = "${scaleway_domain_record.ci.name}.${scaleway_domain_record.ci.dns_zone} -> ${scaleway_domain_record.ci.data} (A)"
  }
}

# =============================================================================
# CI Runner / Jump Host Outputs
# =============================================================================

output "ci_instance_id" {
  description = "CI Runner Instance ID"
  value       = scaleway_instance_server.ci.id
}

output "ci_public_ip" {
  description = "CI Runner public IP"
  value       = scaleway_instance_ip.ci.address
}

output "ci_ssh_command" {
  description = "SSH to CI runner"
  value       = "ssh deploy@ci.${var.domain}"
}

output "app_private_ip" {
  description = "App VM private IPv4 on the VPC (10.10.0.0/24)"
  value       = split("/", scaleway_ipam_ip.app_private.address_cidr)[0]
}

output "ci_private_ip" {
  description = "CI VM private IPv4 on the VPC"
  value       = split("/", scaleway_ipam_ip.ci_private.address_cidr)[0]
}

output "app_ssh_via_jump" {
  description = "Same as ssh_command: from internet, ProxyJump via ci.<domain> (see dns_records.ci)"
  value       = "ssh -J deploy@ci.${var.domain} deploy@${split("/", scaleway_ipam_ip.app_private.address_cidr)[0]}"
}

output "app_ssh_from_ci_vm" {
  description = "Already logged into CI VM: SSH to App on private network only (no ProxyJump)"
  value       = "ssh deploy@${split("/", scaleway_ipam_ip.app_private.address_cidr)[0]}"
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
