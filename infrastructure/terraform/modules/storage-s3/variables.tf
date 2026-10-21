variable "bucket_name" {
  type = string
}

variable "public_read_key_patterns" {
  description = "Key patterns granted anonymous GET, relative to the bucket root."
  type        = list(string)
}

variable "lifecycle_rules" {
  type = list(object({
    id              = string
    prefix          = string
    expiration_days = number
  }))
  default = []
}

variable "allowed_origins" {
  description = "Origins permitted to fetch media cross-origin."
  type        = list(string)
  default     = ["*"]
}

variable "force_destroy" {
  description = "Allow `terraform destroy` to delete a non-empty bucket. Never true outside local/dev."
  type        = bool
  default     = false
}

variable "tags" {
  type    = map(string)
  default = {}
}

variable "lifecycle_create_timeout" {
  description = "How long to wait for the lifecycle configuration to read back consistently."
  type        = string
  default     = "3m"
}

variable "manage_lifecycle" {
  description = "Whether to manage the bucket's lifecycle rules. See the note in main.tf."
  type        = bool
  default     = true
}
