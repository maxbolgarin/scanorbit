terraform {
  required_version = ">= 1.0"

  required_providers {
    scaleway = {
      source  = "scaleway/scaleway"
      version = "~> 2.70"
    }
  }
}

# Admin credentials — set via SCW_ACCESS_KEY and SCW_SECRET_KEY env vars.
# Export from your password manager before running.
provider "scaleway" {
  organization_id = var.organization_id
  project_id      = var.project_id
  region          = var.scw_region
}
