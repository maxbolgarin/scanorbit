resource "scaleway_instance_security_group" "main" {
  name                    = "${var.project_name}-${var.environment}-sg"
  zone                    = var.scw_zone
  inbound_default_policy  = "drop"
  outbound_default_policy = "accept"
  enable_default_security = false

  inbound_rule {
    action   = "accept"
    port     = 80
    protocol = "TCP"
    ip_range = "0.0.0.0/0"
  }

  inbound_rule {
    action   = "accept"
    port     = 443
    protocol = "TCP"
    ip_range = "0.0.0.0/0"
  }

  tags = [
    "project:${var.project_name}",
    "environment:${var.environment}",
  ]
}
