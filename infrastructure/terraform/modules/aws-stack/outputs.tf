# Same output surface as modules/local-stack and modules/oci-stack.

output "database_url" {
  value     = "postgresql://${var.db_username}:${var.db_password}@${aws_db_instance.main.address}:${aws_db_instance.main.port}/${var.db_name}?schema=public&sslmode=require"
  sensitive = true
}

output "redis_url" {
  # rediss:// because transit encryption is on.
  value     = "rediss://:${random_password.cache_auth.result}@${aws_elasticache_replication_group.main.primary_endpoint_address}:6379"
  sensitive = true
}

output "storage_endpoint" { value = "https://s3.${data.aws_region.current.name}.amazonaws.com" }
output "storage_region" { value = data.aws_region.current.name }
output "storage_force_path_style" { value = false }

output "storage_access_key" { value = aws_iam_access_key.app.id }
output "storage_secret_key" {
  value     = aws_iam_access_key.app.secret
  sensitive = true
}

output "storage_bucket" { value = module.storage.bucket }

# Serve media through CloudFront in front of this origin; the bucket URL is
# the fallback so the generated config is usable before a CDN exists.
output "storage_public_base_url" {
  value = "https://${module.storage.bucket}.s3.${data.aws_region.current.name}.amazonaws.com"
}

output "prefixes" { value = module.contract.prefixes }
output "rendition_ladder" { value = module.contract.rendition_ladder }
