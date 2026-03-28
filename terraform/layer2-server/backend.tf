# Remote state stored in the bootstrap bucket.
# Deploy identity has ObjectStorageRead for state access.
# Backup bucket is protected by an explicit Deny bucket policy.
#
# S3 backend auth uses AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY env vars.
# Set them to the deploy credentials:
#   export AWS_ACCESS_KEY_ID=$TF_VAR_scw_deploy_access_key
#   export AWS_SECRET_ACCESS_KEY=$TF_VAR_scw_deploy_secret_key
terraform {
  backend "s3" {
    bucket                      = "scanorbit-terraform-state"
    key                         = "layer2-server/terraform.tfstate"
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
