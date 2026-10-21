variable "project" {
  type    = string
  default = "video-streaming"
}

variable "environment" {
  type    = string
  default = "prod"
}

variable "region" {
  description = "OCI region identifier, e.g. eu-frankfurt-1."
  type        = string
}

variable "compartment_id" {
  type = string
}

variable "subnet_id" {
  type = string
}

variable "app_user_id" {
  description = "OCID of the IAM user the application authenticates as."
  type        = string
}

variable "db_password" {
  type      = string
  sensitive = true
}
