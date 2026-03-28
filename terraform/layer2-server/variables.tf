# =============================================================================
# Deploy Credentials
# =============================================================================
# Set via: TF_VAR_scw_deploy_access_key and TF_VAR_scw_deploy_secret_key
# These come from Layer 1 output: deploy_access_key / deploy_secret_key

variable "scw_deploy_access_key" {
  description = "Scaleway deploy access key (from Layer 1 output)"
  type        = string
  sensitive   = true
}

variable "scw_deploy_secret_key" {
  description = "Scaleway deploy secret key (from Layer 1 output)"
  type        = string
  sensitive   = true
}

# =============================================================================
# General
# =============================================================================

variable "scw_zone" {
  description = "Scaleway zone for resources"
  type        = string
  default     = "nl-ams-1"
}

variable "scw_region" {
  description = "Scaleway region"
  type        = string
  default     = "nl-ams"
}

variable "instance_type" {
  description = "Scaleway instance type"
  type        = string
  default     = "DEV1-M"
}

variable "instance_image" {
  description = "OS image for the instance"
  type        = string
  default     = "ubuntu_jammy"
}

variable "project_name" {
  description = "Project name for resource naming"
  type        = string
  default     = "scanorbit"
}

variable "environment" {
  description = "Environment (prod, staging, dev)"
  type        = string
  default     = "prod"
}

variable "domain" {
  description = "Domain name for the application"
  type        = string
}

variable "admin_email" {
  description = "Email for Let's Encrypt certificate notifications"
  type        = string
}

variable "ssh_public_keys" {
  description = "List of SSH public keys for the deploy user"
  type        = list(string)
  default     = []
}

# =============================================================================
# GDPR Compliance
# =============================================================================

variable "data_volume_size" {
  description = "Size of the encrypted data volume in GB"
  type        = number
  default     = 20
}

variable "enable_backups" {
  description = "Enable automated backups to Object Storage"
  type        = bool
  default     = true
}

# =============================================================================
# CI Runner / Jump Host
# =============================================================================

variable "ci_instance_type" {
  description = "Scaleway instance type for CI runner VM"
  type        = string
  default     = "DEV1-M"
}

variable "github_runner_token" {
  description = "GitHub PAT with repo scope for runner registration"
  type        = string
  sensitive   = true
}

variable "github_runner_repos" {
  description = "GitHub repositories to register runners for"
  type        = list(string)
  default     = ["maxbolgarin/scanorbit", "maxbolgarin/biomaxing"]
}

variable "github_runner_count" {
  description = "Number of GitHub Actions runners per repo"
  type        = number
  default     = 3
}

variable "github_runner_labels" {
  description = "Comma-separated labels for GitHub runners"
  type        = string
  default     = "self-hosted,linux,x64"
}
