# =============================================================================
# Admin Credentials (from password manager, never on disk)
# =============================================================================
# Set via: TF_VAR_scw_admin_access_key and TF_VAR_scw_admin_secret_key

variable "scw_admin_access_key" {
  description = "Scaleway admin access key (from password manager)"
  type        = string
  sensitive   = true
}

variable "scw_admin_secret_key" {
  description = "Scaleway admin secret key (from password manager)"
  type        = string
  sensitive   = true
}

# =============================================================================
# General
# =============================================================================

variable "scw_region" {
  description = "Scaleway region"
  type        = string
  default     = "nl-ams"
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

# =============================================================================
# DNS
# =============================================================================

variable "domain" {
  description = "Domain name for the application (e.g., scanorbit.cloud)"
  type        = string
}

variable "app_server_ip" {
  description = "Public IP of the app server (for DNS A records). Updated after Layer 2 apply."
  type        = string
}

variable "ci_server_ip" {
  description = "Public IP of the CI server (for DNS A record). Updated after Layer 2 apply."
  type        = string
}
