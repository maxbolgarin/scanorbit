# Security group for the ScanOrbit instance
resource "scaleway_instance_security_group" "main" {
  name                    = "${var.project_name}-${var.environment}-sg"
  zone                    = var.scw_zone
  inbound_default_policy  = "drop"
  outbound_default_policy = "accept"
  enable_default_security = false # Unblock SMTP (account is verified)

  # SSH access (open to all - use SSH keys for security)
  inbound_rule {
    action   = "accept"
    port     = 22
    protocol = "TCP"
    ip_range = "0.0.0.0/0"
  }

  # HTTP for Let's Encrypt ACME challenge
  inbound_rule {
    action   = "accept"
    port     = 80
    protocol = "TCP"
    ip_range = "0.0.0.0/0"
  }

  # HTTPS for application traffic
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
