# Local stack: open-source stand-ins for managed cloud services.
#
#   PostgreSQL container  <- AWS RDS / OCI PostgreSQL
#   Redis container       <- AWS ElastiCache / OCI Cache
#   LocalStack (S3)       <- AWS S3 / OCI Object Storage
#
# LocalStack serves the real AWS S3 API, so the bucket, policy, CORS and
# lifecycle rules are created by modules/storage-s3 using the ordinary `aws`
# provider -- the very same module environments/aws applies against real S3.
#
# Implements the same input/output surface as modules/aws-stack and
# modules/oci-stack, so environments/ can swap providers without the
# application's configuration changing shape.

variable "project" {
  type    = string
  default = "video-streaming"
}

variable "environment" {
  type    = string
  default = "local"
}

variable "postgres_version" {
  type    = string
  default = "16-alpine"
}

variable "redis_version" {
  type    = string
  default = "7-alpine"
}

# LocalStack 3.0 community edition, pinned by digest.
#
# `latest` is now the Pro image and refuses to start without a licence token,
# so the tag matters here. 3.0 is the last line that runs S3 unlicensed, and
# the digest keeps it from moving under us.
variable "localstack_image" {
  type    = string
  default = "localstack/localstack@sha256:e606c4421419030b12d63a59f1211f57f5b0fbf7e9ce769e6250ee62ff4f9293"
}

variable "db_username" {
  type    = string
  default = "postgres"
}

variable "db_password" {
  type      = string
  default   = "postgres"
  sensitive = true
}

# LocalStack accepts any credentials; `test` is its documented convention.
variable "storage_access_key" {
  type    = string
  default = "test"
}

variable "storage_secret_key" {
  type      = string
  default   = "test"
  sensitive = true
}

variable "storage_region" {
  type    = string
  default = "us-east-1"
}

variable "allowed_origins" {
  description = "Origins permitted to fetch media cross-origin."
  type        = list(string)
  default     = ["http://localhost:3000"]
}

variable "host_port_postgres" {
  description = "Host port for PostgreSQL. 5433 by default: 5432 is commonly taken by a host install."
  type        = number
  default     = 5433
}

variable "host_port_redis" {
  type    = number
  default = 6379
}

variable "host_port_storage_api" {
  description = "Host port for the LocalStack edge endpoint (S3 API)."
  type        = number
  default     = 4566
}
