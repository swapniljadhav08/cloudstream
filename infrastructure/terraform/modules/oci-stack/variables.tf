# Oracle Cloud stack.
#
#   OCI Database with PostgreSQL <- postgres container
#   OCI Cache with Redis         <- redis container
#   OCI Object Storage           <- LocalStack
#
# Exposes the same output surface as modules/local-stack and modules/aws-stack.
#
# Object Storage is reached through its S3 Compatibility API, so the
# application's S3 client works unchanged; only the endpoint and credentials
# differ. See the note in main.tf about public read, which OCI models
# differently from S3 and is the one place the stacks are not equivalent.

variable "project" {
  type    = string
  default = "video-streaming"
}

variable "environment" {
  type = string
}

variable "compartment_id" {
  description = "OCID of the compartment that owns these resources."
  type        = string
}

variable "region" {
  description = "OCI region identifier, e.g. eu-frankfurt-1."
  type        = string
}

variable "subnet_id" {
  description = "OCID of the private subnet for the database and cache."
  type        = string
}

variable "app_user_id" {
  description = "OCID of the IAM user whose customer secret key the application uses for S3-compatible access."
  type        = string
}

variable "db_username" {
  type    = string
  default = "postgres"
}

variable "db_password" {
  description = "Injected from OCI Vault, never committed."
  type        = string
  sensitive   = true
}

variable "db_version" {
  type    = string
  default = "16"
}

variable "db_shape" {
  type    = string
  default = "PostgreSQL.VM.Standard.E4.Flex.2.32GB"
}

variable "db_instance_count" {
  description = "2 or more gives a standby for failover."
  type        = number
  default     = 2
}

variable "cache_node_count" {
  type    = number
  default = 2
}

variable "cache_memory_gbs" {
  type    = number
  default = 4
}

variable "cache_software_version" {
  type    = string
  default = "REDIS_7_0"
}

variable "storage_tier" {
  type    = string
  default = "Standard"
}
