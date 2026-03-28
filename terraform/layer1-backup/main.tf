terraform {
  required_version = ">= 1.0"

  required_providers {
    scaleway = {
      source  = "scaleway/scaleway"
      version = "~> 2.0"
    }
  }
}

# Admin credentials — deliberately required, never stored on disk.
# Export TF_VAR_scw_admin_access_key and TF_VAR_scw_admin_secret_key
# from your password manager before running.
provider "scaleway" {
  access_key = var.scw_admin_access_key
  secret_key = var.scw_admin_secret_key
  region     = var.scw_region
}
