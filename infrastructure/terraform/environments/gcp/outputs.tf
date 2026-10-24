# The same keys the local environment writes into .env, so a deployment
# pipeline renders configuration from here instead of restating it.
output "app_config" {
  sensitive = true

  value = {
    DATABASE_URL        = module.stack.database_url
    REDIS_URL           = module.stack.redis_url
    S3_ENDPOINT         = module.stack.storage_endpoint
    S3_REGION           = module.stack.storage_region
    S3_ACCESS_KEY       = module.stack.storage_access_key
    S3_SECRET_KEY       = module.stack.storage_secret_key
    S3_BUCKET           = module.stack.storage_bucket
    S3_BUCKET_MEDIA     = module.stack.storage_bucket_media
    S3_FORCE_PATH_STYLE = tostring(module.stack.storage_force_path_style)

    NEXT_PUBLIC_MEDIA_BASE_URL = module.stack.storage_public_base_url
  }
}

output "storage_bucket" { value = module.stack.storage_bucket }
output "storage_bucket_media" { value = module.stack.storage_bucket_media }
output "storage_public_base_url" { value = module.stack.storage_public_base_url }
output "network_name" { value = module.stack.network_name }
output "service_account_email" { value = module.stack.service_account_email }
