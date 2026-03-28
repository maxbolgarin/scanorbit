terraform {
  required_version = ">= 1.0"

  required_providers {
    scaleway = {
      source  = "scaleway/scaleway"
      version = "~> 2.0"
    }
  }
}

# Deploy credentials — restricted identity with NO Object Storage access.
# Safe to store in shell profile.
provider "scaleway" {
  access_key = var.scw_deploy_access_key
  secret_key = var.scw_deploy_secret_key
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
}
