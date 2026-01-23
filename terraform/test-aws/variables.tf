variable "aws_region" {
  description = "AWS region for test infrastructure"
  type        = string
  default     = "eu-central-1"

  validation {
    condition     = startswith(var.aws_region, "eu-")
    error_message = "Region must be in EU (eu-*) to test GDPR compliance."
  }
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "test"
}

variable "project_name" {
  description = "Project name for tagging"
  type        = string
  default     = "scanorbit-battle-test"
}
