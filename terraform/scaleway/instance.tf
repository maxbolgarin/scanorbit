# ScanOrbit instance running Docker Compose
resource "scaleway_instance_server" "main" {
  name  = "${var.project_name}-${var.environment}"
  zone  = var.scw_zone
  type  = var.instance_type
  image = var.instance_image

  ip_id             = scaleway_instance_ip.main.id
  security_group_id = scaleway_instance_security_group.main.id

  # Cloud-init configuration with SSH keys and GDPR scripts
  # Scripts are loaded from deploy/scripts/ (canonical source)
  user_data = {
    cloud-init = templatefile("${path.module}/cloud-init.yaml", {
      ssh_public_keys      = var.ssh_public_keys
      script_gen_certs     = file("${path.module}/generate-certs.sh")
      private_network_cidr = "10.10.0.0/24"
    })
  }

  # Root volume (included in instance type)
  root_volume {
    size_in_gb            = 40
    volume_type           = "l_ssd"
    delete_on_termination = true
  }

  tags = [
    "project:${var.project_name}",
    "environment:${var.environment}",
    "gdpr:compliant",
  ]

  lifecycle {
    # Prevent accidental destruction
    prevent_destroy = false
    # Ignore cloud-init changes to avoid VM recreation
    # UFW changes applied manually on the live VM
    ignore_changes = [user_data]
  }
}
