# Remote state stored in the bootstrap bucket.
# Run `terraform init` with admin credentials:
#   export AWS_ACCESS_KEY_ID=$SCW_ACCESS_KEY
#   export AWS_SECRET_ACCESS_KEY=$SCW_SECRET_KEY
terraform {
  backend "s3" {
    bucket                      = "scanorbit-terraform-state"
    key                         = "layer1-backup/terraform.tfstate"
    region                      = "nl-ams"
    skip_credentials_validation = true
    skip_region_validation      = true
    skip_requesting_account_id  = true
    skip_metadata_api_check     = true
    skip_s3_checksum            = true
    use_path_style              = true

    endpoints = {
      s3 = "https://s3.nl-ams.scw.cloud"
    }
  }
}
