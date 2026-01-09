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

variable "ssh_key_ids" {
  description = "List of Scaleway SSH key IDs to add to the instance"
  type        = list(string)
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

variable "github_repo" {
  description = "GitHub repository SSH URL for cloning"
  type        = string
  default     = "git@github.com:YOUR_ORG/scanorbit.git"
}
