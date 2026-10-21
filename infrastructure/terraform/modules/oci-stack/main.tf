terraform {
  required_providers {
    oci = { source = "oracle/oci", version = "~> 6.0" }
  }
}

module "contract" {
  source      = "../platform-contract"
  project     = var.project
  environment = var.environment
}

data "oci_objectstorage_namespace" "current" {
  compartment_id = var.compartment_id
}

locals {
  name      = module.contract.name_prefix
  namespace = data.oci_objectstorage_namespace.current.namespace

  tags = {
    Project     = var.project
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# --- Object Storage ---------------------------------------------------------
# NoPublicAccess, unlike the S3 stacks.
#
# OCI has no prefix-scoped anonymous read: a bucket is public or it is not, so
# `public_read_key_patterns` from the contract cannot be expressed here.
# Rather than make the whole bucket public (which would expose the uploaded
# originals), the bucket stays private and delivered media is served through
# the CDN or the application's media route. That is the one place where this
# stack is not equivalent to the S3 ones, and the reason the public base URL
# output below is not an object-storage URL.
resource "oci_objectstorage_bucket" "media" {
  compartment_id = var.compartment_id
  namespace      = local.namespace
  name           = module.contract.bucket_name

  access_type   = "NoPublicAccess"
  storage_tier  = var.storage_tier
  versioning    = "Disabled"
  auto_tiering  = "Disabled"
  freeform_tags = local.tags
}

# docs/33_Bucket_Structure.md lifecycle rules.
resource "oci_objectstorage_object_lifecycle_policy" "media" {
  bucket    = oci_objectstorage_bucket.media.name
  namespace = local.namespace

  dynamic "rules" {
    for_each = module.contract.lifecycle_rules
    content {
      name        = rules.value.id
      action      = "DELETE"
      time_amount = rules.value.expiration_days
      time_unit   = "DAYS"
      is_enabled  = true

      object_name_filter {
        inclusion_prefixes = [rules.value.prefix]
      }
    }
  }
}

# Credentials for the S3 Compatibility API. The secret is only ever returned
# at creation time, which is why it is a Terraform-managed resource.
resource "oci_identity_customer_secret_key" "app" {
  display_name = "${local.name}-s3-compat"
  user_id      = var.app_user_id
}

# --- PostgreSQL -------------------------------------------------------------
resource "oci_psql_db_system" "main" {
  compartment_id = var.compartment_id
  display_name   = "${local.name}-postgres"

  db_version     = var.db_version
  shape          = var.db_shape
  instance_count = var.db_instance_count

  network_details {
    subnet_id = var.subnet_id
  }

  credentials {
    username = var.db_username

    password_details {
      password_type = "PLAIN_TEXT"
      password      = var.db_password
    }
  }

  storage_details {
    system_type           = "OCI_OPTIMIZED_STORAGE"
    is_regionally_durable = true
  }

  freeform_tags = local.tags
}

# --- Redis ------------------------------------------------------------------
resource "oci_redis_redis_cluster" "main" {
  compartment_id = var.compartment_id
  display_name   = "${local.name}-redis"

  node_count         = var.cache_node_count
  node_memory_in_gbs = var.cache_memory_gbs
  software_version   = var.cache_software_version
  subnet_id          = var.subnet_id

  freeform_tags = local.tags
}
