terraform {
  required_providers {
    google = { source = "hashicorp/google", version = "~> 6.0" }
  }
}

module "contract" {
  source      = "../platform-contract"
  project     = var.project
  environment = var.environment
}

locals {
  name = module.contract.name_prefix

  labels = merge(var.labels, {
    project     = var.project
    environment = var.environment
    managed-by  = "terraform"
  })

  # Bucket names are globally unique across all of GCS, so they carry the
  # project id rather than just the project slug.
  private_bucket = "${var.project_id}-${var.environment}-private"
  media_bucket   = "${var.project_id}-${var.environment}-media"

  # docs/33_Bucket_Structure.md lifecycle rules only ever apply to prefixes
  # that live in the private bucket.
  private_lifecycle = module.contract.lifecycle_rules
}

# --- Network ----------------------------------------------------------------
resource "google_compute_network" "platform" {
  project                 = var.project_id
  name                    = "${local.name}-net"
  auto_create_subnetworks = true
}

# Cloud SQL and Memorystore reach the app over private IP, which needs a
# reserved range peered to Google's service network.
resource "google_compute_global_address" "private_services" {
  project       = var.project_id
  name          = "${local.name}-private-services"
  purpose       = "VPC_PEERING"
  address_type  = "INTERNAL"
  prefix_length = 16
  network       = google_compute_network.platform.id
}

resource "google_service_networking_connection" "private_services" {
  network                 = google_compute_network.platform.id
  service                 = "servicenetworking.googleapis.com"
  reserved_peering_ranges = [google_compute_global_address.private_services.name]
}

# --- Object storage ---------------------------------------------------------
# Private: uploaded originals, metadata sidecars, temp and logs.
resource "google_storage_bucket" "private" {
  project                     = var.project_id
  name                        = local.private_bucket
  location                    = var.storage_location
  force_destroy               = var.force_destroy_buckets
  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"
  labels                      = local.labels

  versioning {
    enabled = false
  }

  dynamic "lifecycle_rule" {
    for_each = local.private_lifecycle
    content {
      action {
        type = "Delete"
      }
      condition {
        age            = lifecycle_rule.value.expiration_days
        matches_prefix = [lifecycle_rule.value.prefix]
      }
    }
  }
}

# Public: playlists, segments, thumbnails and previews — what the player fetches.
resource "google_storage_bucket" "media" {
  project                     = var.project_id
  name                        = local.media_bucket
  location                    = var.storage_location
  force_destroy               = var.force_destroy_buckets
  uniform_bucket_level_access = true

  # Must stay "inherited" for the allUsers binding below to be accepted.
  public_access_prevention = "inherited"
  labels                   = local.labels

  cors {
    origin          = var.allowed_origins
    method          = ["GET", "HEAD"]
    response_header = ["Content-Length", "Content-Range", "ETag"]
    max_age_seconds = 3000
  }
}

# The whole media bucket is world-readable. That is the point of splitting it:
# nothing private is ever written here.
resource "google_storage_bucket_iam_member" "media_public" {
  bucket = google_storage_bucket.media.name
  role   = "roles/storage.objectViewer"
  member = "allUsers"
}

# --- Application identity ---------------------------------------------------
resource "google_service_account" "app" {
  project      = var.project_id
  account_id   = "${substr(local.name, 0, 24)}-app"
  display_name = "${local.name} application"
}

resource "google_storage_bucket_iam_member" "app_private" {
  bucket = google_storage_bucket.private.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.app.email}"
}

resource "google_storage_bucket_iam_member" "app_media" {
  bucket = google_storage_bucket.media.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.app.email}"
}

# HMAC key for the S3-compatible XML API. The secret is only returned at
# creation, which is why Terraform manages it.
resource "google_storage_hmac_key" "app" {
  project               = var.project_id
  service_account_email = google_service_account.app.email
}

# --- PostgreSQL -------------------------------------------------------------
resource "google_sql_database_instance" "main" {
  project          = var.project_id
  name             = "${local.name}-postgres"
  region           = var.region
  database_version = "POSTGRES_16"

  # Guard against a destroy of production data in both places that check.
  deletion_protection = var.environment == "prod"

  depends_on = [google_service_networking_connection.private_services]

  settings {
    tier              = var.db_tier
    availability_type = var.environment == "prod" ? "REGIONAL" : "ZONAL"
    disk_size         = var.db_disk_gb
    disk_type         = "PD_SSD"
    disk_autoresize   = true
    user_labels       = local.labels

    ip_configuration {
      # Private IP only: the application tier reaches it inside the VPC.
      ipv4_enabled    = false
      private_network = google_compute_network.platform.id
      ssl_mode        = "ENCRYPTED_ONLY"
    }

    backup_configuration {
      enabled                        = true
      point_in_time_recovery_enabled = true
      start_time                     = "03:00"
      transaction_log_retention_days = 7
    }

    maintenance_window {
      day          = 7
      hour         = 5
      update_track = "stable"
    }
  }
}

resource "google_sql_database" "main" {
  project  = var.project_id
  name     = module.contract.database_name
  instance = google_sql_database_instance.main.name
}

resource "google_sql_user" "app" {
  project  = var.project_id
  name     = var.db_username
  instance = google_sql_database_instance.main.name
  password = var.db_password
}

# --- Redis ------------------------------------------------------------------
resource "google_redis_instance" "main" {
  project        = var.project_id
  name           = "${local.name}-redis"
  region         = var.region
  redis_version  = "REDIS_7_0"
  memory_size_gb = var.cache_memory_gb

  # BullMQ relies on blocking commands and Lua and does not support cluster
  # mode, so this stays a single node (with a replica in prod for failover).
  tier = var.environment == "prod" ? "STANDARD_HA" : "BASIC"

  authorized_network = google_compute_network.platform.id
  connect_mode       = "PRIVATE_SERVICE_ACCESS"

  auth_enabled            = true
  transit_encryption_mode = "SERVER_AUTHENTICATION"

  labels     = local.labels
  depends_on = [google_service_networking_connection.private_services]
}
