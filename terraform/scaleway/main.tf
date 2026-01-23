# Reserved public IP for the instance
resource "scaleway_instance_ip" "main" {
  zone = var.scw_zone

  tags = [
    "project:${var.project_name}",
    "environment:${var.environment}",
  ]
}
