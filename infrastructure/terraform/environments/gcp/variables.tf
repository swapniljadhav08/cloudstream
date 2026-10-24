variable "project" {
  description = "Project slug used to derive resource names."
  type        = string
  default     = "video-streaming"
}

variable "environment" {
  type    = string
  default = "dev"

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "environment must be one of: dev, staging, prod."
  }
}

variable "project_id" {
  description = "GCP project id."
  type        = string
  default     = "devcartel-8aa92"
}

variable "region" {
  type    = string
  default = "europe-west1"
}

variable "storage_location" {
  type    = string
  default = "EUROPE-WEST1"
}

variable "db_tier" {
  description = "Cloud SQL machine type. db-f1-micro is the cheapest for a trial."
  type        = string
  default     = "db-custom-2-7680"
}

variable "cache_memory_gb" {
  type    = number
  default = 1
}

variable "db_password" {
  description = "Supply via TF_VAR_db_password from Secret Manager, never a file."
  type        = string
  sensitive   = true
}

variable "allowed_origins" {
  description = "Origins permitted to fetch media cross-origin, e.g. the public app URL."
  type        = list(string)
}
