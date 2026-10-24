# Google Cloud environment.
#
#   terraform init
#   terraform apply -var-file=prod.tfvars
#
# Same platform contract as ../local, ../aws and ../oci. The differences are
# confined to modules/gcp-stack: Cloud SQL and Memorystore replace the
# containers, and Cloud Storage replaces S3 through its S3-compatible XML API.
#
# Credentials are NOT declared here. The provider picks them up from
# Application Default Credentials (`gcloud auth application-default login`) or
# from GOOGLE_APPLICATION_CREDENTIALS pointing at a service-account key, so no
# secret has to live in the configuration.

terraform {
  required_version = ">= 1.6"

  required_providers {
    google = { source = "hashicorp/google", version = "~> 6.0" }
  }

  # Uncomment before applying anything shared: local state for cloud
  # infrastructure loses the ability to collaborate safely.
  # backend "gcs" {
  #   bucket = "devcartel-8aa92-terraform-state"
  #   prefix = "video-streaming/gcp"
  # }
}

provider "google" {
  project = var.project_id
  region  = var.region

  default_labels = {
    project    = var.project
    managed-by = "terraform"
  }
}

# These have to be on before the stack can be created. Terraform enables them
# rather than leaving a half-applied stack and a console error.
resource "google_project_service" "required" {
  for_each = toset([
    "compute.googleapis.com",
    "servicenetworking.googleapis.com",
    "sqladmin.googleapis.com",
    "redis.googleapis.com",
    "storage.googleapis.com",
    "iam.googleapis.com",
  ])

  project = var.project_id
  service = each.value

  # Leave the APIs on if the stack is torn down: other things in the project
  # may depend on them.
  disable_on_destroy = false
}

module "stack" {
  source = "../../modules/gcp-stack"

  project     = var.project
  environment = var.environment

  project_id       = var.project_id
  region           = var.region
  storage_location = var.storage_location

  db_password     = var.db_password
  db_tier         = var.db_tier
  cache_memory_gb = var.cache_memory_gb
  allowed_origins = var.allowed_origins

  force_destroy_buckets = var.environment != "prod"

  depends_on = [google_project_service.required]
}
