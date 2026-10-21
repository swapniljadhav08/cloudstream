# Same output surface as modules/local-stack and modules/aws-stack.

output "database_url" {
  value     = "postgresql://${var.db_username}:${var.db_password}@${oci_psql_db_system.main.network_details[0].primary_db_endpoint_private_ip}:5432/${module.contract.database_name}?schema=public&sslmode=require"
  sensitive = true
}

output "redis_url" {
  # OCI Cache requires TLS, hence rediss://.
  value     = "rediss://${oci_redis_redis_cluster.main.primary_fqdn}:6379"
  sensitive = true
}

# S3 Compatibility API: the application's S3 client needs no changes.
output "storage_endpoint" {
  value = "https://${local.namespace}.compat.objectstorage.${var.region}.oraclecloud.com"
}

output "storage_region" { value = var.region }
output "storage_force_path_style" { value = true }

output "storage_access_key" { value = oci_identity_customer_secret_key.app.id }
output "storage_secret_key" {
  value     = oci_identity_customer_secret_key.app.key
  sensitive = true
}

output "storage_bucket" { value = oci_objectstorage_bucket.media.name }

# Not an object-storage URL: the bucket is private (see main.tf), so delivered
# media is fronted by the CDN or the application's media route.
output "storage_public_base_url" {
  value = "https://${var.project}-${var.environment}-cdn.example.com"
}

output "prefixes" { value = module.contract.prefixes }
output "rendition_ladder" { value = module.contract.rendition_ladder }
