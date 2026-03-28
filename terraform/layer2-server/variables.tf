# =============================================================================
# General
# =============================================================================
# Deploy credentials are passed via env vars: SCW_ACCESS_KEY, SCW_SECRET_KEY
# S3 backend auth via: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY

variable "project_id" {
  description = "Scaleway project ID (from Console -> Project Settings)"
  type        = string
}

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
