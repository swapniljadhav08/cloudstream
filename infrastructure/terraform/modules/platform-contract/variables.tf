# Provider-invariant platform contract.
#
# Every *-stack module consumes this module and must expose the same output
# surface (see each stack's outputs.tf). That is what makes the local, AWS and
# OCI stacks interchangeable: the storage layout, lifecycle policy and
# rendition ladder are declared here once and never restated per provider.

variable "project" {
  description = "Project slug used to derive resource names."
  type        = string
  default     = "video-streaming"
}

variable "environment" {
  description = "Deployment environment (local | dev | staging | prod)."
  type        = string

  validation {
    condition     = contains(["local", "dev", "staging", "prod"], var.environment)
    error_message = "environment must be one of: local, dev, staging, prod."
  }
}
