# Google Cloud stack.
#
#   Cloud SQL for PostgreSQL <- postgres container
#   Memorystore for Redis    <- redis container
#   Cloud Storage            <- LocalStack
#
# Exposes the same output surface as modules/local-stack, modules/aws-stack and
# modules/oci-stack, plus `storage_bucket_media`.
#
# Cloud Storage is reached through its S3-compatible XML API using an HMAC key,
# so the application's S3 client works unchanged — only the endpoint and
# credentials differ.
#
# TWO BUCKETS, unlike the S3 stacks. GCS IAM is bucket-level: there is no way
# to grant anonymous read to `*/hls/*` while keeping `*/original.mp4` private,
# and a URL map cannot substitute because its wildcards are trailing-only. So
# delivered media lives in its own public bucket and everything else stays in
# a private one. The application picks between them per key; where one bucket
# suffices the two names are equal and nothing changes.

variable "project" {
  type    = string
  default = "video-streaming"
}

variable "environment" {
  type = string
}

variable "project_id" {
  description = "GCP project id that owns these resources."
  type        = string
}

variable "region" {
  type    = string
  default = "europe-west1"
}

variable "storage_location" {
  description = "Bucket location. A region keeps egress to the app in the same place."
  type        = string
  default     = "EUROPE-WEST1"
}

variable "db_tier" {
  description = "Cloud SQL machine type, e.g. db-custom-2-7680."
  type        = string
  default     = "db-custom-2-7680"
}

variable "db_disk_gb" {
  type    = number
  default = 100
}

variable "db_username" {
  type    = string
  default = "postgres"
}

variable "db_password" {
  description = "Injected from Secret Manager, never committed."
  type        = string
  sensitive   = true
}

variable "cache_memory_gb" {
  type    = number
  default = 1
}

variable "allowed_origins" {
  description = "Origins permitted to fetch media cross-origin."
  type        = list(string)
}

variable "force_destroy_buckets" {
  description = "Allow `terraform destroy` to delete non-empty buckets. Never true for prod."
  type        = bool
  default     = false
}

variable "labels" {
  type    = map(string)
  default = {}
}
