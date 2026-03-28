# Remote state stored in the bootstrap bucket.
# Deploy identity has ObjectStorageRead for state access.
# Backup bucket is protected by an explicit Deny bucket policy.
terraform {
  backend "s3" {
    bucket                      = "scanorbit-terraform-state"
    key                         = "layer2-server/terraform.tfstate"
    region                      = "nl-ams"
    endpoint                    = "https://s3.nl-ams.scw.cloud"
    skip_credentials_validation = true
    skip_region_validation      = true
    skip_requesting_account_id  = true
    skip_metadata_api_check     = true
    skip_s3_checksum            = true
  }
}
