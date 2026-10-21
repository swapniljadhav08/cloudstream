# Output surface shared by every *-stack module. environments/ depends only on
# these names, which is what makes the stacks swappable.

output "database_url" {
  value     = "postgresql://${var.db_username}:${var.db_password}@localhost:${var.host_port_postgres}/${module.contract.database_name}?schema=public"
  sensitive = true
}

output "database_url_internal" {
  value     = "postgresql://${var.db_username}:${var.db_password}@postgres:5432/${module.contract.database_name}?schema=public"
  sensitive = true
}

output "redis_url" { value = "redis://localhost:${var.host_port_redis}" }
output "redis_url_internal" { value = "redis://redis:6379" }

output "storage_endpoint" { value = "http://localhost:${var.host_port_storage_api}" }
output "storage_endpoint_internal" { value = "http://localstack:4566" }
output "storage_region" { value = var.storage_region }
output "storage_force_path_style" { value = true }

output "storage_access_key" { value = var.storage_access_key }
output "storage_secret_key" {
  value     = var.storage_secret_key
  sensitive = true
}

output "storage_bucket" { value = module.storage.bucket }

# Browsers fetch media from the host-mapped port; the worker writes through the
# container alias. Both address the same bucket.
output "storage_public_base_url" { value = "http://localhost:${var.host_port_storage_api}/${module.storage.bucket}" }

output "network_name" { value = docker_network.platform.name }
output "prefixes" { value = module.contract.prefixes }
output "rendition_ladder" { value = module.contract.rendition_ladder }
