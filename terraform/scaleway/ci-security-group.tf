# Security group for the CI runner / jump host VM
# Only SSH inbound — no web traffic served from this VM
resource "scaleway_instance_security_group" "ci" {
  name                    = "${var.project_name}-ci-sg"
  zone                    = var.scw_zone
  inbound_default_policy  = "drop"
  outbound_default_policy = "accept"
  enable_default_security = false

  # SSH access (public entry point / jump host)
  inbound_rule {
    action   = "accept"
    port     = 22
    protocol = "TCP"
    ip_range = "0.0.0.0/0"
  }

  tags = [
    "project:${var.project_name}",
    "environment:${var.environment}",
    "role:ci-runner",
  ]
}
