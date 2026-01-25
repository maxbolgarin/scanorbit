# Security group for the ScanOrbit instance
resource "scaleway_instance_security_group" "main" {
  name                    = "${var.project_name}-${var.environment}-sg"
  zone                    = var.scw_zone
  inbound_default_policy  = "drop"
  outbound_default_policy = "accept"

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

  # SMTP for email sending (ports 465 and 587)
  # NOTE: You MUST also enable "Enable SMTP ports" checkbox in Scaleway console
  # Terraform cannot enable this - it's a fixed rule override that must be done manually
  # Go to: Scaleway Console > Instances > Security Groups > [Your Security Group] > Enable SMTP ports
  outbound_rule {
    action   = "accept"
    port     = 465
    protocol = "TCP"
    ip_range = "0.0.0.0/0"
  }

  outbound_rule {
    action   = "accept"
    port     = 587
    protocol = "TCP"
    ip_range = "0.0.0.0/0"
  }

  tags = [
    "project:${var.project_name}",
    "environment:${var.environment}",
  ]
}
