variable "scw_zone" {
  description = "Scaleway zone for resources"
  type        = string
  default     = "nl-ams-1" # Amsterdam for GDPR compliance
}

variable "scw_region" {
  description = "Scaleway region"
  type        = string
  default     = "nl-ams"
}

variable "instance_type" {
  description = "Scaleway instance type"
  type        = string
  default     = "DEV1-M" # 3 vCPU, 4GB RAM, 40GB SSD (~€7/month)
}

variable "instance_image" {
  description = "OS image for the instance"
  type        = string
  default     = "ubuntu_jammy" # Ubuntu 22.04 LTS
}

variable "domain" {
  description = "Domain name for the application (e.g., scanorbit.io)"
  type        = string
}

variable "admin_email" {
  description = "Email for Let's Encrypt certificate notifications"
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

variable "ssh_public_keys" {
  description = "List of SSH public keys for the deploy user (the actual key content, not Scaleway IDs)"
  type        = list(string)
  default     = []
}

# =============================================================================
# GDPR Compliance Variables
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
