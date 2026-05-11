terraform {
  required_version = ">= 1.0"

  required_providers {
    scaleway = {
      source  = "scaleway/scaleway"
      version = "~> 2.70"
    }
  }
}

# Uses admin credentials: SCW_ACCESS_KEY + SCW_SECRET_KEY env vars
provider "scaleway" {
  region = var.scw_region
}

# S3 bucket for storing Terraform state of both layers.
# This bucket is created once and never destroyed.
# State file is local — back it up to your password manager.
resource "scaleway_object_bucket" "terraform_state" {
  name   = "${var.project_name}-terraform-state"
  region = var.scw_region

  versioning {
    enabled = true
  }

  lifecycle_rule {
    id      = "cleanup-incomplete-uploads"
    enabled = true
    abort_incomplete_multipart_upload_days = 7
  }

  tags = {
    project     = var.project_name
    environment = var.environment
    purpose     = "terraform-state"
    managed_by  = "bootstrap"
  }

  lifecycle {
    prevent_destroy = true
  }
}
