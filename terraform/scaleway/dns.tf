# A record: scanorbit.cloud -> VM public IP
resource "scaleway_domain_record" "root" {
  dns_zone = var.domain
  name     = ""
  type     = "A"
  data     = scaleway_instance_ip.main.address
  ttl      = 3600
}

# CNAME record: www.scanorbit.cloud -> scanorbit.cloud
resource "scaleway_domain_record" "www" {
  dns_zone = var.domain
  name     = "www"
  type     = "CNAME"
  data     = "${var.domain}."
  ttl      = 3600
}

# A record: app.scanorbit.cloud -> VM public IP
resource "scaleway_domain_record" "app" {
  dns_zone = var.domain
  name     = "app"
  type     = "A"
  data     = scaleway_instance_ip.main.address
  ttl      = 3600
}

# A record: api.scanorbit.cloud -> VM public IP
resource "scaleway_domain_record" "api" {
  dns_zone = var.domain
  name     = "api"
  type     = "A"
  data     = scaleway_instance_ip.main.address
  ttl      = 3600
}

# A record: ci.scanorbit.cloud -> CI runner VM public IP
resource "scaleway_domain_record" "ci" {
  dns_zone = var.domain
  name     = "ci"
  type     = "A"
  data     = scaleway_instance_ip.ci.address
  ttl      = 3600
}
