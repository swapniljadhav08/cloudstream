# Same output surface as the other stacks, plus storage_bucket_media.

output "database_url" {
  value     = "postgresql://${var.db_username}:${var.db_password}@${google_sql_database_instance.main.private_ip_address}:5432/${module.contract.database_name}?schema=public&sslmode=require"
  sensitive = true
}

output "redis_url" {
  # rediss:// because transit encryption is on.
  value     = "rediss://:${google_redis_instance.main.auth_string}@${google_redis_instance.main.host}:${google_redis_instance.main.port}"
  sensitive = true
}

# S3-compatible XML API: the application's S3 client needs no changes.
output "storage_endpoint" { value = "https://storage.googleapis.com" }
output "storage_region" { value = var.region }
output "storage_force_path_style" { value = true }

output "storage_access_key" { value = google_storage_hmac_key.app.access_id }
output "storage_secret_key" {
  value     = google_storage_hmac_key.app.secret
  sensitive = true
}

output "storage_bucket" { value = google_storage_bucket.private.name }
output "storage_bucket_media" { value = google_storage_bucket.media.name }

# Delivered media is served straight from the public bucket. Put Cloud CDN in
# front of this bucket and point the variable at the CDN host instead.
output "storage_public_base_url" {
  value = "https://storage.googleapis.com/${google_storage_bucket.media.name}"
}

output "network_name" { value = google_compute_network.platform.name }
output "service_account_email" { value = google_service_account.app.email }
output "prefixes" { value = module.contract.prefixes }
output "rendition_ladder" { value = module.contract.rendition_ladder }
