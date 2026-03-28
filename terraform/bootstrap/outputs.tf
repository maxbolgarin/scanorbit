output "state_bucket_name" {
  description = "Name of the S3 bucket for Terraform state"
  value       = scaleway_object_bucket.terraform_state.name
}

output "state_bucket_endpoint" {
  description = "S3 endpoint for state bucket"
  value       = "https://s3.${var.scw_region}.scw.cloud"
}

output "state_bucket_region" {
  description = "Region of the state bucket"
  value       = var.scw_region
}
