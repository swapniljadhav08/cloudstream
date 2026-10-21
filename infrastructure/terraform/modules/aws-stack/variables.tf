# AWS stack: the managed services the local stack stands in for.
#
#   RDS PostgreSQL  <- postgres container
#   ElastiCache     <- redis container
#   S3              <- LocalStack (same modules/storage-s3, applied for real)
#
# Exposes the same output surface as modules/local-stack and modules/oci-stack.
#
# Networking is taken as input rather than created here: an organisation's VPC,
# subnets and routing are almost always owned by a separate team and module.

variable "project" {
  type    = string
  default = "video-streaming"
}

variable "environment" {
  type = string
}

variable "vpc_id" {
  description = "VPC the database and cache are placed in."
  type        = string
}

variable "private_subnet_ids" {
  description = "At least two subnets in different availability zones."
  type        = list(string)

  validation {
    condition     = length(var.private_subnet_ids) >= 2
    error_message = "RDS and ElastiCache subnet groups require at least two subnets in different AZs."
  }
}

variable "app_security_group_ids" {
  description = "Security groups of the API and worker tasks; these are granted database and cache access."
  type        = list(string)
}

variable "db_name" {
  type    = string
  default = "video_streaming"
}

variable "db_username" {
  type    = string
  default = "postgres"
}

variable "db_password" {
  description = "Injected from a secret manager, never committed."
  type        = string
  sensitive   = true
}

variable "db_instance_class" {
  type    = string
  default = "db.t4g.medium"
}

variable "db_allocated_storage_gb" {
  type    = number
  default = 100
}

variable "db_multi_az" {
  type    = bool
  default = true
}

variable "cache_node_type" {
  type    = string
  default = "cache.t4g.small"
}

variable "allowed_origins" {
  description = "Origins permitted to fetch media cross-origin."
  type        = list(string)
}

variable "force_destroy_bucket" {
  type    = bool
  default = false
}

variable "tags" {
  type    = map(string)
  default = {}
}
