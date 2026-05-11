variable "scw_region" {
  description = "Scaleway region for state bucket"
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
