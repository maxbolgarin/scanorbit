# =============================================================================
# General
# =============================================================================
# Admin credentials are passed via env vars: SCW_ACCESS_KEY, SCW_SECRET_KEY
# S3 backend auth via: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY

variable "scw_region" {
  description = "Scaleway region"
  type        = string
  default     = "nl-ams"
}

variable "organization_id" {
  description = "Scaleway organization ID (from Console -> Organization -> Settings)"
  type        = string
}

variable "project_id" {
  description = "Scaleway project ID (from Console -> Project Settings)"
  type        = string
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

  validation {
    condition     = can(regex("^\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}$", var.app_server_ip))
    error_message = "app_server_ip must be a valid IPv4 address."
  }
}

variable "ci_server_ip" {
  description = "Public IP of the CI server (for DNS A record). Updated after Layer 2 apply."
  type        = string

  validation {
    condition     = can(regex("^\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}$", var.ci_server_ip))
    error_message = "ci_server_ip must be a valid IPv4 address."
  }
}
