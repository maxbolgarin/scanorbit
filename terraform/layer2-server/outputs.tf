output "instance_id" {
  description = "Instance ID"
  value       = scaleway_instance_server.main.id
}

output "public_ip" {
  description = "Public IP address of the app instance"
  value       = scaleway_instance_ip.main.address
}

output "ssh_command" {
  description = "SSH to App VM via CI jump host"
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

# =============================================================================
# CI Runner Outputs
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
  description = "SSH to App VM via CI jump host (from internet)"
  value       = "ssh -J deploy@ci.${var.domain} deploy@${split("/", scaleway_ipam_ip.app_private.address_cidr)[0]}"
}

output "app_ssh_from_ci_vm" {
  description = "SSH to App VM from CI VM (private network)"
  value       = "ssh deploy@${split("/", scaleway_ipam_ip.app_private.address_cidr)[0]}"
}
