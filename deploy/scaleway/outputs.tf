output "instance_id" {
  description = "Instance ID"
  value       = scaleway_instance_server.main.id
}

output "public_ip" {
  description = "Public IP address of the instance"
  value       = scaleway_instance_ip.main.address
}

output "ssh_command" {
  description = "SSH command to connect to the instance"
  value       = "ssh root@${scaleway_instance_ip.main.address}"
}

output "domain_url" {
  description = "Main application URL"
  value       = "https://${var.domain}"
}

output "app_url" {
  description = "React SPA URL"
  value       = "https://app.${var.domain}"
}

output "api_url" {
  description = "API URL"
  value       = "https://api.${var.domain}"
}

output "dns_records" {
  description = "Created DNS records"
  value = {
    root = "${var.domain} -> ${scaleway_instance_ip.main.address}"
    www  = "www.${var.domain} -> ${var.domain}"
    app  = "app.${var.domain} -> ${scaleway_instance_ip.main.address}"
    api  = "api.${var.domain} -> ${scaleway_instance_ip.main.address}"
  }
}
