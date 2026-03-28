# =============================================================================
# CI Runner / Jump Host VM
# =============================================================================
# Serves as:
# - SSH jump host to access the app VM (which has no public SSH)
# - Host for GitHub Actions self-hosted runners
# - Entry point: ssh deploy@ci.scanorbit.cloud

# Reserved public IP for CI VM
resource "scaleway_instance_ip" "ci" {
  zone = var.scw_zone

  tags = [
    "project:${var.project_name}",
    "environment:${var.environment}",
    "role:ci-runner",
  ]
}

resource "scaleway_instance_server" "ci" {
  name  = "${var.project_name}-ci"
  zone  = var.scw_zone
  type  = var.ci_instance_type
  image = var.instance_image

  ip_id             = scaleway_instance_ip.ci.id
  security_group_id = scaleway_instance_security_group.ci.id

  user_data = {
    cloud-init = templatefile("${path.module}/cloud-init-ci.yaml", {
      ssh_public_keys     = var.ssh_public_keys
      github_runner_token = var.github_runner_token
      github_runner_repos = var.github_runner_repos
      runner_count        = var.github_runner_count
      runner_labels       = var.github_runner_labels
    })
  }

  root_volume {
    size_in_gb            = 40
    volume_type           = "l_ssd"
    delete_on_termination = true
  }

  tags = [
    "project:${var.project_name}",
    "environment:${var.environment}",
    "role:ci-runner",
  ]

  lifecycle {
    prevent_destroy = false
  }
}
