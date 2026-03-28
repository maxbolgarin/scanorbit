# =============================================================================
# Private Network for inter-VM communication
# =============================================================================
# CI VM (jump host / runners) and App VM communicate over this private network.
# App VM SSH is only accessible via jump through CI VM.

resource "scaleway_vpc" "main" {
  name   = "${var.project_name}-${var.environment}-vpc"
  region = var.scw_region

  tags = [
    "project:${var.project_name}",
    "environment:${var.environment}",
  ]
}

resource "scaleway_vpc_private_network" "main" {
  name   = "${var.project_name}-${var.environment}-pn"
  region = var.scw_region

  ipv4_subnet {
    subnet = "10.10.0.0/24"
  }

  vpc_id = scaleway_vpc.main.id

  tags = [
    "project:${var.project_name}",
    "environment:${var.environment}",
  ]
}

# Stable private IPs for jump-host SSH: laptop -> CI VM (public) -> App VM (private only).
# Book these before attaching NICs so DHCP does not take the addresses (Scaleway IPAM note).
resource "scaleway_ipam_ip" "ci_private" {
  region  = var.scw_region
  address = "10.10.0.2"
  source {
    private_network_id = scaleway_vpc_private_network.main.id
  }
}

resource "scaleway_ipam_ip" "app_private" {
  region  = var.scw_region
  address = "10.10.0.3"
  source {
    private_network_id = scaleway_vpc_private_network.main.id
  }
}

# Attach App VM to private network
resource "scaleway_instance_private_nic" "app" {
  zone               = var.scw_zone
  server_id          = scaleway_instance_server.main.id
  private_network_id = scaleway_vpc_private_network.main.id
  ipam_ip_ids        = [scaleway_ipam_ip.app_private.id]
}

# Attach CI VM to private network
resource "scaleway_instance_private_nic" "ci" {
  zone               = var.scw_zone
  server_id          = scaleway_instance_server.ci.id
  private_network_id = scaleway_vpc_private_network.main.id
  ipam_ip_ids        = [scaleway_ipam_ip.ci_private.id]
}
