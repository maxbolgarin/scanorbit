terraform {
  required_version = ">= 1.0"

  required_providers {
    scaleway = {
      source  = "scaleway/scaleway"
      version = "~> 2.70"
    }
  }
}

# Deploy credentials — set via SCW_ACCESS_KEY and SCW_SECRET_KEY env vars.
# Restricted identity with NO backup bucket access. Safe to store in shell profile.
provider "scaleway" {
  project_id = var.project_id
  region     = var.scw_region
  zone       = var.scw_zone
}

# Reserved public IP for the main instance
resource "scaleway_instance_ip" "main" {
  zone = var.scw_zone

  tags = [
    "project:${var.project_name}",
    "environment:${var.environment}",
  ]

  lifecycle {
    prevent_destroy = true
  }
}
