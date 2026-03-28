# =============================================================================
# DNS Records
# =============================================================================
# All DNS records managed in Layer 1 to survive Layer 2 destroy.
# IP addresses are passed as variables — update after Layer 2 apply.
# =============================================================================

# A record: scanorbit.cloud -> app server
resource "scaleway_domain_record" "root" {
  dns_zone = var.domain
  name     = ""
  type     = "A"
  data     = var.app_server_ip
  ttl      = 3600
}

# CNAME: www.scanorbit.cloud -> scanorbit.cloud
resource "scaleway_domain_record" "www" {
  dns_zone = var.domain
  name     = "www"
  type     = "CNAME"
  data     = "${var.domain}."
  ttl      = 3600
}

# A record: app.scanorbit.cloud -> app server
resource "scaleway_domain_record" "app" {
  dns_zone = var.domain
  name     = "app"
  type     = "A"
  data     = var.app_server_ip
  ttl      = 3600
}

# A record: api.scanorbit.cloud -> app server
resource "scaleway_domain_record" "api" {
  dns_zone = var.domain
  name     = "api"
  type     = "A"
  data     = var.app_server_ip
  ttl      = 3600
}

# A record: ci.scanorbit.cloud -> CI runner
resource "scaleway_domain_record" "ci" {
  dns_zone = var.domain
  name     = "ci"
  type     = "A"
  data     = var.ci_server_ip
  ttl      = 3600
}
